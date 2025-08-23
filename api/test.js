module.exports = (req, res) => {
  res.json({
    message: 'Test endpoint is working!',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url
  });
};
