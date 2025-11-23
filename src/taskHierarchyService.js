/**
 * リポジトリのデータから正規化されたプロジェクトスナップショットを構築し、完了状況を集計する。
 */
export class TaskHierarchyService {
  constructor({
    repository,
    diffDetector = {},
    clock = () => new Date().toISOString(),
    logger = console
  } = {}) {
    if (!repository) {
      throw new Error('repository が指定されていません。');
    }

    this.repository = repository;
    this.diffDetector = diffDetector;
    this.clock = clock;
    this.logger = logger;
    this.requiredChildFields = ['taskId', 'title', 'dueDate', 'status'];
  }

  /**
   * 指定されたカーソル範囲内でプロジェクトスナップショットを構築する。
   * @param {{cursor?: number, limit?: number}} [options]
   * @returns {Promise<Array<object>>}
   */
  async buildProjectSnapshots({ cursor = 0, limit = Infinity } = {}) {
    const parents = await this.repository.fetchParentRows({ cursor, limit });
    if (!parents?.length) {
      return [];
    }
    return Promise.all(parents.map((parent) => this.#buildSnapshotForParent(parent)));
  }

  /**
   * Discord スレッド ID をスプレッドシートへ書き戻す。
   * @param {{rowIndex: number, threadId: string}} params
   * @returns {Promise<void>}
   */
  async markThread({ rowIndex, threadId }) {
    if (!Number.isInteger(rowIndex)) {
      throw new Error('rowIndex は整数で指定してください。');
    }
    if (!threadId) {
      throw new Error('threadId を指定してください。');
    }
    return this.repository.updateThreadId({ rowIndex, threadId });
  }

  /**
   * 親子データに検証結果と完了メトリクスを付与する。
   * @param {object} parentRow
   * @returns {Promise<object>}
   * @private
   */
  async #buildSnapshotForParent(parentRow) {
    const rawChildren = (await this.repository.fetchChildRows(parentRow.projectId)) || [];
    const { validChildren, invalidChildren } = this.#partitionChildren(rawChildren);

    const annotatedChildren = validChildren.map((child) => ({
      ...child,
      markers: this.diffDetector.diff?.(parentRow.projectId, child) ?? []
    }));

    const completion = this.#calculateCompletion(annotatedChildren);

    return {
      rowIndex: parentRow.rowIndex,
      projectId: parentRow.projectId,
      title: parentRow.title,
      owner: parentRow.owner,
      threadId: parentRow.threadId,
      timestamp: this.clock(),
      completion,
      children: annotatedChildren,
      invalidChildren
    };
  }

  /**
   * 必須項目の有無で子タスクを有効／無効に振り分ける。
   * @param {Array<object>} children
   * @returns {{validChildren: Array<object>, invalidChildren: Array<object>}}
   * @private
   */
  #partitionChildren(children) {
    const validChildren = [];
    const invalidChildren = [];

    children.forEach((child) => {
      const missing = this.requiredChildFields.filter((field) => !this.#hasValue(child[field]));
      if (missing.length) {
        invalidChildren.push({
          taskId: child.taskId || '不明',
          reason: `${missing.join(', ')} が未入力です。`
        });
        return;
      }
      validChildren.push(child);
    });

    return { validChildren, invalidChildren };
  }

  /**
   * トリム後に有効な値が入っているかを判定する。
   * @param {*} value
   * @returns {boolean}
   * @private
   */
  #hasValue(value) {
    if (value === null || value === undefined) {
      return false;
    }
    return String(value).trim().length > 0;
  }

  /**
   * 子タスクを集計して完了メトリクスを算出する。
   * 以前は ProgressSnapshotService に存在していた calculate ロジックを統合している。
   * @param {Array<object>} children
   * @returns {{total: number, done: number, percentage: number, updatedAt: string}}
   * @private
   */
  #calculateCompletion(children = []) {
    const total = children.length;
    const done = children.filter((child) => child.status === '完了').length;
    const percentage = total === 0 ? 0 : Math.round((done / total) * 100);
    return {
      total,
      done,
      percentage,
      updatedAt: this.clock()
    };
  }
}
