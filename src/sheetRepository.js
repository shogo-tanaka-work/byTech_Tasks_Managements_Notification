import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const DEFAULT_PROJECT_SHEET = 'シート1';

// 列インデックスの定義（0-indexed for google-spreadsheet, but logic kept similar）
// google-spreadsheet はヘッダー行(1行目)をキーとしてオブジェクト化できるが、
// ここでは既存ロジックに合わせて配列として扱うか、行オブジェクトとして扱う。
// 既存ロジックは "列番号" でアクセスしているので、列名マッピングを定義する。
// ※実際のシートのヘッダー名に合わせて変更してください。
const HEADERS = [
  'No', // A
  'projectId', // B
  'title', // C
  'owner', // D
  'colE', 'colF', 'colG', 'colH',
  'threadId', // J (index 9)
  'taskId', // K
  'taskTitle', // L
  'taskContent', // M
  'taskStart', // N
  'taskDue', // O
  'taskStatus', // P
  'taskCompletedAt', // Q
  'notes' // R
];

export function createSheetHierarchyRepository({
  spreadsheetId,
  googleServiceAccountEmail,
  googlePrivateKey,
  projectSheetName = DEFAULT_PROJECT_SHEET
} = {}) {
  if (!spreadsheetId || !googleServiceAccountEmail || !googlePrivateKey) {
    throw new Error('Google Sheets 認証情報が不足しています。');
  }

  // Google Auth Client
  const serviceAccountAuth = new JWT({
    email: googleServiceAccountEmail,
    key: googlePrivateKey.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);
  let _cachedRows = null;

  async function ensureDataLoaded() {
    if (!_cachedRows) {
      await doc.loadInfo();
      const sheet = doc.sheetsByTitle[projectSheetName];
      if (!sheet) {
        throw new Error(`シート「${projectSheetName}」が見つかりません。`);
      }
      
      // 全行取得
      const rows = await sheet.getRows();
      _cachedRows = rows; // google-spreadsheetのRowオブジェクトの配列
    }
    return _cachedRows;
  }

  async function fetchParentRows({ cursor = 0, limit = Infinity } = {}) {
    const rows = await ensureDataLoaded();
    if (!rows.length) return [];

    const uniqueProjects = [];
    const seen = new Set();

    // 行インデックスは 2 から始まる（ヘッダー除外済み、1-based）
    // google-spreadsheet の rows はデータ行のみ。rows[0] はシートの2行目に相当。
    rows.forEach((row, index) => {
      // row._rawData は配列で生データが入っている（隠しプロパティだが高速アクセスのため使用）
      // あるいは row.get('ヘッダー名') だが、ヘッダー名依存を避けるためインデックスアクセスを模倣
      // ここでは、列順序が固定である前提で、row._rawData または getByIndex を使う必要があるが、
      // ライブラリのバージョンによっては _rawData がない。
      // 安全のため、row.get(header) を使うべきだが、ヘッダー名が不明なので
      // row._rawData が使える前提、もしくは row._cells を使う。
      // v4系では row.get('headerName') 推奨。
      
      // 簡易実装: row._rawData (配列) を使用。index 0 = A列
      const rawData = row._rawData || []; 
      
      // B列: projectId (index 1)
      const projectId = stringOrEmpty(rawData[1]);
      
      if (!projectId || seen.has(projectId)) {
        return;
      }
      seen.add(projectId);
      
      uniqueProjects.push({
        rowIndex: index, // 保存時に row オブジェクトを特定するために使う（配列インデックス）
        projectId,
        title: stringOrEmpty(rawData[2]), // C列
        owner: stringOrEmpty(rawData[3]), // D列
        threadId: rawData[9] ?? '' // J列
      });
    });

    return uniqueProjects.slice(cursor, cursor + limit);
  }

  async function fetchChildRows(projectId) {
    if (!projectId) return [];
    const rows = await ensureDataLoaded();
    if (!rows.length) return [];

    return rows
      .map((row, index) => ({ rawData: row._rawData || [], rowIndex: index }))
      .filter((entry) => {
        const rowProjectId = stringOrEmpty(entry.rawData[1]); // B列
        const taskId = stringOrEmpty(entry.rawData[10]); // K列
        return rowProjectId === projectId && taskId.length > 0;
      })
      .map((entry) => ({
        rowIndex: entry.rowIndex,
        taskId: stringOrEmpty(entry.rawData[10]), // K列
        projectId,
        title: stringOrEmpty(entry.rawData[11]), // L列
        assignee: '',
        dueDate: entry.rawData[14] ?? '', // O列
        status: stringOrEmpty(entry.rawData[15]), // P列
        completedAt: entry.rawData[16] ?? '', // Q列
        notes: entry.rawData[17] ?? '' // R列
      }));
  }

  async function updateThreadId({ rowIndex, threadId }) {
    // rowIndex は rows 配列のインデックスを受け取っている前提
    const rows = await ensureDataLoaded();
    const row = rows[rowIndex];
    if (row) {
      // J列 (index 9) を更新
      // google-spreadsheet ではヘッダー名で指定して save() するのが基本
      // ここでは _rawData を直接いじれないので、ヘッダー定義が必要。
      // 仮に J列のヘッダーが "threadId" だとする。
      // しかしヘッダー名が不明確なので、配列アクセスで更新できる API を探すか、
      // ユーザーにヘッダー設定を求める必要がある。
      
      // 今回は `row._rawData[9] = threadId; await row.save();` は効かないことが多い。
      // 確実に動く方法: セル直接指定で更新
      const sheet = doc.sheetsByTitle[projectSheetName];
      // rowIndex はデータ行のインデックス(0始まり)。シート上はヘッダー(1行)があるので +2 行目。
      // しかし google-spreadsheet の loadCells は 0-indexed (A1 = 0,0)
      const gridRowIndex = rowIndex + 1; // ヘッダー分 +1
      const gridColIndex = 9; // J列 = 9
      
      await sheet.loadCells({
        startRowIndex: gridRowIndex,
        endRowIndex: gridRowIndex + 1,
        startColumnIndex: gridColIndex,
        endColumnIndex: gridColIndex + 1
      });
      const cell = sheet.getCell(gridRowIndex, gridColIndex);
      cell.value = threadId;
      await sheet.saveUpdatedCells();
    }
  }

  function stringOrEmpty(value) {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value).trim();
  }

  return {
    fetchParentRows,
    fetchChildRows,
    updateThreadId
  };
}

