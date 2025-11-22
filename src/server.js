import 'dotenv/config';
import express from 'express';
import { runOrchestrator } from './orchestrator.js';

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;

app.use(express.json());

// シンプルな認証ミドルウェア
function requireAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ヘルスチェック
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'TaskThreadSync API' });
});

// 同期実行トリガー
app.post('/api/sync', requireAuth, async (req, res) => {
  console.log('Received sync trigger via API');
  
  try {
    // 同期処理を実行
    // Vercelなどのサーバーレス環境ではタイムアウト(通常10秒~60秒)に注意が必要。
    // 処理が長い場合はバックグラウンドジョブにするのが理想だが、
    // ここではレスポンスを待って返す実装とする。
    const result = await runOrchestrator();
    
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

// Vercel環境ではなく、かつ直接実行された場合のみ listen する
// Vercelではプラットフォーム側がリクエストを処理するため app.listen は不要だが、
// ローカル開発(npm run dev)では必要。
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

// Vercelのために app をエクスポートする
export default app;
