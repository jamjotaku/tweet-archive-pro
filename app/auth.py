"""
auth.py - 認証とセキュリティのロジック
JWT（JSON Web Token）の生成・検証と、パスワードのハッシュ化を行う。
"""

import os
from datetime import datetime, timedelta, timezone
import bcrypt
import jwt

# 設定値 (環境変数を優先、無ければデフォルトのシークレットを使用)
SECRET_KEY = os.environ.get("SECRET_KEY", "super-secret-key-for-tweet-archive-pro")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7日間


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """平文のパスワードとハッシュ値を比較する。"""
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8")
    )


def get_password_hash(password: str) -> str:
    """パスワードのハッシュ値を生成する。"""
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """JWTアクセストークンを生成する。"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
