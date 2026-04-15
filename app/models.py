"""
models.py - SQLAlchemy ORM モデル定義
bookmarks テーブルと FTS5 仮想テーブルを定義する。
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, text, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base, engine


class User(Base):
    """ユーザーテーブルのORMモデル。"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    hashed_password = Column(String(128), nullable=False)
    created_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    bookmarks = relationship("Bookmark", back_populates="user", cascade="all, delete-orphan")


class Bookmark(Base):
    """ブックマークテーブルのORMモデル。"""
    __tablename__ = "bookmarks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    tweet_id = Column(String(64), nullable=False)
    url = Column(String(512), nullable=False)
    category = Column(String(128), nullable=True, default="未分類")
    tags = Column(String(512), nullable=True, default="")
    note = Column(Text, nullable=True, default="")
    # oEmbed メタデータ (自前カード表示用)
    author_name = Column(String(256), nullable=True, default="")
    author_handle = Column(String(128), nullable=True, default="")
    tweet_text = Column(Text, nullable=True, default="")
    media_url = Column(String(1024), nullable=True, default="")
    created_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", back_populates="bookmarks")

    def __repr__(self):
        return f"<Bookmark(id={self.id}, user_id={self.user_id}, tweet_id='{self.tweet_id}')>"


def create_fts5_table(connection):
    """FTS5全文検索テーブルを作成する。"""
    connection.execute(
        text("""
        CREATE VIRTUAL TABLE IF NOT EXISTS bookmarks_fts
        USING fts5(
            user_id UNINDEXED,
            tweet_id UNINDEXED,
            category,
            tags,
            note,
            content='bookmarks',
            content_rowid='id'
        );
        """)
    )
    # FTS5テーブルの同期用トリガー
    connection.execute(
        text("""
        CREATE TRIGGER IF NOT EXISTS bookmarks_ai AFTER INSERT ON bookmarks BEGIN
            INSERT INTO bookmarks_fts(rowid, user_id, tweet_id, category, tags, note)
            VALUES (new.id, new.user_id, new.tweet_id, new.category, new.tags, new.note);
        END;
        """)
    )
    connection.execute(
        text("""
        CREATE TRIGGER IF NOT EXISTS bookmarks_ad AFTER DELETE ON bookmarks BEGIN
            INSERT INTO bookmarks_fts(bookmarks_fts, rowid, user_id, tweet_id, category, tags, note)
            VALUES ('delete', old.id, old.user_id, old.tweet_id, old.category, old.tags, old.note);
        END;
        """)
    )
    connection.execute(
        text("""
        CREATE TRIGGER IF NOT EXISTS bookmarks_au AFTER UPDATE ON bookmarks BEGIN
            INSERT INTO bookmarks_fts(bookmarks_fts, rowid, user_id, tweet_id, category, tags, note)
            VALUES ('delete', old.id, old.user_id, old.tweet_id, old.category, old.tags, old.note);
            INSERT INTO bookmarks_fts(rowid, user_id, tweet_id, category, tags, note)
            VALUES (new.id, new.user_id, new.tweet_id, new.category, new.tags, new.note);
        END;
        """)
    )


def init_db():
    """データベースとFTS5テーブルを初期化する。"""
    Base.metadata.create_all(bind=engine)
    with engine.connect() as connection:
        create_fts5_table(connection)
        
        # 自動マイグレーション: 既存のbookmarksテーブルにメタデータ用カラムがあるか確認
        cursor = connection.execute(text("PRAGMA table_info(bookmarks)"))
        existing_cols = [row[1] for row in cursor.fetchall()]
        
        needed_cols = [
            ("author_name", "TEXT"),
            ("author_handle", "TEXT"),
            ("tweet_text", "TEXT"),
            ("media_url", "TEXT")
        ]
        
        for col, typ in needed_cols:
            if col not in existing_cols:
                connection.execute(text(f"ALTER TABLE bookmarks ADD COLUMN {col} {typ} DEFAULT ''"))
                print(f"Migration: Added column {col} to bookmarks table.")
        
        connection.commit()
