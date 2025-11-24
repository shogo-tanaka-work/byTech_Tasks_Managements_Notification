/**
 * アプリケーション全体で使用される定数定義。
 */

/**
 * タスクのステータス定義。
 */
export const TASK_STATUS = {
  NOT_STARTED: '未着手',
  IN_PROGRESS: '着手中',
  COMPLETED: '完了',
  ON_HOLD: '保留'
};

/**
 * プロジェクトの進行状況ラベル。
 */
export const PROGRESS_STATUS = {
  ON_SCHEDULE: 'オンスケ',
  DELAYED: '遅延'
};

/**
 * Discord メッセージで使用する絵文字。
 */
export const DISCORD_EMOJI = {
  WARNING: ':warning:',
  INFO: ':information_source:',
  SUCCESS: ':white_check_mark:',
  ERROR: ':x:'
};

/**
 * タスクのマーカー種別。
 */
export const TASK_MARKERS = {
  DEADLINE: 'deadline',
  STATUS_CHANGED: 'statusChanged'
};

/**
 * タスクの必須フィールド名（英語キー）。
 */
export const REQUIRED_TASK_FIELDS = ['taskId', 'title', 'dueDate', 'status'];

