/**
 * スレッド名のフォーマットテンプレート。
 * プロジェクトタイトルと進捗率を組み合わせて表示する。
 */
const DEFAULT_THREAD_NAME_TEMPLATE = (snapshot) =>
  `${snapshot.title} | ${snapshot.completion?.percentage ?? 0}%`;

/**
 * プロジェクト取得・Discord 投稿・状態保存まで、同期サイクル全体を連携させる。
 * アプリケーション層として、各サービスを組み合わせて全体フローを制御する。
 */
export class Orchestrator {
  constructor({ taskService, discordClient, formatter, logger = console } = {}) {
    if (!taskService || !discordClient || !formatter) {
      throw new Error('taskService, discordClient, formatter は必須です。');
    }
    this.taskService = taskService;
    this.discordClient = discordClient;
    this.formatter = formatter;
    this.logger = logger;
  }

  /**
   * サーバー／API から呼び出され、一度の同期処理を実行する入口。
   * 全プロジェクトのスナップショットを取得し、Discord への投稿を実行する。
   * @returns {Promise<{success: number, failed: number, errors: Array<object>}>} 処理結果サマリー
   */
  async run() {
    this.logger.log('Initializing Orchestrator...');
    return this.#executeSyncCycle();
  }

  /**
   * スナップショットを構築し処理しながら、成功・失敗などの統計を記録する。
   * エラーが発生した場合も処理を継続し、最終的に全体のサマリーを返す。
   * @returns {Promise<{success: number, failed: number, errors: Array<object>}>} 処理結果サマリー
   * @private
   */
  async #executeSyncCycle() {
    // ここでシートの読み込みが行われる。リアルタイム取得ではなく実行時点での内容となる。
    const snapshots = await this.taskService.buildProjectSnapshots();
    this.logger.log(`処理対象プロジェクト数: ${snapshots.length}`);

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const snapshot of snapshots) {
      this.logger.log(`[Processing] ProjectID: ${snapshot.projectId}`);
      try {
        await this.#processSnapshot(snapshot);
        results.success++;
      } catch (error) {
        this.logger.error(`Project Error (ID: ${snapshot.projectId}):`, error);
        results.failed++;
        results.errors.push({ projectId: snapshot.projectId, message: error.message });
      }
    }

    return results;
  }

  /**
   * Discord スレッドの確保・投稿・書き戻し・進捗保存までを一連で行う。
   * 新規スレッドの場合は作成してIDをシートに保存、既存スレッドの場合は更新を投稿する。
   * @param {object} snapshot - プロジェクトスナップショット
   * @returns {Promise<void>}
   * @private
   */
  async #processSnapshot(snapshot) {
    // 新規スレッド作成フロー。threadId がない場合は新規スレッドを作成する。
    if (!snapshot.threadId) {
      const payload = this.formatter.buildInitialMessage(snapshot);
      payload.name = DEFAULT_THREAD_NAME_TEMPLATE(snapshot);

      const threadInfo = await this.discordClient.ensureThread({
        threadId: null,
        payload
      });

      const threadId = threadInfo.threadId;
      if (threadId && Number.isInteger(snapshot.rowIndex)) {
        await this.taskService.markThread({ rowIndex: snapshot.rowIndex, threadId });
      }
      this.logger.log(`New thread created for: ${snapshot.projectId}`);
      return;
    }

    // 以降は既存スレッド更新フローとなる。
    // 1. スレッドタイトルとメインEmbed (Starter Message) を一括更新
    const threadName = DEFAULT_THREAD_NAME_TEMPLATE(snapshot);
    const initialPayload = this.formatter.buildInitialMessage(snapshot);

    await this.discordClient.updateThreadMeta({
      threadId: snapshot.threadId,
      name: threadName,
      payload: initialPayload
    });

    // 2. 進捗の有無に関わらず、毎回最新状況のメッセージを投稿する
    const updatePayload = this.formatter.buildCurrentStatusMessage(snapshot);
    await this.discordClient.ensureThread({
      threadId: snapshot.threadId,
      payload: updatePayload
    });

    this.logger.log(`Update posted for: ${snapshot.projectId}`);
  }
}
