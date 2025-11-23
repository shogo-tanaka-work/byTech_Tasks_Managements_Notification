import { SheetHierarchyRepository } from './SheetHierarchyRepository.js';
import { TaskHierarchyService } from './TaskHierarchyService.js';
import { NotificationFormatter } from './NotificationFormatter.js';
import { DiscordForumClient } from './DiscordForumClient.js';
import { Orchestrator } from './Orchestrator.js';

/**
 * 同期アプリに必要な依存関係を遅延初期化で束ね、ランタイム全体で一貫したインスタンスを提供する。
 * リクエストごとに生成されることを想定している。
 */
export class AppFactory {
  constructor({ env = process.env, logger = console } = {}) {
    this.env = env;
    this.logger = logger;
    // リクエストスコープ内でのシングルトンを保証するためのキャッシュ
    this.cache = new Map();
  }

  /**
   * シート読み込みと Discord 投稿を統括するオーケストレーターのインスタンスを返す。
   * @returns {Orchestrator}
   */
  createOrchestrator() {
    if (!this.cache.has('orchestrator')) {
      const orchestrator = new Orchestrator({
        taskService: this.createTaskHierarchyService(),
        discordClient: this.createDiscordForumClient(),
        formatter: this.createNotificationFormatter(),
        logger: this.logger
      });
      this.cache.set('orchestrator', orchestrator);
    }
    return this.cache.get('orchestrator');
  }

  /**
   * プロジェクトスナップショットを構築する TaskHierarchyService のインスタンスを返す。
   * @returns {TaskHierarchyService}
   */
  createTaskHierarchyService() {
    if (!this.cache.has('taskService')) {
      const service = new TaskHierarchyService({
        repository: this.createSheetRepository(),
        logger: this.logger
      });
      this.cache.set('taskService', service);
    }
    return this.cache.get('taskService');
  }

  /**
   * シートの読み書きを担う Google Sheets リポジトリを生成する。
   * @returns {SheetHierarchyRepository}
   */
  createSheetRepository() {
    if (!this.cache.has('sheetRepo')) {
      const repo = new SheetHierarchyRepository({
        spreadsheetId: this.#requireEnv('SPREADSHEET_ID'),
        serviceAccountEmail: this.#requireEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
        privateKey: this.#requireEnv('GOOGLE_PRIVATE_KEY'),
        logger: this.logger
      });
      this.cache.set('sheetRepo', repo);
    }
    return this.cache.get('sheetRepo');
  }

  /**
   * Discord 向けの投稿フォーマットを生成する NotificationFormatter を返す。
   * @returns {NotificationFormatter}
   */
  createNotificationFormatter() {
    if (!this.cache.has('formatter')) {
      this.cache.set('formatter', new NotificationFormatter());
    }
    return this.cache.get('formatter');
  }

  /**
   * 環境変数で与えられた認証情報を用いた Discord フォーラムクライアントを返す。
   * @returns {DiscordForumClient}
   */
  createDiscordForumClient() {
    if (!this.cache.has('discordClient')) {
      const client = new DiscordForumClient({
        botToken: this.#requireEnv('DISCORD_BOT_TOKEN'),
        forumChannelId: this.#requireEnv('DISCORD_FORUM_CHANNEL_ID'),
        logger: this.logger
      });
      this.cache.set('discordClient', client);
    }
    return this.cache.get('discordClient');
  }

  /**
   * 依存関係を組み立てる前に必要な環境変数が存在するかを検証する。
   * @param {string} key - 参照する環境変数名。
   * @returns {string}
   * @throws {Error} 変数が未設定の場合。
   */
  #requireEnv(key) {
    const value = this.env[key];
    if (!value) {
      throw new Error(`環境変数 ${key} が設定されていません。`);
    }
    return value;
  }
}
