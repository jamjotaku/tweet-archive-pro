"""
main.py - FastAPI エントリーポイント
TweetArchive Pro のAPIルーティングを定義する。
"""

from fastapi import FastAPI, Depends, HTTPException, Query, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import StreamingResponse, FileResponse
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
from app.schemas import (
    BookmarkCreate, BookmarkResponse, BookmarkListResponse, BookmarkUpdate, 
    UserCreate, UserResponse, Token, CategoryResponse, BatchLinkRequest, UserUpdate, GraphData, BatchDeleteRequest
)
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
# PWA 関連
# ──────────────────────────────────────────────

@app.get("/manifest.json")
def get_manifest():
    return FileResponse(os.path.join(os.path.dirname(__file__), "static", "manifest.json"))


@app.get("/sw.js")
def get_sw():
    return FileResponse(
        os.path.join(os.path.dirname(__file__), "static", "sw.js"),
        media_type="application/javascript"
    )


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


@app.get("/users/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """ログイン中のユーザー情報を取得。"""
    return current_user


@app.put("/users/me", response_model=UserResponse)
def update_me(
    update_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """ログイン中のユーザーのプロフィールを更新。"""
    updated_user = crud.update_user_profile(db, current_user.id, update_data)
    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found")
    return updated_user


@app.get("/users/stats")
def get_user_stats(
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """プロフィールのための統計情報を取得。"""
    return crud.get_user_stats(db, current_user.id)


# ──────────────────────────────────────────────
# UI ページルーティング
# ──────────────────────────────────────────────

@app.get("/profile")
def profile_page(request: Request):
    """プロフィールページを表示。"""
    return templates.TemplateResponse(request=request, name="profile.html")


@app.get("/graph")
def graph_page(request: Request):
    """ナレッジグラフページを表示。"""
    return templates.TemplateResponse(request=request, name="graph.html")


# ──────────────────────────────────────────────
# ブックマークエンドポイント (ログイン必須)
# ──────────────────────────────────────────────

@app.post("/bookmarks", response_model=BookmarkResponse)
def create_bookmark(
    data: BookmarkCreate,
    auto_fetch: bool = True,
    fetch_thread: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """新しいブックマークを作成する。"""
    return crud.create_bookmark(db, data, current_user.id, auto_fetch=auto_fetch, fetch_thread=fetch_thread)


@app.get("/bookmarks/stats/timeline")
def get_timeline_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """ユーザーの保存履歴を年月別に集計して返す。"""
    return crud.get_timeline_stats(db, current_user.id)


@app.get("/bookmarks", response_model=BookmarkListResponse)
def get_bookmarks(
    skip: int = Query(0, ge=0, description="スキップ件数"),
    limit: int = Query(50, ge=1, le=200, description="取得件数（最大200）"),
    category: str | None = Query(None, description="カテゴリでフィルタ"),
    month: str | None = Query(None, description="年月でフィルタ"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """現在のユーザーの保存されたブックマーク一覧をJSONで返す。"""
    bookmarks, total = crud.get_bookmarks(
        db, user_id=current_user.id, skip=skip, limit=limit, category=category, month=month
    )
    return BookmarkListResponse(total=total, bookmarks=bookmarks)


@app.get("/bookmarks/categories", response_model=list[CategoryResponse])
def get_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """ユーザーが使用しているカテゴリ一覧を取得。"""
    return crud.get_categories(db, current_user.id)


@app.get("/bookmarks/graph", response_model=GraphData)
def get_knowledge_graph(
    limit: int = Query(200, description="取得する最大ノード数"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """ユーザーのナレッジグラフ（ノードとエッジ）を取得。"""
    return crud.get_knowledge_graph(db, current_user.id, limit)


@app.get("/bookmarks/{bookmark_id}/links", response_model=list[BookmarkResponse])
def get_bookmark_links(
    bookmark_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """特定のブックマークに関連付けられたブックマーク一覧を取得。"""
    return crud.get_bookmark_links(db, bookmark_id)


@app.post("/bookmarks/batch/link")
def batch_link_bookmarks(
    data: BatchLinkRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """複数のブックマークを一括で相互に関連付ける。"""
    crud.link_bookmarks(db, data.ids)
    return {"message": "Bookmarks linked successfully"}


@app.post("/bookmarks/batch/delete")
def batch_delete_bookmarks(
    data: BatchDeleteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """複数のブックマークを一括で削除する。"""
    count = crud.batch_delete_bookmarks(db, current_user.id, data.ids)
    return {"message": f"Successfully deleted {count} bookmarks"}


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


@app.patch("/bookmarks/{bookmark_id}", response_model=BookmarkResponse)
def update_bookmark(
    bookmark_id: int,
    data: BookmarkUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        updated = crud.update_bookmark(db, current_user.id, bookmark_id, data)
        if not updated:
            raise HTTPException(status_code=404, detail="Bookmark not found")
        return updated
    except Exception as e:
        import traceback
        error_detail = f"Backend Error: {str(e)}\n{traceback.format_exc()}"
        print(error_detail) # サーバーログにも出力
        raise HTTPException(status_code=500, detail=error_detail)


@app.post("/bookmarks/{bookmark_id}/sync", response_model=BookmarkResponse)
def sync_bookmark(
    bookmark_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """外部APIからメタデータを再取得してブックマークを最新の状態にする。"""
    bookmark = crud.sync_bookmark_metadata(db, current_user.id, bookmark_id)
    if not bookmark:
        raise HTTPException(status_code=404, detail="ブックマークが見つかりません、または同期に失敗しました。")
    return bookmark


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
