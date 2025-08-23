module.exports = (req, res) => {
  try {
    // Test basic functionality without database
    const testData = {
      success: true,
      message: 'Simple test endpoint working',
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      body: req.body || {},
      headers: {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent']
      },
      environment: {
        NODE_ENV: process.env.NODE_ENV || 'Not set',
        MONGODB_URI: process.env.MONGODB_URI ? 'Set' : 'Not set',
        JWT_SECRET: process.env.JWT_SECRET ? 'Set' : 'Not set'
      }
    };

    res.json(testData);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Simple test failed',
      error: error.message
    });
  }
};
