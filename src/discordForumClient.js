const DEFAULT_BACKOFF_MS = [1000, 2000, 4000];

/**
 * Discord フォーラム API クライアント (Node.js fetch版)
 */
export function createDiscordForumClient({ botToken, forumChannelId } = {}) {
  if (!botToken) throw new Error('Discord Bot Token が設定されていません。');
  if (!forumChannelId) throw new Error('フォーラムチャンネルIDが設定されていません。');

  const BASE_URL = 'https://discord.com/api/v10';

  async function ensureThread({ threadId, payload }) {
    if (!threadId) {
      // 新規作成
      const url = `${BASE_URL}/channels/${forumChannelId}/threads`;
      // name のフォールバック
      const threadName = payload.name || (payload.content ? payload.content.slice(0, 50) : 'New Thread');
      
      const { body } = await requestWithRetry(url, {
        method: 'POST',
        body: JSON.stringify({
          name: threadName,
          auto_archive_duration: 10080,
          message: payload // { content, embeds }
        })
      });
      return { threadId: body.id, messageId: body.message?.id };
    }

    // 既存スレッドへの投稿
    const url = `${BASE_URL}/channels/${threadId}/messages`;
    await requestWithRetry(url, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return { threadId };
  }

  async function updateThreadMeta({ threadId, name }) {
    const url = `${BASE_URL}/channels/${threadId}`;
    const { body } = await requestWithRetry(url, {
      method: 'PATCH',
      body: JSON.stringify({ name })
    });
    return { threadId: body.id || threadId, name: body.name || name };
  }

  async function requestWithRetry(url, options, attempt = 0) {
    const finalOptions = {
      ...options,
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'DiscordBot (https://script.google.com, 1.0.0)', // VercelでもBot識別子は入れておく
        ...options.headers
      }
    };

    const response = await fetch(url, finalOptions);

    if (response.status === 429 && attempt < DEFAULT_BACKOFF_MS.length) {
      // Rate Limit
      await delay(DEFAULT_BACKOFF_MS[attempt]);
      return requestWithRetry(url, options, attempt + 1);
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

    // 204 No Content などの場合
    if (response.status === 204) {
      return { body: {} };
    }

    const body = await response.json().catch(() => ({}));
    return { body };
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  return {
    ensureThread,
    updateThreadMeta
  };
}

