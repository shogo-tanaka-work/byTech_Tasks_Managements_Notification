// スプレッドシート構造やアプリ全体の固定設定値を一元管理するモジュール。

/**
 * プロジェクト一覧／タスク一覧を保持しているシート名。
 * 必要に応じて設定ファイルから切り替えられるようにすることも可能。
*/
export const PROJECT_SHEET_NAME = 'シート1';

/**
 * プロジェクトシート内の列インデックス定義（0-based）。
 * 列インデックスは GoogleSpreadsheet の row._rawData 配列（0 始まり）に対応する。
 * A 列: 0, B 列: 1, ... の対応となる。
 */
export const PROJECT_COLUMNS = {
  // 親プロジェクト行
  PROJECT_ID: 1, // B列: プロジェクトID
  PROJECT_TITLE: 2, // C列: プロジェクトタイトル
  OWNER: 3, // D列: 担当者
  THREAD_ID: 9, // J列: DiscordスレッドID

  // 子タスク行
  TASK_ID: 10, // K列: タスクID
  TASK_TITLE: 11, // L列: タスク名
  // 12, 13 列は現在未使用
  DUE_DATE: 14, // O列: 期限
  STATUS: 15, // P列: ステータス
  COMPLETED_AT: 16, // Q列: 完了日時
  NOTES: 17 // R列: 備考
};

/**
 * Discord 関連の設定値。
 */
export const DISCORD_SETTINGS = {
  API_BASE_URL: 'https://discord.com/api/v10',
  DEFAULT_BACKOFF_MS: [1000, 2000, 4000],
  THREAD_AUTO_ARCHIVE_MINUTES: 10080,
  MAX_CONTENT_LENGTH: 1800,
  NOTIFY_USER: {
    ONDELAY: '123456789012345678'
  },
};
