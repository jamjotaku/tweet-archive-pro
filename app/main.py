"""
main.py - FastAPI エントリーポイント
TweetArchive Pro のAPIルーティングを定義する。
"""

from fastapi import FastAPI, Depends, HTTPException, Query, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from contextlib import asynccontextmanager
from typing import Annotated
from datetime import timedelta
import os
import io
import csv
import requests

from app.database import get_db
from app.models import init_db, User
from app.schemas import BookmarkCreate, BookmarkResponse, BookmarkListResponse, UserCreate, UserResponse, Token
from app import crud
from app.auth import create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES, verify_password
from app.dependencies import get_current_user


@asynccontextmanager
async def lifespan(app: FastAPI):
    """アプリケーション起動時にDBを初期化する。"""
    os.makedirs(
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "data"),
        exist_ok=True,
    )
    init_db()
    yield


app = FastAPI(
    title="TweetArchive Pro",
    description="X (Twitter) ブックマーク管理API (複数ユーザー・ログイン対応)",
    version="0.2.0",
    lifespan=lifespan,
)

# Static Files
app.mount(
    "/static", 
    StaticFiles(directory=os.path.join(os.path.dirname(__file__), "static")), 
    name="static"
)

# Templates
templates = Jinja2Templates(directory=os.path.join(os.path.dirname(__file__), "templates"))

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────
# ページルーティング (Jinja2)
# ──────────────────────────────────────────────
@app.get("/")
def index_page(request: Request):
    """メイン画面（フロントエンド）を返す。"""
    return templates.TemplateResponse(request=request, name="index.html")

@app.get("/login")
def login_page(request: Request):
    """ログイン画面を返す。"""
    return templates.TemplateResponse(request=request, name="login.html")


# ──────────────────────────────────────────────
# 認証・ユーザーエンドポイント
# ──────────────────────────────────────────────

@app.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user: UserCreate, db: Session = Depends(get_db)):
    """新しいユーザーを登録する。"""
    db_user = crud.get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    return crud.create_user(db=db, user=user)


@app.post("/token", response_model=Token)
def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db)
):
    """ユーザー名とパスワードでログインし、JWTアクセストークンを取得する。"""
    user = crud.get_user_by_username(db, username=form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


# ──────────────────────────────────────────────
# ブックマークエンドポイント (ログイン必須)
# ──────────────────────────────────────────────

@app.post("/bookmarks", response_model=BookmarkResponse, status_code=201)
def create_bookmark(
    data: BookmarkCreate,
    auto_fetch: bool = Query(False, description="メタデータを自動取得するか"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """ツイートURLを現在のユーザーのDBに保存する。"""
    if auto_fetch and not data.note:
        try:
            res = requests.get(f"https://publish.twitter.com/oembed?url={data.url}", timeout=5)
            if res.status_code == 200:
                oembed = res.json()
                author = oembed.get("author_name", "")
                data.note = f"By: {author}"
        except Exception:
            pass

    try:
        bookmark = crud.create_bookmark(db, data, user_id=current_user.id)
        return bookmark
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/bookmarks", response_model=BookmarkListResponse)
def list_bookmarks(
    skip: int = Query(0, ge=0, description="スキップ件数"),
    limit: int = Query(50, ge=1, le=200, description="取得件数（最大200）"),
    category: str | None = Query(None, description="カテゴリでフィルタ"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """現在のユーザーの保存されたブックマーク一覧をJSONで返す。"""
    bookmarks, total = crud.get_bookmarks(
        db, user_id=current_user.id, skip=skip, limit=limit, category=category
    )
    return BookmarkListResponse(total=total, bookmarks=bookmarks)


@app.get("/bookmarks/search", response_model=list[BookmarkResponse])
def search_bookmarks(
    q: str = Query(..., min_length=1, description="検索キーワード"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """現在のユーザーのブックマークからFTS5で全文検索を実行する。"""
    results = crud.search_bookmarks(db, current_user.id, q)
    return results


@app.get("/bookmarks/export")
def export_bookmarks(
    format: str = Query("json", description="出力フォーマット(json/csv)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """保存された全データをエクスポートする。"""
    bookmarks, _ = crud.get_bookmarks(db, user_id=current_user.id, limit=100000)
    
    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["ID", "Tweet ID", "URL", "Category", "Tags", "Note", "Created At"])
        for bm in bookmarks:
            writer.writerow([bm.id, bm.tweet_id, bm.url, bm.category, bm.tags, bm.note, bm.created_at])
        output.seek(0)
        return StreamingResponse(
            output, 
            media_type="text/csv", 
            headers={"Content-Disposition": "attachment; filename=bookmarks.csv"}
        )
    return bookmarks


@app.delete("/bookmarks/{bookmark_id}", status_code=204)
def delete_bookmark(
    bookmark_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """現在のユーザーのブックマークを削除する。"""
    success = crud.delete_bookmark(db, current_user.id, bookmark_id)
    if not success:
        raise HTTPException(status_code=404, detail="ブックマークが見つかりません、または削除権限がありません。")
    return None


@app.get("/health")
def health_check():
    """ヘルスチェックエンドポイント。"""
    return {"status": "ok", "app": "TweetArchive Pro"}
