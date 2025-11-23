import { DISCORD_SETTINGS } from './config.js';

const { MAX_CONTENT_LENGTH } = DISCORD_SETTINGS;

/**
 * スナップショットデータを Discord で扱いやすいスレッド投稿に変換する。
 */
export class NotificationFormatter {
  /**
   * スレッド新規作成時のメッセージを構築する。
   * タイトル直下はサマリー（更新日時、完了数、総数）のみを表示する。
   * @param {object} snapshot
   * @returns {{content: string, embeds: Array<object>}}
   */
  buildInitialMessage(snapshot) {
    const header = this.#buildSimpleHeader(snapshot);
    // 詳細を含まないシンプルなEmbedのみを使用する
    const embeds = [this.#buildSimpleSummaryEmbed(snapshot)];

    return {
      content: header,
      embeds
    };
  }

  /**
   * スレッド更新時のメッセージを構築する。
   * @param {object} snapshot
   * @returns {{content: string, embeds: Array<object>}}
   */
  buildUpdateMessage(snapshot) {
    const header = this.#buildHeader(snapshot);
    const embeds = [this.#buildSummaryEmbed(snapshot)];

    if (snapshot.invalidChildren?.length) {
      embeds.push(this.#buildInvalidEmbed(snapshot.invalidChildren));
    }

    return {
      content: header,
      embeds
    };
  }

  /**
   * スナップショットの完了状況をヘッダー行にまとめる。
   * @param {object} snapshot
   * @returns {string}
   * @private
   */
  #buildSimpleHeader(snapshot) {
    const { projectId, timestamp, completion } = snapshot;
    let header = '進捗サマリ\n';
    header += `${completion.percentage}% 完了 (${completion.done}/${completion.total})\n`;
    header += `最終更新日時: ${timestamp}`;
    return header.slice(0, MAX_CONTENT_LENGTH);
  }

  /**
   * タスク詳細を含まず、集計値のみを表示するシンプルな埋め込みを生成する。
   * @param {object} snapshot
   * @returns {object}
   * @private
   */
  #buildSimpleSummaryEmbed(snapshot) {
    const fields = [
      { name: '総タスク', value: `${snapshot.completion.total}`, inline: true },
      { name: '完了', value: `${snapshot.completion.done}`, inline: true },
      { name: '未完了', value: `${snapshot.completion.total - snapshot.completion.done}`, inline: true }
    ];

    return {
      title: '',
      description: '',
      fields
    };
  }

  /**
   * スナップショットの完了状況をヘッダー行にまとめる。
   * @param {object} snapshot
   * @returns {string}
   * @private
   */
  #buildHeader(snapshot) {
    const { projectId, timestamp, completion } = snapshot;
    let header = `**${projectId}** — ${completion.percentage}% 完了 (${completion.done}/${completion.total})\n`;
    header += `最終同期: ${timestamp}`;
    if (snapshot.invalidChildren?.length) {
      header += `\n警告: ${snapshot.invalidChildren.length} 件のタスクに欠落項目があります。`;
    }
    return header.slice(0, MAX_CONTENT_LENGTH);
  }

  /**
   * 集計値とタスク行を載せた埋め込みを生成する。
   * @param {object} snapshot
   * @returns {object}
   * @private
   */
  #buildSummaryEmbed(snapshot) {
    const fields = [
      { name: '総タスク', value: `${snapshot.completion.total}`, inline: true },
      { name: '完了', value: `${snapshot.completion.done}`, inline: true },
      { name: '未完了', value: `${snapshot.completion.total - snapshot.completion.done}`, inline: true }
    ];

    const taskLines = snapshot.children.map((child) => this.#formatTaskLine(child)).join('\n');

    return {
      title: 'タスク一覧',
      description: taskLines.slice(0, MAX_CONTENT_LENGTH),
      fields
    };
  }

  /**
   * 必須項目が欠けているタスクを列挙し、データ修正を促す埋め込みを作る。
   * @param {Array<object>} invalidChildren
   * @returns {object}
   * @private
   */
  #buildInvalidEmbed(invalidChildren) {
    const content = invalidChildren.map((item) => `- ${item.taskId || '不明'}: ${item.reason}`).join('\n');
    return {
      title: '入力不備タスク',
      description: content.slice(0, MAX_CONTENT_LENGTH)
    };
  }

  /**
   * マーカー・担当者・期限・ステータスを含めて単一タスクの行を整形する。
   * @param {object} child
   * @returns {string}
   * @private
   */
  #formatTaskLine(child) {
    const markers = (child.markers || []).map((marker) => this.#markerLabel(marker)).join(' ');
    const dueText = child.dueDate ? `期限: ${child.dueDate}` : '期限未設定';
    return `${markers}**${child.taskId}** ${child.title} / ${child.assignee || '担当未設定'} / ${dueText} / ${child.status}`.trim();
  }

  /**
   * 差分マーカーを視覚的に分かる絵文字へ変換する。
   * @param {string} marker
   * @returns {string}
   * @private
   */
  #markerLabel(marker) {
    switch (marker) {
      case 'deadline':
        return ':warning:';
      case 'statusChanged':
        return ':information_source:';
      default:
        return '';
    }
  }
}
