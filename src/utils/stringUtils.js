/**
 * 文字列処理に関する共通ユーティリティ。
 */

/**
 * セル値をトリム済みの文字列へ正規化する。
 * @param {*} value - 任意の値
 * @returns {string} トリムされた文字列。null/undefined の場合は空文字列。
 */
export function stringOrEmpty(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

/**
 * 文字列を指定された最大長に切り詰める。
 * @param {string} str - 対象文字列
 * @param {number} maxLength - 最大長
 * @returns {string}
 */
export function truncate(str, maxLength) {
  if (!str) return '';
  return str.length > maxLength ? str.slice(0, maxLength) : str;
}

