const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

// Send OTP email
const sendOTPEmail = async (email, otp, userName, type = 'verification') => {
  try {
    const transporter = createTransporter();
    
    const isReset = type === 'reset';
    const subject = isReset ? 'Password Reset - Construction Manager' : 'Email Verification - Construction Manager';
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            text-align: center;
            padding: 20px 0;
            border-bottom: 2px solid #2563EB;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #2563EB;
            margin-bottom: 10px;
          }
          .otp-container {
            background: #f8fafc;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            padding: 30px;
            text-align: center;
            margin: 30px 0;
          }
          .otp-code {
            font-size: 36px;
            font-weight: bold;
            color: #2563EB;
            letter-spacing: 8px;
            margin: 20px 0;
            padding: 15px;
            background: white;
            border-radius: 8px;
            border: 2px solid #2563EB;
          }
          .warning {
            background: #fef3cd;
            border: 1px solid #fbbf24;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            font-size: 14px;
            color: #6b7280;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">🏗️ Construction Manager</div>
          <p>Professional Construction Management Platform</p>
        </div>
        
        <h2>Hello ${userName},</h2>
        
        <p>
          ${isReset 
            ? 'You have requested to reset your password. Use the verification code below to proceed with password reset:'
            : 'Welcome to Construction Manager! Please verify your email address using the code below:'
          }
        </p>
        
        <div class="otp-container">
          <h3>${isReset ? 'Password Reset Code' : 'Verification Code'}</h3>
          <div class="otp-code">${otp}</div>
          <p><strong>This code will expire in 5 minutes</strong></p>
        </div>
        
        <div class="warning">
          <strong>Security Notice:</strong>
          <ul>
            <li>Never share this code with anyone</li>
            <li>Our team will never ask for this code via phone or email</li>
            <li>If you didn't request this ${isReset ? 'password reset' : 'verification'}, please ignore this email</li>
          </ul>
        </div>
        
        <p>
          ${isReset 
            ? 'If you did not request a password reset, please ignore this email and your password will remain unchanged.'
            : 'Once verified, you\'ll have access to all the construction management features including site tracking, vehicle management, and inventory control.'
          }
        </p>
        
        <div class="footer">
          <p>
            <strong>Construction Manager Team</strong><br>
            Professional Construction Management Solutions<br>
            <a href="mailto:support@constructionmanager.com">support@constructionmanager.com</a>
          </p>
          <p>
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      </body>
      </html>
    `;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'Construction Manager <noreply@constructionmanager.com>',
      to: email,
      subject,
      html: htmlContent,
      text: `
        Hello ${userName},
        
        ${isReset 
          ? `You have requested to reset your password. Your verification code is: ${otp}`
          : `Welcome to Construction Manager! Your verification code is: ${otp}`
        }
        
        This code will expire in 5 minutes.
        
        If you didn't request this ${isReset ? 'password reset' : 'verification'}, please ignore this email.
        
        Best regards,
        Construction Manager Team
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    
    return {
      success: true,
      messageId: info.messageId
    };
    
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error('Failed to send email');
  }
};

// Send notification email
const sendNotificationEmail = async (email, subject, message, userName) => {
  try {
    const transporter = createTransporter();
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            text-align: center;
            padding: 20px 0;
            border-bottom: 2px solid #2563EB;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #2563EB;
            margin-bottom: 10px;
          }
          .content {
            background: #f8fafc;
            border-radius: 12px;
            padding: 30px;
            margin: 30px 0;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            font-size: 14px;
            color: #6b7280;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">🏗️ Construction Manager</div>
          <p>Professional Construction Management Platform</p>
        </div>
        
        <h2>Hello ${userName},</h2>
        
        <div class="content">
          ${message}
        </div>
        
        <div class="footer">
          <p>
            <strong>Construction Manager Team</strong><br>
            Professional Construction Management Solutions<br>
            <a href="mailto:support@constructionmanager.com">support@constructionmanager.com</a>
          </p>
        </div>
      </body>
      </html>
    `;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'Construction Manager <noreply@constructionmanager.com>',
      to: email,
      subject,
      html: htmlContent,
      text: message.replace(/<[^>]*>/g, '') // Strip HTML for text version
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Notification email sent:', info.messageId);
    
    return {
      success: true,
      messageId: info.messageId
    };
    
  } catch (error) {
    console.error('Notification email error:', error);
    throw new Error('Failed to send notification email');
  }
};

module.exports = {
  sendOTPEmail,
  sendNotificationEmail
};