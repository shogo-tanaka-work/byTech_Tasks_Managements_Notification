/**
 * 日付処理に関する共通ユーティリティ。
 */

/**
 * タイムスタンプをJST（日本標準時）で「YYYY/MM/DD HH:mm:ss」形式にフォーマットする。
 * @param {string|Date} timestamp - ISO 8601形式のタイムスタンプまたはDateオブジェクト
 * @returns {string} フォーマットされた日時文字列
 */
export function formatTimestampJST(timestamp) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  
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
 * 日付が今日より前（過去）かどうかをチェックする。
 * @param {string|Date} dateValue - チェック対象の日付
 * @returns {boolean} 過去の日付であれば true
 */
export function isPastDate(dateValue) {
  if (!dateValue) {
    return false;
  }

  const targetDate = new Date(dateValue);
  targetDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return targetDate < today;
}

/**
 * 現在時刻を ISO 8601 形式で返す。
 * @returns {string}
 */
export function getCurrentTimestamp() {
  return new Date().toISOString();
}

