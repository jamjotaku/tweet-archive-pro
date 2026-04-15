"""
crud.py - データベース操作ロジック
ユーザーとブックマークのCRUD操作を提供する。
"""

import re
import requests
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models import Bookmark, User
from app.schemas import BookmarkCreate, BookmarkUpdate, UserCreate
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


# --- ブックマーク ---
def extract_tweet_id(url: str) -> str:
    """ツイートURLからtweet_idを抽出する。"""
    match = re.search(r"/status/(\d+)", url)
    if not match:
        raise ValueError("URLからtweet_idを抽出できません。")
    return match.group(1)


def fetch_tweet_metadata(url: str) -> dict:
    """ツイートURLからメタデータ（著者、本文、画像等）を取得する。"""
    meta = {"author_name": "", "author_handle": "", "tweet_text": "", "media_url": ""}
    tweet_id = extract_tweet_id(url)
    
    # 1. まずは api.vxtwitter.com を試す (JSON APIが扱いやすい)
    try:
        vx_res = requests.get(f"https://api.vxtwitter.com/status/{tweet_id}", timeout=5)
        if vx_res.status_code == 200:
            data = vx_res.json()
            if data:
                meta["author_name"] = data.get("user_name", "")
                meta["author_handle"] = f"@{data.get('user_screen_name', '')}"
                meta["tweet_text"] = data.get("text", "")
                # 画像があれば取得
                media = data.get("media_extended", [])
                if media and media[0].get("url"):
                    meta["media_url"] = media[0]["url"]
                return meta
    except Exception:
        pass

    # 2. フォールバック: 公式 oEmbed API
    try:
        clean_url = url.replace("x.com", "twitter.com")
        res = requests.get(
            f"https://publish.twitter.com/oembed?url={clean_url}&omit_script=true",
            timeout=5
        )
        if res.status_code == 200:
            data = res.json()
            meta["author_name"] = data.get("author_name", "")
            author_url = data.get("author_url", "")
            if author_url:
                handle = author_url.rstrip("/").split("/")[-1]
                meta["author_handle"] = f"@{handle}"
            
            html = data.get("html", "")
            if html:
                soup = BeautifulSoup(html, "html.parser")
                blockquote = soup.find("blockquote")
                if blockquote:
                    p_tags = blockquote.find_all("p")
                    if p_tags: meta["tweet_text"] = p_tags[0].get_text()
                    # メディアURLのヒントを探す
                    for a in blockquote.find_all("a"):
                        if "pic.twitter.com" in a.get("href", ""):
                            meta["media_url"] = a.get("href")
    except Exception:
        pass
    
    return meta


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


def create_bookmark(db: Session, data: BookmarkCreate, user_id: int, auto_fetch: bool = False) -> Bookmark:
    """ユーザーの新しいブックマークを作成する。"""
    tweet_id = extract_tweet_id(data.url)

    # 重複チェック (同一ユーザー内でのみチェック)
    existing = db.query(Bookmark).filter(
        Bookmark.tweet_id == tweet_id,
        Bookmark.user_id == user_id
    ).first()
    if existing:
        raise ValueError(f"tweet_id '{tweet_id}' は既に登録されています。")

    # メタデータ取得
    meta = {"author_name": "", "author_handle": "", "tweet_text": "", "media_url": ""}
    if auto_fetch:
        meta = fetch_tweet_metadata(data.url)
        # メモが空なら自動補完
        if not data.note and meta["author_name"]:
            data.note = f"By: {meta['author_name']}"

    bookmark = Bookmark(
        user_id=user_id,
        tweet_id=tweet_id,
        url=data.url,
        category=data.category or "未分類",
        tags=data.tags or "",
        note=data.note or "",
        author_name=meta["author_name"],
        author_handle=meta["author_handle"],
        tweet_text=meta["tweet_text"],
        media_url=meta["media_url"],
    )
    db.add(bookmark)
    db.commit()
    db.refresh(bookmark)
    return bookmark


def get_bookmarks(
    db: Session,
    user_id: int,
    skip: int = 0,
    limit: int = 50,
    category: str | None = None,
) -> tuple[list[Bookmark], int]:
    """特定のユーザーのブックマーク一覧を取得する。"""
    query = db.query(Bookmark).filter(Bookmark.user_id == user_id)

    if category:
        query = query.filter(Bookmark.category == category)

    total = query.count()
    bookmarks = (
        query.order_by(Bookmark.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return bookmarks, total


def search_bookmarks(db: Session, user_id: int, keyword: str) -> list[Bookmark]:
    """FTS5全文検索で特定ユーザーのブックマークを検索する。"""
    result = db.execute(
        text(
            """
            SELECT b.* FROM bookmarks b
            JOIN bookmarks_fts fts ON b.id = fts.rowid
            WHERE bookmarks_fts MATCH :keyword AND b.user_id = :user_id
            ORDER BY rank
            """
        ),
        {"keyword": keyword, "user_id": user_id},
    )
    rows = result.fetchall()
    return [
        db.query(Bookmark).get(row.id)
        for row in rows
    ]


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
