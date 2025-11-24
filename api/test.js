// Simple test handler (CommonJS)
module.exports = function handler(req, res) {
  res.status(200).json({
    message: 'Test endpoint working',
    method: req.method,
    url: req.url
  });
};
