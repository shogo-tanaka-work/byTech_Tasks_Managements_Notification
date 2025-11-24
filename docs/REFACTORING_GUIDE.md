# リファクタリングガイド

## 概要

このドキュメントでは、プロジェクトに対して実施したリファクタリングの詳細と、今後のメンテナンスのためのガイドラインを説明します。

## リファクタリングの目的

1. **共通処理の集約**: 各ファイルで重複していた処理を共通ユーティリティとして抽出
2. **定数の一元管理**: マジックナンバーやステータス値を定数化し、保守性を向上
3. **責務の明確化**: 各クラスの役割をレイヤー別に整理し、可読性を向上
4. **パラメータ調整の容易化**: 設定値を config.js と constants.js に集約

## ディレクトリ構造

```
src/
├── utils/                      # 共通ユーティリティ
│   ├── stringUtils.js          # 文字列処理
│   ├── validationUtils.js      # バリデーション処理
│   └── dateUtils.js            # 日付処理
├── constants.js                # アプリケーション定数
├── config.js                   # 設定値（シート構造、Discord設定など）
├── SheetHierarchyRepository.js # Infrastructure層: Google Sheets通信
├── DiscordForumClient.js       # Infrastructure層: Discord API通信
├── TaskHierarchyService.js     # Domain層: ビジネスロジック
├── NotificationFormatter.js    # Presentation層: メッセージフォーマット
├── Orchestrator.js             # Application層: フロー制御
└── AppFactory.js               # Factory層: 依存性注入
```

## レイヤーアーキテクチャ

### 1. Infrastructure層（インフラストラクチャ層）
外部システムとの通信を担当。

- **SheetHierarchyRepository**: Google Sheets API とのやり取り
- **DiscordForumClient**: Discord API とのやり取り

### 2. Domain層（ドメイン層）
ビジネスロジックを実装。

- **TaskHierarchyService**: プロジェクトスナップショットの構築、検証、集計

### 3. Presentation層（プレゼンテーション層）
データの表示形式を担当。

- **NotificationFormatter**: Discord メッセージのフォーマット作成

### 4. Application層（アプリケーション層）
各レイヤーを組み合わせて全体フローを制御。

- **Orchestrator**: 同期処理全体のオーケストレーション

### 5. Factory層（ファクトリ層）
依存性の注入とインスタンス管理。

- **AppFactory**: サービスの生成と依存関係の解決

## 共通ユーティリティ

### stringUtils.js
文字列処理に関する共通関数。

```javascript
import { stringOrEmpty, truncate } from './utils/stringUtils.js';

const trimmedValue = stringOrEmpty(cellValue);
const shortText = truncate(longText, 100);
```

### validationUtils.js
バリデーション処理に関する共通関数。

```javascript
import { hasValue, getMissingFields } from './utils/validationUtils.js';

if (hasValue(task.title)) {
  // 処理
}

const missing = getMissingFields(task, ['title', 'dueDate']);
```

### dateUtils.js
日付処理に関する共通関数。

```javascript
import { formatTimestampJST, isPastDate, getCurrentTimestamp } from './utils/dateUtils.js';

const formatted = formatTimestampJST(new Date());
const isOverdue = isPastDate(task.dueDate);
const now = getCurrentTimestamp();
```

## 定数管理

### constants.js
アプリケーション全体で使用される定数。

```javascript
import { TASK_STATUS, PROGRESS_STATUS, DISCORD_EMOJI, TASK_MARKERS, REQUIRED_TASK_FIELDS } from './constants.js';

// タスクステータスの使用例
if (task.status === TASK_STATUS.COMPLETED) {
  // 完了済み処理
}

// 進捗ステータスの使用例
const status = hasOverdue ? PROGRESS_STATUS.DELAYED : PROGRESS_STATUS.ON_SCHEDULE;
```

**定義されている定数:**
- `TASK_STATUS`: タスクのステータス（未着手、着手中、完了、保留）
- `PROGRESS_STATUS`: プロジェクトの進行状況（オンスケ、遅延）
- `DISCORD_EMOJI`: Discord メッセージで使用する絵文字
- `TASK_MARKERS`: タスクのマーカー種別（期限、ステータス変更）
- `REQUIRED_TASK_FIELDS`: タスクの必須フィールド

### config.js
環境依存の設定値とシート構造定義。

```javascript
import { PROJECT_SHEET_NAME, PROJECT_COLUMNS, THREAD_ID_CELL_CONFIG, DISCORD_SETTINGS } from './config.js';
```

**設定内容:**
- `PROJECT_SHEET_NAME`: シート名
- `PROJECT_COLUMNS`: 列インデックス定義（0-based）
- `THREAD_ID_CELL_CONFIG`: スレッドID列の更新設定
- `DISCORD_SETTINGS`: Discord API設定（URL、リトライ設定など）

## パラメータ調整ガイド

### シート構造を変更する場合

**config.js の `PROJECT_COLUMNS` を更新:**

