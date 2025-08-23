const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
  try {
    // Check if email environment variables are set
    const emailConfig = {
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    };

    const missingVars = [];
    Object.entries(emailConfig).forEach(([key, value]) => {
      if (!value) missingVars.push(key);
    });

    if (missingVars.length > 0) {
      return res.json({
        success: false,
        message: 'Email configuration incomplete',
        missing: missingVars,
        config: {
          host: emailConfig.host ? 'Set' : 'Not set',
          port: emailConfig.port ? 'Set' : 'Not set',
          user: emailConfig.user ? 'Set' : 'Not set',
          pass: emailConfig.pass ? 'Set' : 'Not set'
        }
      });
    }

    // Create transporter
    const transporter = nodemailer.createTransporter({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: false,
      auth: {
        user: emailConfig.user,
        pass: emailConfig.pass,
      },
    });

    // Test email configuration
    await transporter.verify();

    // Send test email
    const testEmail = req.body?.email || emailConfig.user;
    const info = await transporter.sendMail({
      from: emailConfig.user,
      to: testEmail,
      subject: "🧪 Test Email - Construction Management API",
      text: "This is a test email to verify email configuration for the Construction Management API.",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">🧪 Test Email - Construction Management API</h2>
          <p>Hello,</p>
          <p>This is a test email to verify that your email configuration is working correctly for the Construction Management API.</p>
          <p><strong>Configuration Details:</strong></p>
          <ul>
            <li>SMTP Host: ${emailConfig.host}</li>
            <li>SMTP Port: ${emailConfig.port}</li>
            <li>Email User: ${emailConfig.user}</li>
          </ul>
          <p>If you received this email, your email configuration is working properly!</p>
          <p>Best regards,<br>Construction Management Team</p>
          <hr>
          <p style="font-size: 12px; color: #666;">
            This is an automated test email. Please ignore if you weren't expecting it.
          </p>
        </div>
      `,
    });

    res.json({
      success: true,
      message: 'Email configuration working! Test email sent.',
      messageId: info.messageId,
      config: {
        host: emailConfig.host,
        port: emailConfig.port,
        user: emailConfig.user,
        pass: '***Hidden***'
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Email test failed',
      error: error.message,
      config: {
        host: process.env.EMAIL_HOST ? 'Set' : 'Not set',
        port: process.env.EMAIL_PORT ? 'Set' : 'Not set',
        user: process.env.EMAIL_USER ? 'Set' : 'Not set',
        pass: process.env.EMAIL_PASS ? 'Set' : 'Not set'
      }
    });
  }
};
