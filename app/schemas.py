"""
schemas.py - Pydantic バリデーションスキーマ
リクエスト/レスポンスのデータ検証を行う。
"""

import re
from datetime import datetime
from pydantic import BaseModel, field_validator, Field
from typing import Optional


# --- ユーザーと認証 ---
class UserCreate(BaseModel):
    """ユーザー作成リクエストスキーマ"""
    username: str
    password: str


class UserUpdate(BaseModel):
    """ユーザー情報更新リクエストスキーマ"""
    display_name: Optional[str] = None
    bio: Optional[str] = None


class UserResponse(BaseModel):
    """ユーザー情報のレスポンススキーマ"""
    id: int
    username: str
    display_name: Optional[str] = ""
    bio: Optional[str] = ""

    model_config = {"from_attributes": True}


class Token(BaseModel):
    """JWTトークンのレスポンススキーマ"""
    access_token: str
    token_type: str


class TokenData(BaseModel):
    """JWTトークン内のデータスキーマ"""
    username: str | None = None


# --- ブックマーク ---


class BookmarkCreate(BaseModel):
    """ブックマーク作成時のリクエストスキーマ。"""
    url: str
    category: Optional[str] = "未分類"
    tags: Optional[str] = ""
    note: Optional[str] = ""

    @field_validator("url")
    @classmethod
    def validate_tweet_url(cls, v: str) -> str:
        """X/TwitterのツイートURLであることを検証する。"""
        pattern = r"https?://(twitter\.com|x\.com)/\w+/status/\d+"
        if not re.match(pattern, v):
            raise ValueError(
                "有効なツイートURLを入力してください (例: https://x.com/user/status/123456)"
            )
        return v

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, v: str | None) -> str:
        """タグをカンマ区切りで正規化する。"""
        if not v:
            return ""
        # 全角・半角スペースをカンマに統一し、重複カンマを除去
        tags = re.sub(r"[,、\s]+", ",", v.strip())
        return tags.strip(",")


class BookmarkResponse(BaseModel):
    """ブックマークのレスポンススキーマ。"""
    id: int
    tweet_id: str
    url: str
    category: str | None
    tags: str | None
    note: str | None
    note_html: str | None = ""
    author_name: str | None = ""
    author_handle: str | None = ""
    tweet_text: str | None = ""
    media_url: str | None = ""
    thread_json: str | None = "[]"
    created_at: datetime
    tweet_created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class BookmarkUpdate(BaseModel):
    """ブックマーク更新用のスキーマ。"""
    category: str | None = None
    tags: str | None = None
    note: str | None = None
    thread_json: str | None = None

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, v: str | None) -> str | None:
        if v is None:
            return None
        tags = re.sub(r"[,、\s]+", ",", v.strip())
        return tags.strip(",")


class BookmarkListResponse(BaseModel):
    """ブックマーク一覧のレスポンススキーマ。"""
    total: int
    bookmarks: list[BookmarkResponse]


class CategoryResponse(BaseModel):
    """カテゴリ情報のレスポンススキーマ。"""
    name: str
    count: int


class BatchLinkRequest(BaseModel):
    """複数ブックマークの関連付けリクエスト"""
    ids: list[int]


class BatchDeleteRequest(BaseModel):
    """複数ブックマークの一括削除リクエスト"""
    ids: list[int]


# --- グラフ (Knowledge Graph) ---
class GraphNode(BaseModel):
    """グラフ描画用ノード"""
    id: str | int
    label: str
    shape: str = "dot"
    value: int = 1
    group: str | None = None
    title: str | None = None

class GraphEdge(BaseModel):
    """グラフ描画用エッジ"""
    from_: str | int = Field(alias="from")
    to: str | int

class GraphData(BaseModel):
    """グラフデータ"""
    nodes: list[GraphNode]
    edges: list[GraphEdge]

    model_config = {"populate_by_name": True}
