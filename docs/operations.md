# 運用メモ: TaskThreadSync Service 設定

## 必須設定値
以下のキーを Apps Script の Script Properties（または Secrets Manager）に登録し、ローカルの `タスク管理シート_開発用.xlsx` は参照しない。

| キー | 概要 |
| --- | --- |
| `GAS_SPREADSHEET_ID` | 本番タスク管理シートのファイル ID。運用環境のみ有効。 |
| `DISCORD_BOT_TOKEN` | Discord Bot のトークン。平文でリポジトリに置かない。 |
| `DISCORD_FORUM_CHANNEL_ID` | 通知先のフォーラムチャンネル ID。プロジェクトIDごとにスレッドが作成される。 |
| `MAX_PROJECTS_PER_RUN` | 1 回のバッチで処理するプロジェクト上限。既定値 50。 |
| `BATCH_INTERVAL_MINUTES` | 30 固定。ポリシーにより変更不可。 |
| `LOG_LEVEL` | `info` または `debug`。未設定時は `info`。 |

## 30 分バッチポリシー
- Apps Script の installable trigger は `everyMinutes(30)` を上限とし、onEdit などイベント駆動トリガーは採用しない。
- シート更新ごとにトリガーする構成は、Apps Script 実行時間制限や Discord API 連携の複雑さを増すため禁止する。
- 例外が必要な場合は運用レビューで承認を得るまで設定を変更しないこと。

## トリガー設定手順（概要）
1. `setupTrigger()` を一度実行して 30 分トリガーを登録する。既存トリガーがある場合は削除してから再登録する。
2. `syncCycle()` のログを Stackdriver で監視し、遅延や失敗を検知する。
3. トークン／IDのローテーション時は Script Properties を更新してから `syncCycle()` を手動実行し、エラーが出ないことを確認する。

