// Vercel Serverless Function Handler (ES Module)
// 参考: https://vercel.com/docs/frameworks/backend/express

import app from '../src/server.js';

export default async function handler(req, res) {
  try {
    return app(req, res);
  } catch (error) {
    console.error('Error loading server:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
}
