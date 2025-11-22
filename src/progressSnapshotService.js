import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_KEY_PREFIX = 'project:';
const DONE_STATUSES = new Set(['完了']);

// 永続化ファイルのパス (プロジェクトルート/.progress.json)
// ※注意: Vercel等のServerless環境では、/tmp 以外への書き込みは永続化されません。
// 本番運用では Redis (Vercel KV) や Database への置き換えを推奨します。
const DB_FILE_PATH = path.resolve(process.cwd(), '.progress.json');

/**
 * 進捗スナップショットサービス (File System版)
 */
export function createProgressSnapshotService() {
  let cache = {};

  // 初期ロード
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const data = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      cache = JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load progress file:', e);
    cache = {};
  }

  function calculate(children = []) {
    const total = children.length;
    const done = children.filter((child) => DONE_STATUSES.has(child.status)).length;
    const percentage = total === 0 ? 0 : Math.round((done / total) * 100);
    return {
      total,
      done,
      percentage,
      updatedAt: new Date().toISOString()
    };
  }

  function shouldUpdate(projectId, snapshot) {
    const key = buildKey(projectId);
    const stored = cache[key];
    
    if (!stored) {
      return true;
    }
    
    return (
      stored.total !== snapshot.total ||
      stored.done !== snapshot.done ||
      stored.percentage !== snapshot.percentage
    );
  }

  function persist(projectId, snapshot) {
    const key = buildKey(projectId);
    cache[key] = snapshot;
    
    // ファイルへ書き出し (Sync)
    try {
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(cache, null, 2));
    } catch (e) {
      console.error('Failed to write progress file:', e);
    }
  }

  function buildKey(projectId) {
    return `${DEFAULT_KEY_PREFIX}${projectId}`;
  }

  return {
    calculate,
    shouldUpdate,
    persist
  };
}

