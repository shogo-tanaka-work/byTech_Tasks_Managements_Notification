# byTech_Tasks_Managements_Notification
byTech 全般的なタスク管理に関するGAS

## `src/main.js` が提供する機能
- `createTimeTriggerOrchestrator({ taskService, discordClient, formatter, logger, carryOver })`  
  - TaskHierarchyService などの依存を注入し、`syncCycle({ limit })` を呼び出すだけで親子タスク → 通知までを処理します。
  - carry-over キューを渡さない場合はインメモリの簡易キューを使用します。

## GAS エントリーポイント例
Apps Script 側では以下のように依存を組み立てて `syncCycle` を公開し、GAS のトリガー設定画面から 30 分間隔で呼び出してください。

```javascript
function syncCycle() {
  const config = buildConfig(PropertiesService.getScriptProperties().getProperties());
  const repository = createSheetHierarchyRepository({
    spreadsheetApp: SpreadsheetApp,
    spreadsheetId: config.spreadsheetId
  });
  const progressService = createProgressSnapshotService({
    scriptProperties: PropertiesService.getScriptProperties()
  });
  const taskService = createTaskHierarchyService({ repository, progressService });
  const formatter = createNotificationFormatter();
  const discordClient = createDiscordForumClient({
    fetcher: UrlFetchApp,
    botToken: config.discord.botToken,
    forumChannelId: config.discord.forumChannelId
  });
  const orchestrator = createTimeTriggerOrchestrator({
    taskService,
    discordClient,
    formatter,
    logger: Logger
  });

  return orchestrator.syncCycle({ limit: config.limits.maxProjectsPerRun });
}
```

## GAS での運用手順
1. Script Properties（または Secrets Manager）へ以下キーを登録  
   `GAS_SPREADSHEET_ID`, `DISCORD_BOT_TOKEN`, `DISCORD_FORUM_CHANNEL_ID`,  
   `MAX_PROJECTS_PER_RUN`, `BATCH_INTERVAL_MINUTES(=30固定)`, `LOG_LEVEL`
2. Apps Script の「トリガー」設定画面から `syncCycle` 関数を 30 分間隔で実行するトリガーを登録する
3. 初回同期やパラメータ変更後は `syncCycle()` を手動実行して動作確認  
4. 運用中は Stackdriver ログで `sync_*` イベントを監視し、失敗時は Script Properties の値・Discord 権限を確認する
