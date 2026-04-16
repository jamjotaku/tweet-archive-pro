# タスク: システム一斉点検 & 安定化

- [x] **Phase 1: バックエンドの強化**
    - [x] `crud.py`: `batch_delete_bookmarks` の実装
    - [x] `main.py`: 一括削除 API エンドポイントの追加
    - [x] `crud.py`: `search_bookmarks` の戻り値形式の修正 (FastAPI互換)
- [x] **Phase 2: フロントエンドのパフォーマンス & 機能補完**
    - [x] `app.js`: `buildCard` 内の個別フェッチを最適化（バッチ化検討または遅延読み込み）
    - [x] `app.js`: `batchSync`, `batchDelete`, `exportData` の実装
    - [x] `app.js`: i18n 翻訳キーの補完 (`btn_bookmark`, `select_at_least_two` 等)
    - [x] `app.js` & `index.html`: ブックマークレット URL の動的化
- [x] **Phase 3: UI/UX & 安定性チェック**
    - [x] `style.css`: トーストやツールバーのスタイル調整
    - [x] 各ページ（ホーム、プロフィール、グラフ）のレスポンシブ動作確認
    - [x] 最終動作検証とデプロイ
