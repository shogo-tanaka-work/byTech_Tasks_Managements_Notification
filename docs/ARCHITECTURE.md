# アーキテクチャ設計書

## システム概要

Google Sheets のプロジェクト・タスク管理データを Discord フォーラムスレッドに同期するシステム。

## レイヤーアーキテクチャ

```
┌─────────────────────────────────────────────┐
│           Entry Point (server.js)           │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│          Factory Layer (DI)                 │
│  - AppFactory: 依存性注入とインスタンス管理   │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│       Application Layer (フロー制御)         │
│  - Orchestrator: 全体の同期処理を統括        │
└───┬──────────────┬──────────────┬───────────┘
    │              │              │
    ▼              ▼              ▼
┌─────────┐  ┌──────────┐  ┌────────────┐
│ Domain  │  │Presentation│ │Infrastructure│
│  Layer  │  │   Layer   │ │    Layer    │
└─────────┘  └──────────┘  └────────────┘
```

## コンポーネント詳細

### Factory層
```javascript
AppFactory
  ├─ createOrchestrator()
  ├─ createTaskHierarchyService()
  ├─ createSheetRepository()
  ├─ createNotificationFormatter()
  └─ createDiscordForumClient()
```

**責務**: 全サービスの生成と依存関係の解決

---

### Application層
```javascript
Orchestrator
  ├─ run(): 同期処理の開始
  └─ #processSnapshot(): 各プロジェクトの処理
```

**責務**: 
- シートからのデータ取得
- Discord への投稿
- スレッドIDの保存
- エラーハンドリング

**依存**:
- TaskHierarchyService（ドメイン層）
- DiscordForumClient（インフラ層）
- NotificationFormatter（プレゼンテーション層）

---

### Domain層（ビジネスロジック）
```javascript
TaskHierarchyService
  ├─ buildProjectSnapshots(): プロジェクト情報を構築
  ├─ markThread(): スレッドIDを保存
  ├─ #buildSnapshotForParent(): 親子データの整形
  ├─ #partitionChildren(): タスクの検証と振り分け
  └─ #calculateCompletion(): 完了率の計算
```

**責務**:
- プロジェクトスナップショットの構築
- タスクのバリデーション
- 完了率の集計
- 無効データの検出

**依存**:
- SheetHierarchyRepository（インフラ層）
- 共通ユーティリティ（utils）
- 定数（constants）

---

### Presentation層（表示形式）
```javascript
NotificationFormatter
  ├─ buildInitialMessage(): 新規スレッド用メッセージ
  ├─ buildCurrentStatusMessage(): 更新通知メッセージ
  ├─ #buildHeader(): ヘッダー部分の構築
  ├─ #buildSummaryEmbed(): サマリー埋め込みの構築
  ├─ #determineProgressStatus(): 進捗判定
  ├─ #formatTaskLine(): タスク行のフォーマット
  └─ #markerLabel(): マーカー絵文字の取得
```

**責務**:
- Discord メッセージのフォーマット
- 進捗ステータスの判定
- Embed形式への変換

**依存**:
- 共通ユーティリティ（utils）
- 定数（constants）
- 設定（config）

---

### Infrastructure層（外部システム通信）

#### SheetHierarchyRepository
```javascript
SheetHierarchyRepository
  ├─ fetchHeaderLabels(): ヘッダー行の取得
  ├─ fetchParentRows(): 親プロジェクトの取得
  ├─ fetchChildRows(): 子タスクの取得
  ├─ updateThreadId(): スレッドIDの保存
  └─ #ensureDataLoaded(): データのキャッシュ
```

**責務**:
- Google Sheets API とのやり取り
- シートデータの読み込み
- スレッドIDの書き込み
- データのキャッシュ管理

**外部依存**:
- google-spreadsheet
- google-auth-library

---

#### DiscordForumClient
```javascript
DiscordForumClient
  ├─ ensureThread(): スレッドの作成/投稿
  ├─ updateThreadMeta(): スレッドメタ情報の更新
  ├─ editMessage(): メッセージの編集
  ├─ #requestWithRetry(): リトライ付きリクエスト
  └─ #delay(): 待機処理
```

**責務**:
- Discord API とのやり取り
- スレッドの作成と更新
- レート制限への対応（リトライ処理）

**外部依存**:
- Discord REST API v10

---

## 共通モジュール

### utils/ (共通ユーティリティ)

#### stringUtils.js
```javascript
- stringOrEmpty(value): 文字列正規化
- truncate(str, maxLength): 文字列の切り詰め
```

#### validationUtils.js
```javascript
- hasValue(value): 値の有無チェック
- getMissingFields(obj, fields): 欠損フィールドの検出
```

#### dateUtils.js
```javascript
- formatTimestampJST(timestamp): JST形式へのフォーマット
- isPastDate(dateValue): 過去日付チェック
- getCurrentTimestamp(): 現在時刻の取得
```

---

### constants.js (アプリケーション定数)
```javascript
- TASK_STATUS: タスクステータス定義
- PROGRESS_STATUS: 進捗ステータス定義
- DISCORD_EMOJI: Discord絵文字
- TASK_MARKERS: タスクマーカー
- REQUIRED_TASK_FIELDS: 必須フィールド定義
```

