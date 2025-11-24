import { DISCORD_SETTINGS } from './config.js';

const { MAX_CONTENT_LENGTH } = DISCORD_SETTINGS;

/**
 * スナップショットデータを Discord で扱いやすいスレッド投稿に変換する。
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
    const formattedTimestamp = this.#formatTimestampJST(timestamp);
    let header = '進捗サマリ\n';
    header += `${completion.percentage}% 完了 (${completion.done}/${completion.total})\n`;
    header += `最終更新日時: ${formattedTimestamp}`;
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
   * 遅延時には設定されたユーザーIDにメンションを付ける。
   * @param {object} snapshot
   * @returns {string}
   * @private
   */
  #buildHeader(snapshot) {
    const { projectId, timestamp, completion } = snapshot;
    const progressStatus = this.#determineProgressStatus(snapshot.children);
    const formattedTimestamp = this.#formatTimestampJST(timestamp);
    
    // 遅延時のメンション
    let header = '';
    if (progressStatus === '遅延') {
      header += `<@${DISCORD_SETTINGS.NOTIFY_USER.ONDELAY}>\n`;
    }
    
    header += `進行状況：${progressStatus}\n`;
    header += `${completion.percentage}% 完了 (${completion.done}/${completion.total})\n`;
    header += `最終更新日時: ${formattedTimestamp}`;
    if (snapshot.invalidChildren?.length) {
      header += `\n⚠️警告: ${snapshot.invalidChildren.length} 件のタスクに入力不備があります。`;
    }
    return header.slice(0, MAX_CONTENT_LENGTH);
  }

  /**
   * 完了以外のタスクの期限をチェックして、進行状況を判定する。
   * @param {Array<object>} children
   * @returns {string} 'オンスケ' または '遅延'
   * @private
   */
  #determineProgressStatus(children) {
    // 完了以外のタスクを抽出
    const incompleteTasks = children.filter((child) => child.status !== '完了');
    
    if (incompleteTasks.length === 0) {
      return 'オンスケ';
    }

    // 今日の日付（時刻を00:00:00にして比較）
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 期限が過ぎているタスクがあるかチェック
    const hasOverdueTasks = incompleteTasks.some((task) => {
      if (!task.dueDate) {
        return false; // 期限未設定のタスクは遅延判定に含めない
      }

      const dueDate = new Date(task.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      
      // 期限が今日より前（当日は含まない）
      return dueDate < today;
    });

    return hasOverdueTasks ? '遅延' : 'オンスケ';
  }

  /**
   * タイムスタンプをJST（日本標準時）で「YYYY/MM/DD HH:mm:ss」形式にフォーマットする。
   * @param {string} timestamp - ISO 8601形式のタイムスタンプ
   * @returns {string} フォーマットされた日時文字列
   * @private
   */
  #formatTimestampJST(timestamp) {
    const date = new Date(timestamp);
    
    // JSTに変換（UTC+9）
    const jstDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    
    const year = jstDate.getFullYear();
    const month = String(jstDate.getMonth() + 1).padStart(2, '0');
    const day = String(jstDate.getDate()).padStart(2, '0');
    const hours = String(jstDate.getHours()).padStart(2, '0');
    const minutes = String(jstDate.getMinutes()).padStart(2, '0');
    const seconds = String(jstDate.getSeconds()).padStart(2, '0');
    
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
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

    const inProgressTasks = snapshot.children.filter((child) => child.status === '着手中');
    const taskLines = inProgressTasks.map((child) => this.#formatTaskLine(child)).join('\n');

    const description =
      inProgressTasks.length === 0
        ? '着手中のタスクはありません。'
        : taskLines.slice(0, MAX_CONTENT_LENGTH);

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

  #formatTaskLine(child) {
    const markers = (child.markers || []).map((marker) => this.#markerLabel(marker)).join(' ');
    const dueText = child.dueDate ? `期限: ${child.dueDate}` : '期限未設定';
    const assignee = child.assignee || '担当未設定';
    const taskIdBold = '**' + child.taskId + '**';
    const parts = [markers, taskIdBold, child.title, assignee, dueText, child.status];
    const separator = ' / ';
    return parts.filter(p => p).join(separator).trim();
  }

  #markerLabel(marker) {
    if (marker === 'deadline') {
      return ':warning:';
    } else if (marker === 'statusChanged') {
      return ':information_source:';
    } else {
      return '';
    }
  }
}
