/**
 * バリデーションに関する共通ユーティリティ。
 */

/**
 * トリム後に有効な値が入っているかを判定する。
 * @param {*} value - チェック対象の値
 * @returns {boolean} 有効な値が入っていれば true
 */
export function hasValue(value) {
  if (value === null || value === undefined) {
    return false;
  }
  return String(value).trim().length > 0;
}

/**
 * 必須フィールドが全て入力されているかをチェックする。
 * @param {object} obj - チェック対象のオブジェクト
 * @param {Array<string>} requiredFields - 必須フィールド名の配列
 * @returns {Array<string>} 欠けているフィールド名の配列
 */
export function getMissingFields(obj, requiredFields) {
  return requiredFields.filter((field) => !hasValue(obj[field]));
}

