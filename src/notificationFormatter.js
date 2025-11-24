import { DISCORD_SETTINGS } from './config.js';
import { TASK_STATUS, PROGRESS_STATUS, DISCORD_EMOJI, TASK_MARKERS } from './constants.js';
import { formatTimestampJST, isPastDate } from './utils/dateUtils.js';
import { truncate } from './utils/stringUtils.js';

const { MAX_CONTENT_LENGTH } = DISCORD_SETTINGS;

/**
 * スナップショットデータを Discord で扱いやすいスレッド投稿に変換する。
 * プレゼンテーション層として、ビジネスデータをDiscordメッセージ形式に整形する責務を持つ。
 */
export class NotificationFormatter {
  /**
   * スレッド新規作成時のメッセージを構築する。
   * タイトル直下はサマリー(更新日時、完了数、総数)のみを表示する。
   * @param {object} snapshot
   * @returns {{content: string, embeds: Array<object>}}
   */
  buildInitialMessage(snapshot) {
    const header = this.#buildSimpleHeader(snapshot);
    const embeds = [this.#buildSimpleSummaryEmbed(snapshot)];

    return {
      content: header,
      embeds
    };
  }

  /**
   * スレッド内に投稿する最新状況通知メッセージを構築する。
   * 実行時点のタスク一覧や不備情報を含んだ詳細ビューとなる。
   * @param {object} snapshot
   * @returns {{content: string, embeds: Array<object>}}
   */
  buildCurrentStatusMessage(snapshot) {
    const header = this.#buildHeader(snapshot);
    const embeds = [this.#buildSummaryEmbed(snapshot)];

    if (snapshot.invalidChildren?.length) {
      embeds.push(...this.#buildInvalidEmbeds(snapshot.invalidChildren));
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
    const formattedTimestamp = formatTimestampJST(timestamp);
    let header = '進捗サマリ\n';
    header += `${completion.percentage}% 完了 (${completion.done}/${completion.total})\n`;
    header += `最終更新日時: ${formattedTimestamp}`;
    return truncate(header, MAX_CONTENT_LENGTH);
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
   * 遅延時には設定されたユーザーIDにメンションを付ける。
   * @param {object} snapshot
   * @returns {string}
   * @private
   */
  #buildHeader(snapshot) {
    const { projectId, timestamp, completion } = snapshot;
    const progressStatus = this.#determineProgressStatus(snapshot.children);
    const formattedTimestamp = formatTimestampJST(timestamp);
    
    // 遅延時のメンション
    let header = '';
    if (progressStatus === PROGRESS_STATUS.DELAYED) {
      header += `<@${DISCORD_SETTINGS.NOTIFY_USER.ONDELAY}>\n`;
    }
    
    header += `進行状況：${progressStatus}\n`;
    header += `${completion.percentage}% 完了 (${completion.done}/${completion.total})\n`;
    header += `最終更新日時: ${formattedTimestamp}`;
    if (snapshot.invalidChildren?.length) {
      header += `\n${DISCORD_EMOJI.WARNING}警告: ${snapshot.invalidChildren.length} 件のタスクに入力不備があります。`;
    }
    return truncate(header, MAX_CONTENT_LENGTH);
  }

  /**
   * 完了以外のタスクの期限をチェックして、進行状況を判定する。
   * @param {Array<object>} children
   * @returns {string} 'オンスケ' または '遅延'
   * @private
   */
  #determineProgressStatus(children) {
    // 完了以外のタスクを抽出
    const incompleteTasks = children.filter((child) => child.status !== TASK_STATUS.COMPLETED);
    
    if (incompleteTasks.length === 0) {
      return PROGRESS_STATUS.ON_SCHEDULE;
    }

    // 期限が過ぎているタスクがあるかチェック
    const hasOverdueTasks = incompleteTasks.some((task) => isPastDate(task.dueDate));

    return hasOverdueTasks ? PROGRESS_STATUS.DELAYED : PROGRESS_STATUS.ON_SCHEDULE;
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

    const inProgressTasks = snapshot.children.filter((child) => child.status === TASK_STATUS.IN_PROGRESS);
    const taskLines = inProgressTasks.map((child) => this.#formatTaskLine(child)).join('\n');

    const description =
      inProgressTasks.length === 0
        ? '着手中のタスクはありません。'
        : truncate(taskLines, MAX_CONTENT_LENGTH);

    return {
      title: '着手中タスク一覧',
      description,
      fields
    };
  }

  /**
   * 必須項目が欠けているタスクを列挙し、データ修正を促す埋め込みを作る。
   * 各タスクごとに個別の埋め込みを生成する。
   * @param {Array<object>} invalidChildren
   * @returns {Array<object>}
   * @private
   */
  #buildInvalidEmbeds(invalidChildren) {
    return invalidChildren.map((item) => {
      const title = item.title || item.taskId || '不明';
      return {
        title: `タスク名: ${title}`,
        description: `不備内容: ${item.reason}`
      };
    });
  }

  /**
   * タスク情報を1行のテキストにフォーマットする。
   * @param {object} child - タスクオブジェクト
   * @returns {string}
   * @private
   */
  #formatTaskLine(child) {
    const markers = (child.markers || []).map((marker) => this.#markerLabel(marker)).join(' ');
    const dueText = child.dueDate ? `期限: ${child.dueDate}` : '期限未設定';
    const assignee = child.assignee || '担当未設定';
    const taskIdBold = '**' + child.taskId + '**';
    const parts = [markers, taskIdBold, child.title, assignee, dueText, child.status];
    const separator = ' / ';
    return parts.filter((p) => p).join(separator).trim();
  }

  /**
   * マーカー種別に応じた絵文字を返す。
   * @param {string} marker - マーカー種別
   * @returns {string}
   * @private
   */
  #markerLabel(marker) {
    if (marker === TASK_MARKERS.DEADLINE) {
      return DISCORD_EMOJI.WARNING;
    } else if (marker === TASK_MARKERS.STATUS_CHANGED) {
      return DISCORD_EMOJI.INFO;
    } else {
      return '';
    }
  }
}
