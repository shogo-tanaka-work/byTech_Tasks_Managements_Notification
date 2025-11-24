// Vercel Serverless Function Handler (ES Module)
// 参考: https://vercel.com/docs/frameworks/backend/express

import express from 'express';

const app = express();
const API_KEY = process.env.API_KEY;

app.use(express.json());

/**
 * `x-api-key` ヘッダーを検証して正しい API キーが含まれているかを確認するミドルウェア。
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

// 同期APIエンドポイント
app.post('/api/sync', requireAuth, async (req, res) => {
  console.log('Received sync trigger via API (v2)');
  try {
    // 動的にAppFactoryをインポート（相対パスで正しく解決される）
    const { AppFactory } = await import('../src/AppFactory.js');
    
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
    console.error('Stack:', error.stack);
    res.status(500).json({
      status: 'error',
      message: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
});

export default async function handler(req, res) {
  return app(req, res);
}
