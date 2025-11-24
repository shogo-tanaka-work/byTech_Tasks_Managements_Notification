// Express App
//
// 本番環境: 環境変数は自動的に process.env に注入される
// ローカル開発: `npm run dev` で --env-file=.env を使用（package.json参照）
// したがって、dotenv パッケージは不要

import express from 'express';
import { AppFactory } from './AppFactory.js';

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;

app.use(express.json());

/**
 * `x-api-key` ヘッダーを検証して正しい API キーが含まれているかを確認するミドルウェア。
 * @param {import('express').Request} req - 受信リクエスト。
 * @param {import('express').Response} res - エラーを返すためのレスポンス。
 * @param {import('express').NextFunction} next - 連鎖処理を継続するためのコールバック。
 */
function requireAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ルートエンドポイント
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'TaskThreadSync API (v2)' });
});

// タスク同期APIエンドポイント
app.post('/api/sync', requireAuth, async (req, res) => {
  console.log('Received sync trigger via API (v2)');
  try {
    // リクエストごとにインスタンスを生成し、常に最新のシートデータを取得できるようにする
    const factory = new AppFactory({ env: process.env, logger: console });
    const orchestrator = factory.createOrchestrator();
    const result = await orchestrator.run();
    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      result
    });
  } catch (error) {
    console.error('API Execution Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// サーバー起動
// 本番環境でもローカル開発でもポートをリッスン
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// モジュールとしてエクスポート
export default app;
