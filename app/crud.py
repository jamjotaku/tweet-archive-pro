"""
crud.py - データベース操作ロジック
ユーザーとブックマークのCRUD操作を提供する。
"""

import re
import json
import requests
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session
from sqlalchemy import text, func, or_
from app.models import Bookmark, User, BookmarkRelation
from app.schemas import BookmarkCreate, BookmarkUpdate, UserCreate, UserUpdate
from app.auth import get_password_hash


# --- ユーザー ---
def get_user_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()


def create_user(db: Session, user: UserCreate) -> User:
    hashed_password = get_password_hash(user.password)
    db_user = User(username=user.username, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def update_user_profile(db: Session, user_id: int, update_data: UserUpdate) -> User:
    """ユーザーのプロフィール（表示名、自己紹介）を更新する。"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return None
    if update_data.display_name is not None:
        user.display_name = update_data.display_name
    if update_data.bio is not None:
        user.bio = update_data.bio
    db.commit()
    db.refresh(user)
    return user


def get_user_stats(db: Session, user_id: int):
    """ユーザーの統計情報（総数、カテゴリ数、参加日など）を取得。"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user: return None
    
    total_count = db.query(Bookmark).filter(Bookmark.user_id == user_id).count()
    category_count = db.query(func.count(func.distinct(Bookmark.category))).filter(Bookmark.user_id == user_id).scalar()
    
    top_categories = db.query(
        Bookmark.category, 
        func.count(Bookmark.id).label("count")
    ).filter(Bookmark.user_id == user_id).group_by(Bookmark.category).order_by(text("count DESC")).limit(5).all()
    
    return {
        "username": user.username,
        "display_name": user.display_name or "",
        "bio": user.bio or "",
        "joined_at": user.created_at,
        "total_bookmarks": total_count,
        "category_count": category_count,
        "top_categories": [{"name": c[0], "count": c[1]} for c in top_categories]
    }


# --- ブックマーク ---
def extract_tweet_id(url: str) -> str:
    """ツイートURLからtweet_idを抽出する。"""
    match = re.search(r"/status/(\d+)", url)
    if not match:
        raise ValueError("URLからtweet_idを抽出できません。")
    return match.group(1)


def fetch_tweet_metadata(url: str, fetch_thread: bool = True) -> dict:
    """ツイートURLからメタデータ（著者、本文、マルチ画像、スレッド）を取得する。"""
    meta = {"author_name": "", "author_handle": "", "tweet_text": "", "media_url": "", "thread_json": "[]"}
    tweet_id = extract_tweet_id(url)
    
    def fetch_single(tid):
        try:
            res = requests.get(f"https://api.vxtwitter.com/status/{tid}", timeout=5)
            if res.status_code == 200:
                return res.json()
        except Exception:
            pass
        return None

    # 1. ターゲットのツイートを取得
    data = fetch_single(tweet_id)
    if not data:
        return meta

    meta["author_name"] = data.get("user_name", "")
    meta["author_handle"] = f"@{data.get('user_screen_name', '')}"
    meta["tweet_text"] = data.get("text", "")
    
    # マルチ画像対応: 全画像URLをカンマ区切りで保存
    media_list = [m.get("url") for m in data.get("media_extended", []) if m.get("url")]
    if media_list:
        meta["media_url"] = ",".join(media_list)

    # 2. スレッド（親ツイート）の取得
    thread_items = []
    if fetch_thread:
        parent_id = data.get("in_reply_to_status_id")
        # 最大3世代まで親を辿る (簡易版)
        for _ in range(3):
            if not parent_id: break
            p_data = fetch_single(parent_id)
            if not p_data: break
            
            p_media = [m.get("url") for m in p_data.get("media_extended", []) if m.get("url")]
            thread_items.insert(0, {
                "id": parent_id,
                "author_name": p_data.get("user_name"),
                "author_handle": f"@{p_data.get('user_screen_name')}",
                "text": p_data.get("text"),
                "media": ",".join(p_media) if p_media else "",
                "created_at": p_data.get("date")
            })
            parent_id = p_data.get("in_reply_to_status_id")
            
    if thread_items:
        meta["thread_json"] = json.dumps(thread_items, ensure_ascii=False)
    
    return meta


def get_bookmark_by_url(db: Session, user_id: int, url: str) -> Bookmark | None:
    """URLで既存のブックマークを検索（重複チェック用）。"""
    return db.query(Bookmark).filter(Bookmark.user_id == user_id, Bookmark.url == url).first()


def get_timeline_stats(db: Session, user_id: int):
    """年月別のブックマーク数を集計してタイムラインを生成。"""
    # SQLite 依存の strftime を使用
    query = text("""
        SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count 
        FROM bookmarks 
        WHERE user_id = :user_id 
        GROUP BY month 
        ORDER BY month DESC
    """)
    result = db.execute(query, {"user_id": user_id})
    return [{"month": row[0], "count": row[1]} for row in result]


def sync_bookmark_metadata(db: Session, user_id: int, bookmark_id: int) -> Bookmark | None:
    """既存のブックマークのメタデータを外部APIから再取得して更新する。"""
    bookmark = db.query(Bookmark).filter(Bookmark.id == bookmark_id, Bookmark.user_id == user_id).first()
    if not bookmark:
        return None
    
    meta = fetch_tweet_metadata(bookmark.url)
    if meta["author_name"]:
        bookmark.author_name = meta["author_name"]
        bookmark.author_handle = meta["author_handle"]
        bookmark.tweet_text = meta["tweet_text"]
        bookmark.media_url = meta["media_url"]
        
        # メモが空なら著者名を入れておく
        if not bookmark.note:
            bookmark.note = f"By: {meta['author_name']}"
            
        db.commit()
        db.refresh(bookmark)
    return bookmark


def create_bookmark(db: Session, data: BookmarkCreate, user_id: int, auto_fetch: bool = False, fetch_thread: bool = True) -> Bookmark:
    """ユーザーの新しいブックマークを作成する。重複チェック付き。"""
    # 1. 重複チェック
    existing = get_bookmark_by_url(db, user_id, data.url)
    if existing:
        return existing

    tweet_id = extract_tweet_id(data.url)
    meta = {}
    if auto_fetch:
        meta = fetch_tweet_metadata(data.url, fetch_thread=fetch_thread)

    db_bookmark = Bookmark(
        user_id=user_id,
        tweet_id=tweet_id,
        url=data.url,
        category=data.category or "未分類",
        tags=data.tags or "",
        note=data.note or "",
        author_name=meta.get("author_name", ""),
        author_handle=meta.get("author_handle", ""),
        tweet_text=meta.get("tweet_text", ""),
        media_url=meta.get("media_url", ""),
        thread_json=meta.get("thread_json", "[]")
    )
    db.add(db_bookmark)
    db.commit()
    db.refresh(db_bookmark)
    return db_bookmark


def get_bookmarks(
    db: Session, 
    user_id: int, 
    skip: int = 0, 
    limit: int = 20, 
    category: str | None = None,
    month: str | None = None
):
    """ユーザーのブックマーク一覧を取得。カテゴリや年月での絞り込みに対応。"""
    query = db.query(Bookmark).filter(Bookmark.user_id == user_id)
    if category:
        query = query.filter(Bookmark.category == category)
    if month:
        # SQLite: strftime('%Y-%m', created_at) = '2024-10'
        query = query.filter(text("strftime('%Y-%m', created_at) = :m")).params(m=month)
        
    total = query.count()
    bookmarks = query.order_by(Bookmark.created_at.desc()).offset(skip).limit(limit).all()
    return bookmarks, total


def get_categories(db: Session, user_id: int):
    """ユーザーが使用しているカテゴリ一覧をカウント付きで取得。"""
    result = db.query(
        Bookmark.category, 
        func.count(Bookmark.id).label("count")
    ).filter(Bookmark.user_id == user_id).group_by(Bookmark.category).all()
    # (None) または 空文字 を '未分類' に正規化してマージ
    cats = {}
    for cat, count in result:
        name = cat or "未分類"
        cats[name] = cats.get(name, 0) + count
    return [{"name": k, "count": v} for k, v in cats.items()]


def link_bookmarks(db: Session, ids: list[int]):
    """複数のブックマークIDを相互に関連付ける。"""
    if len(ids) < 2: return
    # IDをソートして一意なペアを作る
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            a, b = sorted([ids[i], ids[j]])
            # 既存チェック
            exists = db.query(BookmarkRelation).filter(
                BookmarkRelation.bookmark_a_id == a,
                BookmarkRelation.bookmark_b_id == b
            ).first()
            if not exists:
                db.add(BookmarkRelation(bookmark_a_id=a, bookmark_b_id=b))
    db.commit()


def get_bookmark_links(db: Session, bookmark_id: int):
    """指定したブックマークに関連付けられたブックマーク一覧を取得する。"""
    # a_id または b_id が bookmark_id と一致するものを取得
    rels = db.query(BookmarkRelation).filter(
        or_(
            BookmarkRelation.bookmark_a_id == bookmark_id,
            BookmarkRelation.bookmark_b_id == bookmark_id
        )
    ).all()
    
    target_ids = []
    for r in rels:
        tid = r.bookmark_b_id if r.bookmark_a_id == bookmark_id else r.bookmark_a_id
        target_ids.append(tid)
        
    if not target_ids: return []
    return db.query(Bookmark).filter(Bookmark.id.in_(target_ids)).all()


def search_bookmarks(db: Session, user_id: int, query: str):
    """FTS5を使用してブックマークを全文検索（本文・著者含む）。"""
    # 検索語をクリーンアップ
    query = query.strip().replace('"', '""')
    if not query:
        return []
    
    fts_query = text("""
        SELECT b.* FROM bookmarks b
        JOIN bookmarks_fts f ON b.id = f.rowid
        WHERE f.bookmarks_fts MATCH :q AND b.user_id = :u
        ORDER BY rank
    """)
    result = db.execute(fts_query, {"q": f"{query}*", "u": user_id})
    # 辞書形式またはモデルインスタンスに変換
    return result.fetchall()


def update_bookmark(db: Session, user_id: int, bookmark_id: int, data: BookmarkUpdate) -> Bookmark | None:
    """特定のユーザーのブックマークを編集する。"""
    bookmark = db.query(Bookmark).filter(
        Bookmark.id == bookmark_id,
        Bookmark.user_id == user_id
    ).first()
    if not bookmark:
        return None
    if data.category is not None:
        bookmark.category = data.category
    if data.tags is not None:
        bookmark.tags = data.tags
    if data.note is not None:
        bookmark.note = data.note
    db.commit()
    db.refresh(bookmark)
    return bookmark


def delete_bookmark(db: Session, user_id: int, bookmark_id: int) -> bool:
    """特定のユーザーのブックマークを削除する。"""
    bookmark = db.query(Bookmark).filter(
        Bookmark.id == bookmark_id,
        Bookmark.user_id == user_id
    ).first()
    if not bookmark:
        return False
    db.delete(bookmark)
    db.commit()
    return True
