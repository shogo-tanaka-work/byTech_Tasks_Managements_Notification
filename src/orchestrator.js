import { createSheetHierarchyRepository } from './sheetRepository.js';
import { createProgressSnapshotService } from './progressSnapshotService.js';
import { createTaskHierarchyService } from './taskHierarchyService.js';
import { createNotificationFormatter } from './notificationFormatter.js';
import { createDiscordForumClient } from './discordForumClient.js';

const DEFAULT_THREAD_NAME_TEMPLATE = (snapshot) =>
  `${snapshot.projectId} | ${snapshot.completion?.percentage ?? 0}%`;

/**
 * 環境変数を元に依存関係を構築し、同期処理を実行する関数
 */
export async function runOrchestrator() {
  console.log('Initializing Orchestrator...');

  // 依存関係の構築
  const repository = createSheetHierarchyRepository({
    spreadsheetId: process.env.SPREADSHEET_ID,
    googleServiceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY
  });

  const progressService = createProgressSnapshotService();

  const taskService = createTaskHierarchyService({
    repository,
    progressService
  });

  const formatter = createNotificationFormatter();

  const discordClient = createDiscordForumClient({
    botToken: process.env.DISCORD_BOT_TOKEN,
    forumChannelId: process.env.DISCORD_FORUM_CHANNEL_ID
  });

  // 実行サイクル
  return await executeSyncCycle({ taskService, discordClient, formatter });
}

async function executeSyncCycle({ taskService, discordClient, formatter }) {
  // 1. 全プロジェクトのスナップショットを取得
  const snapshots = await taskService.buildProjectSnapshots();
  console.log(`処理対象プロジェクト数: ${snapshots.length}`);
  
  const results = {
    success: 0,
    failed: 0,
    errors: []
  };

  // 2. ループ処理
  for (const snapshot of snapshots) {
    console.log(`[Processing] ProjectID: ${snapshot.projectId}, shouldPost: ${snapshot.shouldPost}`);
    
    try {
      await processSnapshot(snapshot, { taskService, discordClient, formatter });
      results.success++;
    } catch (error) {
      console.error(`Project Error (ID: ${snapshot.projectId}):`, error);
      results.failed++;
      results.errors.push({ projectId: snapshot.projectId, message: error.message });
    }
  }
  
  return results;
}

async function processSnapshot(snapshot, { taskService, discordClient, formatter }) {
  // 投稿不要ならスキップ (未投稿の場合は強制実行)
  if (!snapshot.shouldPost && snapshot.threadId) {
    return;
  }

  // 送信データの作成
  const payload = formatter.buildThreadMessage(snapshot);
  // スレッド名付与
  payload.name = DEFAULT_THREAD_NAME_TEMPLATE(snapshot);

  // Discordへ送信（作成または更新）
  const threadInfo = await discordClient.ensureThread({
    threadId: snapshot.threadId,
    payload
  });

  const threadId = threadInfo.threadId || snapshot.threadId;

  // 新規スレッドIDが発行された場合はシートに書き戻す
  if (threadId && snapshot.rowIndex !== undefined && threadId !== snapshot.threadId) {
    await taskService.markThread({ rowIndex: snapshot.rowIndex, threadId });
  }

  // スレッド名の更新
  await discordClient.updateThreadMeta({
    threadId,
    name: DEFAULT_THREAD_NAME_TEMPLATE(snapshot)
  });

  // 完了状態の保存
  taskService.saveProgress(snapshot.projectId, snapshot.completion);

  console.log(`Sync done for: ${snapshot.projectId}`);
}