```javascript
export const PROJECT_COLUMNS = {
  PROJECT_ID: 1,      // B列
  PROJECT_TITLE: 2,   // C列
  OWNER: 3,           // D列
  THREAD_ID: 9,       // J列
  TASK_ID: 10,        // K列
  TASK_TITLE: 11,     // L列
  DUE_DATE: 14,       // O列
  STATUS: 15,         // P列
  COMPLETED_AT: 16,   // Q列
  NOTES: 17           // R列
};
```

### Discord メッセージのフォーマットを変更する場合

**NotificationFormatter.js の該当メソッドを編集:**

- `buildInitialMessage()`: 新規スレッド作成時のメッセージ
- `buildCurrentStatusMessage()`: 進捗更新時のメッセージ
- `#buildHeader()`: ヘッダー部分
- `#buildSummaryEmbed()`: サマリー埋め込み

### タスクのステータス値を変更する場合

**constants.js の `TASK_STATUS` を更新:**

```javascript
export const TASK_STATUS = {
  NOT_STARTED: '未着手',
  IN_PROGRESS: '着手中',
  COMPLETED: '完了',
  ON_HOLD: '保留'
};
```

### Discord 通知のユーザーIDを変更する場合

**config.js の `DISCORD_SETTINGS.NOTIFY_USER` を更新:**

```javascript
export const DISCORD_SETTINGS = {
  // ...
  NOTIFY_USER: {
    ONDELAY: 'YOUR_DISCORD_USER_ID'
  }
};
```

### リトライ設定を変更する場合

**config.js の `DEFAULT_BACKOFF_MS` を更新:**

```javascript
export const DISCORD_SETTINGS = {
  // ...
  DEFAULT_BACKOFF_MS: [1000, 2000, 4000], // ミリ秒単位
};
```

### 必須フィールドを変更する場合

**constants.js の `REQUIRED_TASK_FIELDS` を更新:**

```javascript
export const REQUIRED_TASK_FIELDS = ['taskId', 'title', 'dueDate', 'status'];
```

## 変更履歴

### 2025-11-24: 初回リファクタリング

#### 追加されたファイル
- `src/utils/stringUtils.js`
- `src/utils/validationUtils.js`
- `src/utils/dateUtils.js`
- `src/constants.js`

#### 変更されたファイル
- `src/config.js`: スレッドID更新設定を追加
- `src/SheetHierarchyRepository.js`: 共通ユーティリティを使用するように変更
- `src/NotificationFormatter.js`: 共通ユーティリティと定数を使用するように変更
- `src/TaskHierarchyService.js`: 共通ユーティリティと定数を使用するように変更
- `src/DiscordForumClient.js`: コメントを改善
- `src/Orchestrator.js`: コメントを改善

#### 主な改善点
1. 文字列正規化処理（`#stringOrEmpty`）を `stringUtils.js` に集約
2. バリデーション処理（`#hasValue`）を `validationUtils.js` に集約
3. 日付フォーマット処理を `dateUtils.js` に集約
4. マジックナンバー（9, 10など）を config の定数に置き換え
5. ステータス値（'完了', '着手中'など）を定数化
6. 各クラスにレイヤーの説明コメントを追加

## ベストプラクティス

### 1. 新しい共通処理を追加する場合
- 3つ以上のファイルで使われる処理は `utils/` に抽出する
- 適切なファイルに配置（文字列 → stringUtils、日付 → dateUtils）
- JSDoc コメントを必ず記述する

### 2. 新しい定数を追加する場合
- アプリケーション全体で使う定数は `constants.js` に追加
- 環境依存や設定値は `config.js` に追加
- 意味のある名前を付ける（UPPER_SNAKE_CASE）

### 3. 新しいサービスを追加する場合
- 適切なレイヤーに配置する
- 依存性は AppFactory で注入する
- 単一責任の原則に従う

### 4. テストを書く場合
- ユーティリティ関数から優先的にテストを書く
- モックを活用してレイヤーごとに独立してテスト可能にする

## トラブルシューティング

### 列インデックスがずれている
→ `config.js` の `PROJECT_COLUMNS` を確認してください。

### ステータス判定が正しく動作しない
→ `constants.js` の `TASK_STATUS` とシートの実際の値が一致しているか確認してください。

### Discord メッセージが意図したフォーマットにならない
→ `NotificationFormatter.js` のメソッドと `constants.js` の設定を確認してください。

## 今後の拡張性

このリファクタリングにより、以下の拡張が容易になりました：

1. **新しい通知チャネルの追加**: `NotificationFormatter` のインターフェースを統一すれば、Slack など他のチャネルにも対応可能
2. **バリデーションルールの拡張**: `validationUtils.js` にルールを追加するだけで対応可能
3. **シート構造の変更**: `config.js` の `PROJECT_COLUMNS` を更新するだけで対応可能
4. **ステータスの追加**: `constants.js` に定義を追加するだけで対応可能
5. **テストの追加**: レイヤーが分離されているため、各レイヤーごとに独立してテスト可能

## まとめ

今回のリファクタリングにより、コードの保守性、可読性、拡張性が大幅に向上しました。今後の開発では、このガイドラインに従って変更を加えることで、一貫性のある高品質なコードベースを維持できます。

