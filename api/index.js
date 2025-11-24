// Express App for Vercel Serverless Function
// 参考: https://vercel.com/docs/frameworks/backend/express
//
// Vercel環境: 環境変数は自動的に process.env に注入される
// api/ ディレクトリ内のファイルは自動的にサーバーレス関数として認識される

import express from 'express';

// 動的にインポートするモジュール（実行時に解決）
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

// タスク同期APIエンドポイント
app.post('/api/sync', requireAuth, async (req, res) => {
  console.log('Received sync trigger via API (v2)');
  try {
    // 動的にAppFactoryをインポート（実行時に解決）
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

// Vercel Serverless Function用のハンドラーをエクスポート
export default async function handler(req, res) {
  return app(req, res);
}

