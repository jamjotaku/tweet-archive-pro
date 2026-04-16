# [点検・修正プラン] TweetArchive Pro システム統合メンテナンス

最近の機能追加（グラフ表示、マークダウン対応、設定画面共通化）を踏まえ、システム全体の一斉点検とバグ修正、およびパフォーマンス改善を行います。

## User Review Required

> [!IMPORTANT]
> **パフォーマンス改善**: ブックマーク一覧の読み込み時に、カードごとに「関連リンク」を取得するリクエストが発生しており、表示が非常に重くなる可能性があります。これをバックエンド側で1つのリクエストにまとめるか、必要な場合のみ取得するよう変更します。

> [!WARNING]
> **未実装関数の修正**: HTML 上で呼び出されているのに JS に定義がない関数 (`batchSync`, `exportData`) を追加します。

## Proposed Changes

### 1. バックエンド (Python/FastAPI)

#### [MODIFY] [crud.py](file:///C:/Users/mogiy/.gemini/antigravity/scratch/tweet-archive-pro/app/crud.py)
- `search_bookmarks`: 戻り値を SQLAlchemy モデルのリスト、または辞書のリストに明示的に変換し、FastAPI のレスポンススキーマとの互換性を確保します。
- **[NEW]** `batch_delete_bookmarks`: 複数 ID を一括で削除する効率的な関数を追加。

#### [MODIFY] [main.py](file:///C:/Users/mogiy/.gemini/antigravity/scratch/tweet-archive-pro/app/main.py)
- 一括削除用のエンドポイントを追加。
- 検索結果の変換処理を確認・修正。

### 2. フロントエンド (JS/HTML/CSS)

#### [MODIFY] [app.js](file:///C:/Users/mogiy/.gemini/antigravity/scratch/tweet-archive-pro/app/static/js/app.js)
- **パフォーマンス最適化**: `buildCard` 内での個別フェッチを一時的に無効化、または一覧取得 API に含めるように修正。
- **未実装関数の追加**: `batchSync` と `exportData` のロジックを実装。
- **i18n の補完**: `btn_bookmark`, `select_at_least_two` などの不足キーを `ja`/`en` 両方に追加。
- **バグ修正**: ブックマークレットの URL を `window.location.origin` を使用した動的なものに変更。

#### [MODIFY] [index.html](file:///C:/Users/mogiy/.gemini/antigravity/scratch/tweet-archive-pro/app/templates/index.html)
- ブックマークレットの `href` を動的に設定するための ID を追加。

#### [MODIFY] [style.css](file:///C:/Users/mogiy/.gemini/antigravity/scratch/tweet-archive-pro/app/static/css/style.css)
- 以前の修正で追加されたトースト通知やバッチツールバーのスタイルが崩れていないか確認し、微調整。

### 3. その他

#### [UPDATE] [docs](file:///C:/Users/mogiy/.gemini/antigravity/scratch/tweet-archive-pro/docs/)
- 実装プランやタスクリストを最新の「点検完了」状態に更新。

## Open Questions

特にありません。

## Verification Plan

### Automated Tests
- `pytest` (もしあれば) を実行して API の不整合をチェック。
- 手動で `curl` またはブラウザツールを用いて一括削除・エクスポートをテスト。

### Manual Verification
- ホーム、プロフィール、グラフ各画面で JS エラーが出ていないかコンソールを確認。
- 「選択モード」での一括リンク・一括削除の動作確認。
- 検索機能で正常にヒットするか確認。
