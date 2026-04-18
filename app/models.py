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
    display_name = Column(String(128), nullable=True, default="")
    bio = Column(Text, nullable=True, default="")

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
    note_html = Column(Text, nullable=True, default="")
    # oEmbed メタデータ (自前カード表示用)
    author_name = Column(String(256), nullable=True, default="")
    author_handle = Column(String(128), nullable=True, default="")
    tweet_text = Column(Text, nullable=True, default="")
    media_url = Column(Text, nullable=True, default="") # JSON or comma-separated URLs
    thread_json = Column(Text, nullable=True, default="[]") # JSON list of {text, media, date}
    created_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    tweet_created_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="bookmarks")

    def __repr__(self):
        return f"<Bookmark(id={self.id}, user_id={self.user_id}, tweet_id='{self.tweet_id}')>"


class BookmarkRelation(Base):
    """ブックマーク同士の関連付けを保存する中間テーブル。"""
    __tablename__ = "bookmark_relations"

    bookmark_a_id = Column(Integer, ForeignKey("bookmarks.id", ondelete="CASCADE"), primary_key=True)
    bookmark_b_id = Column(Integer, ForeignKey("bookmarks.id", ondelete="CASCADE"), primary_key=True)


def init_db():
    """データベースとFTS5テーブルを初期化する。"""
    Base.metadata.create_all(bind=engine)
    with engine.connect() as connection:
        # 自動マイグレーション: 既存のbookmarksテーブルを最新のカラム構成に
        cursor = connection.execute(text("PRAGMA table_info(bookmarks)"))
        existing_cols = [row[1] for row in cursor.fetchall()]
        
        needed_cols = [
            ("author_name", "TEXT"), ("author_handle", "TEXT"),
            ("tweet_text", "TEXT"), ("media_url", "TEXT"),
            ("thread_json", "TEXT"), ("note_html", "TEXT"),
            ("tweet_created_at", "DATETIME")
        ]
        
        for col, typ in needed_cols:
            if col not in existing_cols:
                # すべてのカラムを NULL 許可またはデフォルト値で作成
                connection.execute(text(f"ALTER TABLE bookmarks ADD COLUMN {col} {typ}"))
                print(f"Migration: Added column {col} to bookmarks table.")
        
        # FTS5テーブルの再構築 (カラム構成が変わるため一度削除)
        connection.execute(text("DROP TABLE IF EXISTS bookmarks_fts"))
        create_fts5_table(connection)
        
        connection.commit()


def create_fts5_table(connection):
    """FTS5検索テーブルと同期トリガーを作成する。"""
    # トリガーの更新を確実にするため、一度削除する
    connection.execute(text("DROP TRIGGER IF EXISTS bookmarks_ai"))
    connection.execute(text("DROP TRIGGER IF EXISTS bookmarks_ad"))
    connection.execute(text("DROP TRIGGER IF EXISTS bookmarks_au"))

    connection.execute(
        text("""
        CREATE VIRTUAL TABLE IF NOT EXISTS bookmarks_fts USING fts5(
            user_id UNINDEXED, tweet_id UNINDEXED, category, tags, note, author_name, author_handle, tweet_text,
            tokenize='unicode61'
        );
        """)
    )
    # FTS5テーブルの同期用トリガー (Insert/Delete/Update)
    connection.execute(
        text("""
        CREATE TRIGGER IF NOT EXISTS bookmarks_ai AFTER INSERT ON bookmarks BEGIN
            INSERT INTO bookmarks_fts(rowid, user_id, tweet_id, category, tags, note, author_name, author_handle, tweet_text)
            VALUES (new.id, new.user_id, new.tweet_id, new.category, new.tags, new.note, new.author_name, new.author_handle, new.tweet_text);
        END;
        """)
    )
    connection.execute(
        text("""
        CREATE TRIGGER IF NOT EXISTS bookmarks_ad AFTER DELETE ON bookmarks BEGIN
            DELETE FROM bookmarks_fts WHERE rowid = old.id;
        END;
        """)
    )
    connection.execute(
        text("""
        CREATE TRIGGER IF NOT EXISTS bookmarks_au AFTER UPDATE ON bookmarks BEGIN
            DELETE FROM bookmarks_fts WHERE rowid = old.id;
            INSERT INTO bookmarks_fts(rowid, user_id, tweet_id, category, tags, note, author_name, author_handle, tweet_text)
            VALUES (new.id, new.user_id, new.tweet_id, new.category, new.tags, new.note, new.author_name, new.author_handle, new.tweet_text);
        END;
        """)
    )
