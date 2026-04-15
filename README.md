# TweetArchive Pro - X Bookmark Manager

## 概要
X (Twitter) のツイートURLを、カテゴリー・タグ・メモと共に保存・管理するセルフホスト型の高機能Webアプリケーションです。
X公式のブックマーク機能の制限をなくし、アカウント単位でのデータ隔離（JWT認証）、高速な全文検索、自由なデータエクスポートを実現しました。
デザインは現在の X.com（Lights Out ダークモード）をオマージュしたプレミアムなUIを備えています。

## ハイライト機能 (Extensions)
バックエンド・フロントエンドが統合され、単なる保存ツールを超えた以下の超強力な「拡張機能（すべて設定からON/OFF可能）」を搭載しています。

- **🔐 複数ユーザー対応:** bcrypt暗号化とJWTによるセキュアなログイン機構。自分だけのブックマーク領域を持てます。
- **🤖 自動メタデータ取得:** URLを保存するだけで自動的にX上から投稿者名等をフェッチし、文字検索の対象にします。
- **🙈 プライバシーぼかしモード:** カフェや職場で背後を気にせず閲覧できるよう、ツイート内容にすりガラス状のぼかしをかけます。
- **⚡ コンパクトモード:** 公式の重い埋め込みカードを非表示にし、テキストベースの爆速リスト表示に切り替えます。
- **📦 エクスポートツール:** 保存したすべてのデータを JSON / CSV 形式で一括ダウンロード。
- **🔖 ブックマークレット:** ドラッグ＆ドロップでブラウザに登録できる「1クリック保存ボタン」。
- **🌐 多言語対応:** 設定から一瞬で日本語（JA）/ 英語（EN）UIを切り替え可能。

## 技術スタック
| 項目 | 技術 |
|------|------|
| **Backend** | Python 3.10+ / FastAPI / bcrypt / PyJWT |
| **Database** | SQLite3 (FTS5 フルテキスト検索専用拡張) |
| **Frontend** | HTML5, Tailwind CSS, Vanilla JS, oEmbed API |
| **Environment** | Docker / docker-compose |

## クイックスタート

### Docker (推奨)
```bash
git clone https://github.com/yourname/tweet-archive-pro.git
cd tweet-archive-pro
docker-compose up -d
```
→ `http://localhost:8000` でアクセスし、まずは自由にユーザー登録（Sign up）してご利用ください。

※ 本番環境で実行する場合は、`docker-compose.yml`内の `SECRET_KEY` にランダムな文字列を設定してください。

### ローカル開発環境での実行
```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## ディレクトリ構造
```
tweet-archive-pro/
├── app/
│   ├── main.py            # API＆テンプレート・エントリーポイント
│   ├── auth.py            # JWT・bcrypt認証ロジック
│   ├── database.py        # DB接続設定
│   ├── models.py          # SQLAlchemyモデル (User, Bookmark)
│   ├── crud.py            # DB操作・メタデータフェッチロジック
│   ├── schemas.py         # Pydanticバリデーション
│   ├── dependencies.py    # FastAPI 依存性注入
│   ├── static/            # JS/CSS アセット (app.js, style.css)
│   └── templates/         # Jinja2 HTMLテンプレート
├── data/                  # SQLite DB保存先 (自動生成)
├── scripts/               # 運用スクリプト置き場
├── Dockerfile             # Dockerコンテナ構成
├── docker-compose.yml     # サービス構成
├── requirements.txt       # 依存ライブラリ
└── README.md
```

## ライセンス
MIT License
