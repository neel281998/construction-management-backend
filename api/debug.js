module.exports = (req, res) => {
  try {
    // Test environment variables
    const envVars = {
      MONGODB_URI: process.env.MONGODB_URI ? 'Set' : 'Not set',
      JWT_SECRET: process.env.JWT_SECRET ? 'Set' : 'Not set',
      NODE_ENV: process.env.NODE_ENV || 'Not set',
      EMAIL_HOST: process.env.EMAIL_HOST || 'Not set'
    };

    // Test request body
    const body = req.body || {};
    
    res.json({
      success: true,
      message: 'Debug endpoint working',
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: body,
      environment: envVars,
      nodeVersion: process.version
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Debug endpoint error',
      error: error.message,
      stack: error.stack
    });
  }
};
