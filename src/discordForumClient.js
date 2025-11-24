import { DISCORD_SETTINGS } from './config.js';

const { DEFAULT_BACKOFF_MS, API_BASE_URL, THREAD_AUTO_ARCHIVE_MINUTES } = DISCORD_SETTINGS;

/**
 * Discord フォーラムスレッドへスナップショットを投稿するための簡易 REST クライアント。
 * インフラストラクチャ層として、Discord API との通信を担当する。
 * レート制限対応のリトライ機能を内蔵。
 */
export class DiscordForumClient {
  constructor({ botToken, forumChannelId, baseUrl = API_BASE_URL, logger = console } = {}) {
    if (!botToken) {
      throw new Error('Discord Bot Token が設定されていません。');
    }
    if (!forumChannelId) {
      throw new Error('フォーラムチャンネルIDが設定されていません。');
    }

    this.botToken = botToken;
    this.forumChannelId = forumChannelId;
    this.baseUrl = baseUrl;
    this.logger = logger;
  }

  /**
   * threadId が無ければ新規スレッドを作成し、指定されていれば既存スレッドに投稿する。
   * @param {{threadId?: string, payload: object}} params
   * @returns {Promise<{threadId: string, messageId?: string}>}
   */
  async ensureThread({ threadId, payload }) {
    if (!threadId) {
      const url = `${this.baseUrl}/channels/${this.forumChannelId}/threads`;
      const threadName = payload.name || (payload.content ? payload.content.slice(0, 50) : 'New Thread');
      const { body } = await this.#requestWithRetry(url, {
        method: 'POST',
        body: JSON.stringify({
          name: threadName,
          auto_archive_duration: THREAD_AUTO_ARCHIVE_MINUTES,
          message: payload
        })
      });
      return { threadId: body.id, messageId: body.message?.id };
    }

    const url = `${this.baseUrl}/channels/${threadId}/messages`;
    await this.#requestWithRetry(url, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return { threadId };
  }

  /**
   * Discord スレッドのメタ情報（進捗を示す名前など）と、必要に応じて開始メッセージを更新する。
   * @param {{threadId: string, name?: string, payload?: object}} params
   * @returns {Promise<{threadId: string, name: string}>}
   */
  async updateThreadMeta({ threadId, name, payload }) {
    // 1. スレッド名の更新
    let currentName = name;
    if (name) {
      const url = `${this.baseUrl}/channels/${threadId}`;
      const { body } = await this.#requestWithRetry(url, {
        method: 'PATCH',
        body: JSON.stringify({ name })
      });
      currentName = body.name || name;
    }

    // 2. 開始メッセージの更新 (payload が指定されている場合)
    if (payload) {
      // Forum Thread では通常 Starter Message ID = Thread ID とみなして更新する
      // 失敗してもログに残してスレッド名の更新結果は返す
      try {
        const messageUrl = `${this.baseUrl}/channels/${threadId}/messages/${threadId}`;
        await this.#requestWithRetry(messageUrl, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
      } catch (error) {
        this.logger.warn(`Failed to update starter message for thread ${threadId}: ${error.message}`);
      }
    }

    return { threadId, name: currentName };
  }

  /**
   * 指定したメッセージを編集する。
   * @param {{channelId: string, messageId: string, payload: object}} params
   * @returns {Promise<{id: string}>}
   */
  async editMessage({ channelId, messageId, payload }) {
    const url = `${this.baseUrl}/channels/${channelId}/messages/${messageId}`;
    const { body } = await this.#requestWithRetry(url, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    return body;
  }

  /**
   * Discord 用ヘッダーを付与しつつ HTTP リクエストを実行し、429（レート制限）の際は指数バックオフでリトライする。
   * @param {string} url - リクエストURL
   * @param {RequestInit} options - fetch オプション
   * @param {number} [attempt=0] - 現在のリトライ回数
   * @returns {Promise<{body: any}>} レスポンスボディ
   * @throws {Error} リトライ上限到達時、または4xx/5xxエラー時
   * @private
   */
  async #requestWithRetry(url, options, attempt = 0) {
    const finalOptions = {
      ...options,
      headers: {
        Authorization: `Bot ${this.botToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'DiscordBot (https://script.google.com, 1.0.0)',
        ...options.headers
      }
    };

    const response = await fetch(url, finalOptions);

    if (response.status === 429 && attempt < DEFAULT_BACKOFF_MS.length) {
      await this.#delay(DEFAULT_BACKOFF_MS[attempt]);
      return this.#requestWithRetry(url, options, attempt + 1);
    }

    if (!response.ok) {
      let errorBody;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text();
      }
      throw new Error(`Discord API Error: ${response.status} ${JSON.stringify(errorBody)}`);
    }

    if (response.status === 204) {
      return { body: {} };
    }

    const body = await response.json().catch(() => ({}));
    return { body };
  }

  /**
   * リトライ用のバックオフ待機を行う簡易ディレイ。
   * @param {number} ms - 待機するミリ秒数
   * @returns {Promise<void>}
   * @private
   */
  #delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
