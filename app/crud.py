"""
crud.py - データベース操作ロジック
ユーザーとブックマークのCRUD操作を提供する。
"""

import re
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models import Bookmark, User
from app.schemas import BookmarkCreate, UserCreate
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


def create_bookmark(db: Session, data: BookmarkCreate, user_id: int) -> Bookmark:
    """ユーザーの新しいブックマークを作成する。"""
    tweet_id = extract_tweet_id(data.url)

    # 重複チェック (同一ユーザー内でのみチェック)
    existing = db.query(Bookmark).filter(
        Bookmark.tweet_id == tweet_id,
        Bookmark.user_id == user_id
    ).first()
    if existing:
        raise ValueError(f"tweet_id '{tweet_id}' は既に登録されています。")

    bookmark = Bookmark(
        user_id=user_id,
        tweet_id=tweet_id,
        url=data.url,
        category=data.category or "未分類",
        tags=data.tags or "",
        note=data.note or "",
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