---

### config.js (環境設定)
```javascript
- PROJECT_SHEET_NAME: シート名
- PROJECT_COLUMNS: 列インデックス定義
- THREAD_ID_CELL_CONFIG: スレッドID列設定
- DISCORD_SETTINGS: Discord API設定
```

---

## データフロー

```
1. ユーザーがトリガーを実行
   ↓
2. AppFactory が各サービスを生成
   ↓
3. Orchestrator.run() が呼ばれる
   ↓
4. TaskHierarchyService がプロジェクトスナップショットを構築
   ├─ SheetHierarchyRepository から親行を取得
   ├─ SheetHierarchyRepository から子行を取得
   ├─ バリデーション実行（必須項目チェック）
   └─ 完了率を計算
   ↓
5. NotificationFormatter がメッセージを整形
   ↓
6. DiscordForumClient が Discord に投稿
   ├─ 新規: スレッド作成
   └─ 既存: メッセージ投稿
   ↓
7. TaskHierarchyService がスレッドIDを保存
   └─ SheetHierarchyRepository がシートに書き込み
   ↓
8. 結果をログに出力
```

## エラーハンドリング

```
┌────────────────────────────────────┐
│  Orchestrator (トップレベル)        │
│  - プロジェクトごとにtry-catch     │
│  - エラーログを収集                │
│  - 処理は継続                      │
└────────────────────────────────────┘
           │
           ▼
┌────────────────────────────────────┐
│  各サービス層                       │
│  - 入力パラメータの検証             │
│  - 例外をthrowして上位に伝播        │
└────────────────────────────────────┘
           │
           ▼
┌────────────────────────────────────┐
│  Infrastructure層                  │
│  - API通信エラー                   │
│  - リトライ処理（Discord）         │
│  - 例外をthrowして上位に伝播        │
└────────────────────────────────────┘
```

## 設定管理

### 環境変数（.env）
```
SPREADSHEET_ID=xxx
GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx
GOOGLE_PRIVATE_KEY=xxx
DISCORD_BOT_TOKEN=xxx
DISCORD_FORUM_CHANNEL_ID=xxx
```

### アプリケーション設定（config.js）
- シート構造の定義
- Discord API の設定
- リトライ設定

### アプリケーション定数（constants.js）
- ステータス値
- マーカー種別
- 必須フィールド

## 拡張ポイント

### 1. 新しい通知チャネルの追加
```javascript
// 例: Slack対応
class SlackClient {
  // DiscordForumClient と同じインターフェースを実装
}

// AppFactory に追加
createSlackClient() {
  // ...
}

// Orchestrator で使用
this.slackClient.postMessage(...);
```

### 2. カスタムバリデーションルールの追加
```javascript
// validationUtils.js に追加
export function validateCustomRule(obj) {
  // カスタムロジック
}

// TaskHierarchyService で使用
import { validateCustomRule } from './utils/validationUtils.js';
```

### 3. 新しいフォーマットの追加
```javascript
// NotificationFormatter に追加
buildDetailedReport(snapshot) {
  // 詳細レポート形式
}
```

## パフォーマンス考慮

### キャッシュ戦略
- **SheetHierarchyRepository**: 1リクエスト内でシートデータをキャッシュ
- **AppFactory**: リクエストスコープ内でサービスインスタンスをキャッシュ

### バッチ処理
- プロジェクトは順次処理（エラー時の影響を局所化）
- Discord API はリトライ機能付き

### リトライ戦略
- Discord API: 指数バックオフ（1秒 → 2秒 → 4秒）
- Google Sheets API: ライブラリのデフォルト動作に依存

## セキュリティ考慮

1. **認証情報の管理**
   - 環境変数で管理
   - コードにハードコードしない

2. **入力検証**
   - 必須フィールドのチェック
   - 型の検証

3. **エラーメッセージ**
   - 機密情報を含めない
   - ログに記録

## テスト戦略

### 単体テスト
- ユーティリティ関数（utils/）
- フォーマット処理（NotificationFormatter）
- バリデーション（TaskHierarchyService）

### 統合テスト
- Repository とサービスの連携
- Orchestrator の全体フロー

### モックの使用
```javascript
// Repository のモック
const mockRepo = {
  fetchParentRows: jest.fn(),
  fetchChildRows: jest.fn()
};

// サービスのテスト
const service = new TaskHierarchyService({ repository: mockRepo });
```

## デプロイメント

### Google Apps Script（GAS）での実行
1. clasp を使用してプッシュ
2. トリガーを設定
3. 環境変数（スクリプトプロパティ）を設定

### Node.js での実行
1. .env ファイルを準備
2. `npm install` で依存関係をインストール
3. `node server.js` で実行

## まとめ

このアーキテクチャは以下の原則に基づいて設計されています：

- **単一責任の原則**: 各クラスは1つの責務のみを持つ
- **依存性の逆転**: 上位レイヤーが下位レイヤーに依存
- **開放閉鎖の原則**: 拡張に開いていて、修正に閉じている
- **インターフェース分離**: 必要な機能のみを公開
- **DRY原則**: 重複を排除し、共通処理を集約

これにより、保守性・拡張性・テスト容易性が高いシステムとなっています。

