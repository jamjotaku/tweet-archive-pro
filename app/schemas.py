"""
schemas.py - Pydantic バリデーションスキーマ
リクエスト/レスポンスのデータ検証を行う。
"""

import re
from datetime import datetime
from pydantic import BaseModel, field_validator
from typing import Optional


# --- ユーザーと認証 ---
class UserCreate(BaseModel):
    """ユーザー作成リクエストスキーマ"""
    username: str
    password: str


class UserResponse(BaseModel):
    """ユーザー情報のレスポンススキーマ"""
    id: int
    username: str

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
    created_at: datetime

    model_config = {"from_attributes": True}


class BookmarkListResponse(BaseModel):
    """ブックマーク一覧のレスポンススキーマ。"""
    total: int
    bookmarks: list[BookmarkResponse]
