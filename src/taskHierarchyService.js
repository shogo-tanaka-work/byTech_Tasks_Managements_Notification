import { TASK_STATUS, REQUIRED_TASK_FIELDS } from './constants.js';
import { getMissingFields } from './utils/validationUtils.js';
import { getCurrentTimestamp } from './utils/dateUtils.js';

/**
 * リポジトリのデータから正規化されたプロジェクトスナップショットを構築し、完了状況を集計する。
 * ドメイン層として、ビジネスロジック（検証、集計）を担当する。
 */
export class TaskHierarchyService {
  constructor({
    repository,
    diffDetector = {},
    clock = getCurrentTimestamp,
    logger = console
  } = {}) {
    if (!repository) {
      throw new Error('repository が指定されていません。');
    }

    this.repository = repository;
    this.diffDetector = diffDetector;
    this.clock = clock;
    this.logger = logger;
    this.requiredChildFields = REQUIRED_TASK_FIELDS;
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

    // 1行目のヘッダー表示名を取得（取得できなければ null）
    const headerLabels = (await this.repository.fetchHeaderLabels?.()) || null;

    const { validChildren, invalidChildren } = this.#partitionChildren(rawChildren, headerLabels);

    const annotatedChildren = validChildren.map((child) => ({
      ...child,
      markers: this.diffDetector.diff?.(parentRow.projectId, child) ?? []
    }));
    // 進捗率は入力不備タスクも含めた「全タスク（rawChildren）」を母数として計算する
    const completion = this.#calculateCompletion(rawChildren);

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
   * @param {{taskId?: string, title?: string, dueDate?: string, status?: string}|null} headerLabels
   * @returns {{validChildren: Array<object>, invalidChildren: Array<object>}}
   * @private
   */
  #partitionChildren(children, headerLabels) {
    const validChildren = [];
    const invalidChildren = [];

    const labelFor = (fieldKey) => {
      if (!headerLabels) return fieldKey;
      return headerLabels[fieldKey] || fieldKey;
    };

    children.forEach((child) => {
      const missingKeys = getMissingFields(child, this.requiredChildFields);
      if (missingKeys.length) {
        const missingLabels = missingKeys.map(labelFor);
        invalidChildren.push({
          taskId: child.taskId || '不明',
          title: child.title || '',
          reason: `${missingLabels.join(', ')} が未入力です。`
        });
        return;
      }
      validChildren.push(child);
    });

    return { validChildren, invalidChildren };
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
    const done = children.filter((child) => child.status === TASK_STATUS.COMPLETED).length;
    const percentage = total === 0 ? 0 : Math.round((done / total) * 100);
    return {
      total,
      done,
      percentage,
      updatedAt: this.clock()
    };
  }
}
