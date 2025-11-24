// Vercel Serverless Function Handler
// api/package.json で "type": "commonjs" を指定しているため、
// ES Modules として動的インポートを使用
module.exports = async function handler(req, res) {
  try {
    // ../src/server.js から Express アプリをインポート
    const { default: app } = await import('../src/server.js');
    // Express アプリにリクエストを渡す
    return app(req, res);
  } catch (error) {
    console.error('Error loading server:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
};
