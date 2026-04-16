# タスクリスト: 高度なアーカイブ機能（低負荷・ハイスピード設計）の実装

### 1. 📝 Phase 1: Markdown & コードハイライト (事前パース方式)
- [x] `requirements.txt`: `markdown` および `bleach` (サニタイズ用) の追加とインストール
- [x] `scripts/migrate_add_note_html.py`: 既存DBの `bookmarks` テーブルに `note_html` カラムを追加するスクリプトの作成・実行
- [x] `app/models.py`: `Bookmark` モデルに `note_html` を追加
- [x] `app/schemas.py`: `BookmarkCreate`, `BookmarkUpdate`, `BookmarkResponse` への `note_html` の追加
- [x] `app/crud.py`: 保存・更新時にMarkdownをパースしサニタイズして `note_html` を生成する処理の追加
- [x] `app/templates/index.html` & `app/static/js/app.js`: クライアント側で `note_html` を安全に表示し、スタイリングする（Tailwind Typography などの軽いCSSを追加）

### 2. 🕸️ Phase 2: ビジュアル・ナレッジグラフ (ローカルグラフ方式)
- [x] `app/schemas.py`: グラフ描画用レスポンス（ノードとエッジ）のスキーマ定義
- [x] `app/crud.py`: 中心ブックマークからX階層以内の関連情報を抽出するクエリ作成
- [x] `app/main.py`: `/bookmarks/graph` および UI用 `GET /graph` ルートの追加
- [x] `app/templates/graph.html`: `vis-network` (CDN経由) を用いた軽量なグラフビュアー描画ロジックの作成
- [x] `app/templates/index.html`: グラフボタンの追加と遷移の実装

### 3. 🤖 Phase 3: AIによる自動タグ付け＆要約
- [x] `requirements.txt`: `google-generativeai` ライブラリの追加とインストール
- [x] `app/ai_helper.py`: ツイート本文からカテゴリ・タグ・要約をJSONで抽出するGemini呼び出しクラスの実装
- [x] `app/crud.py`: ブックマーク保存（非同期）時にAIヘルパーを呼び出して空の項目を埋める処理の追加

### 4. ✅ 検証
- [x] サーバー再起動と新機能の表示確認
- [x] Fly.io へのデプロイ準備と最終テスト
- [x] (Optional) Fly.io へのデプロイとリモートDBマイグレーションの実行
