"""
database.py - SQLite3 データベース接続設定
FTS5全文検索拡張を有効にしたSQLite接続を提供する。
"""

import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# データベースファイルのパス
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATABASE_PATH = os.path.join(BASE_DIR, "data", "bookmarks.db")
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

# エンジン作成 (check_same_thread=False は FastAPI の非同期処理のため)
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    """SQLite接続時にWALモードとFTS5を有効化する。"""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("PRAGMA foreign_keys=ON;")
    cursor.close()


# セッションファクトリ
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """SQLAlchemy宣言的ベースクラス。"""
    pass


def get_db():
    """FastAPI依存性注入用のDBセッション生成ジェネレータ。"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
