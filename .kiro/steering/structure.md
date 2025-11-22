# プロジェクト構造

## 組織方針

Apps Script プロジェクトを「トリガー層」「サービス層」「データアクセス層」に分け、ロジックをモジュール化します。`clasp` でローカル管理する際は `src/` 配下に `.gs/.ts` を置き、ビルド済みコードのみをデプロイします。

## ディレクトリパターン

### サービスロジック
**Location**: `src/services/`
**Purpose**: タスク集計、ステータス更新、通知本文生成など純粋なビジネスロジックを保持します。
**Example**: `src/services/taskService.gs` はシートの行データを `TaskRecord` に変換し、通知対象かどうかを判定する関数群を提供。

### トリガーエントリ
**Location**: `src/triggers/`
**Purpose**: Apps Script の `onOpen`, `timeDriven`, `webhook` など公開関数をまとめ、サービス層を呼び出します。
**Example**: `src/triggers/timeDriven.gs` で `main()` を定義し、`TaskReminder.run()` を呼ぶだけに留める。

### インテグレーション/ゲートウェイ
**Location**: `src/integrations/`
**Purpose**: Gmail、Chat、Spreadsheet など外部サービス呼び出しをラップし、サービス層からは抽象 API だけを見せます。
**Example**: `src/integrations/chatNotifier.gs` が Chat Webhook URL を Secrets／Properties から取得して POST を実行。

### 設定ファイル
**Location**: `appsscript.json`, `.clasp.json`, `config/`
**Purpose**: デプロイ設定、スクリプト ID、スコープ宣言を保持します。
**Example**: `appsscript.json` に `timeDriven` トリガーを宣言し、`oauthScopes` を最小化。

## 命名規約

- **ファイル**: 機能 + 層を示す PascalCase／camelCase (`TaskService.gs`, `TimeDriven.gs`)。
- **クラス/オブジェクト**: PascalCase (`TaskReminder`)。
- **関数**: camelCase (`loadPendingTasks`)。
- **定数**: `SCREAMING_SNAKE_CASE` (`DEFAULT_REMINDER_TEMPLATE`)。

## インポート/公開規約

Apps Script では `import` が使えないため、IIFE もしくは名前空間オブジェクトでスコープを区切ります。

```javascript
const TaskReminder = (() => {
  const fetchTasks = () => TaskRepository.listOpen();

  const notify = () => {
    const tasks = fetchTasks();
    ChatNotifier.bulkNotify(tasks);
  };

  return { notify };
})();

function timeDrivenTrigger() {
  TaskReminder.notify();
}
```

## コード運用原則

- 公開関数 (Triggers) からは 1 つのサービス API を呼び出すだけにして、副作用の範囲を限定します。
- Spreadsheet アクセスは Repository モジュール経由に統一し、直接 `SpreadsheetApp` を呼ぶのは禁止します。
- 通知テンプレートは `src/templates/` に分離し、文字列連結ではなくプレースホルダ置換で管理します。
- Secrets/設定値は `PropertiesService` や `.clasp.json` で管理し、コード内にハードコードしない方針です。

---
_まだコードが存在しないため、上記パターンはプロジェクト初期化時の基準として活用してください_
