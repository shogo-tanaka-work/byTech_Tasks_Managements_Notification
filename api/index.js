// Vercel Serverless Function Handler
// 参考: https://vercel.com/docs/frameworks/backend/express
// CommonJSで動的にES Moduleをインポート

let app;

async function getApp() {
  if (!app) {
    const { default: expressApp } = await import('../src/server.js');
    app = expressApp;
  }
  return app;
}

module.exports = async function handler(req, res) {
  try {
    const expressApp = await getApp();
    return expressApp(req, res);
  } catch (error) {
    console.error('Error loading server:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
};
