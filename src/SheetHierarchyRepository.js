import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { PROJECT_SHEET_NAME, PROJECT_COLUMNS } from './config.js';

/**
 * 親子タスク行の取得やスレッド ID の保存など、Google Sheets とのやり取りを集約する。
 */
export class SheetHierarchyRepository {
  constructor({
    spreadsheetId,
    serviceAccountEmail,
    privateKey,
    projectSheetName = PROJECT_SHEET_NAME,
    logger = console
  } = {}) {
    if (!spreadsheetId || !serviceAccountEmail || !privateKey) {
      throw new Error('Google Sheets 認証情報が不足しています。');
    }

    this.logger = logger;
    this.projectSheetName = projectSheetName;
    this.serviceAccountAuth = new JWT({
      email: serviceAccountEmail,
      key: privateKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    this.doc = new GoogleSpreadsheet(spreadsheetId, this.serviceAccountAuth);
    this.sheet = null;
    this.cachedRows = null;
  }

  /**
   * シート1行目の見出しから、PROJECT_COLUMNS で定義された全ての列の表示名を取得する。
   * 互換性のため、従来通り taskId/title/dueDate/status というエイリアスも含めて返す。
   * @returns {Promise<{[key: string]: string}>}
   */
  async fetchHeaderLabels() {
    // ヘッダーは getRows() ではなく headerValues から取得する
    await this.doc.loadInfo();
    this.sheet = this.doc.sheetsByTitle[this.projectSheetName];
    if (!this.sheet) {
      throw new Error(`シート「${this.projectSheetName}」が見つかりません。`);
    }

    // 1行目をヘッダーとして読み込む
    await this.sheet.loadHeaderRow();
    const header = this.sheet.headerValues || []; // ['プロジェクトID', 'タイトル', ...] のような配列

    const safe = (index) => this.#stringOrEmpty(header[index]);

    // PROJECT_COLUMNS のキーごとにヘッダー名をマッピング
    const labelsByColumnKey = {};
    for (const [key, index] of Object.entries(PROJECT_COLUMNS)) {
      labelsByColumnKey[key] = safe(index);
    }

    // 既存利用箇所向けのエイリアスも含めて返却（将来的に columns.TASK_ID などにも拡張可能）
    return {
      ...labelsByColumnKey,
      taskId: labelsByColumnKey.TASK_ID,
      title: labelsByColumnKey.TASK_TITLE,
      dueDate: labelsByColumnKey.DUE_DATE,
      status: labelsByColumnKey.STATUS
    };
  }

  /**
   * スプレッドシートからユニークな親行（プロジェクト）を取得する。
   * @param {{cursor?: number, limit?: number}} [options]
   * @returns {Promise<Array<object>>}
   */
  async fetchParentRows({ cursor = 0, limit = Infinity } = {}) {
    const rows = await this.#ensureDataLoaded();
    if (!rows.length) return [];

    const uniqueProjects = [];
    const seen = new Set();

    rows.forEach((row, index) => {
      const rawData = row._rawData || [];
      const projectId = this.#stringOrEmpty(rawData[PROJECT_COLUMNS.PROJECT_ID]);
      if (!projectId || seen.has(projectId)) {
        return;
      }
      seen.add(projectId);
      uniqueProjects.push({
        rowIndex: index,
        projectId,
        title: this.#stringOrEmpty(rawData[PROJECT_COLUMNS.PROJECT_TITLE]),
        owner: this.#stringOrEmpty(rawData[PROJECT_COLUMNS.OWNER]),
        threadId: rawData[PROJECT_COLUMNS.THREAD_ID] ?? ''
      });
    });

    return uniqueProjects.slice(cursor, cursor + limit);
  }

  /**
   * 指定したプロジェクト ID に紐づく子タスク行を取得する。
   * @param {string} projectId
   * @returns {Promise<Array<object>>}
   */
  async fetchChildRows(projectId) {
    if (!projectId) return [];
    const rows = await this.#ensureDataLoaded();
    if (!rows.length) return [];

    return rows
      .map((row, index) => ({ rawData: row._rawData || [], rowIndex: index }))
      .filter((entry) => {
        const rowProjectId = this.#stringOrEmpty(entry.rawData[PROJECT_COLUMNS.PROJECT_ID]);
        const taskId = this.#stringOrEmpty(entry.rawData[PROJECT_COLUMNS.TASK_ID]);
        return rowProjectId === projectId && taskId.length > 0;
      })
      .map((entry) => ({
        rowIndex: entry.rowIndex,
        taskId: this.#stringOrEmpty(entry.rawData[PROJECT_COLUMNS.TASK_ID]),
        projectId,
        title: this.#stringOrEmpty(entry.rawData[PROJECT_COLUMNS.TASK_TITLE]),
        assignee: '',
        dueDate: entry.rawData[PROJECT_COLUMNS.DUE_DATE] ?? '',
        status: this.#stringOrEmpty(entry.rawData[PROJECT_COLUMNS.STATUS]),
        completedAt: entry.rawData[PROJECT_COLUMNS.COMPLETED_AT] ?? '',
        notes: entry.rawData[PROJECT_COLUMNS.NOTES] ?? ''
      }));
  }

  /**
   * 該当する親行に Discord スレッド ID を書き戻す。
   * @param {{rowIndex: number, threadId: string}} params
   * @returns {Promise<void>}
   */
  async updateThreadId({ rowIndex, threadId }) {
    if (!Number.isInteger(rowIndex)) {
      throw new Error('rowIndex は整数で指定してください。');
    }
    if (!threadId) {
      throw new Error('threadId を指定してください。');
    }

    const rows = await this.#ensureDataLoaded();
    if (!rows[rowIndex]) {
      throw new Error(`rowIndex ${rowIndex} はロード済みデータ内に存在しません。`);
    }

    await this.sheet.loadCells({
      startRowIndex: rowIndex + 1,
      endRowIndex: rowIndex + 2,
      startColumnIndex: 9,
      endColumnIndex: 10
    });

    const cell = this.sheet.getCell(rowIndex + 1, 9);
    cell.value = threadId;
    await this.sheet.saveUpdatedCells();
  }

  /**
   * 対象シートを読み込み、後続アクセスのために行データをキャッシュする。
   * @returns {Promise<Array<object>>}
   * @private
   */
  async #ensureDataLoaded() {
    if (!this.cachedRows) {
      await this.doc.loadInfo();
      this.sheet = this.doc.sheetsByTitle[this.projectSheetName];
      if (!this.sheet) {
        throw new Error(`シート「${this.projectSheetName}」が見つかりません。`);
      }
      this.cachedRows = await this.sheet.getRows();
    }
    return this.cachedRows;
  }

  /**
   * セル値をトリム済みの文字列へ正規化する。
   * @param {*} value
   * @returns {string}
   * @private
   */
  #stringOrEmpty(value) {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value).trim();
  }
}
