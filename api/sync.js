// Vercel Serverless Function Handler for /api/sync (CommonJS with dynamic import)
module.exports = async function handler(req, res) {
  try {
    const { default: app } = await import('../src/server.js');
    return app(req, res);
  } catch (error) {
    console.error('Error loading server:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};
