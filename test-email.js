const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter
const transporter = nodemailer.createTransporter({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function testEmail() {
  console.log('🧪 Testing email configuration...');
  console.log('📧 Email Host:', process.env.EMAIL_HOST || 'smtp.gmail.com');
  console.log('🔌 Email Port:', process.env.EMAIL_PORT || 587);
  console.log('👤 Email User:', process.env.EMAIL_USER || 'Not set');
  console.log('🔑 Email Pass:', process.env.EMAIL_PASS ? '***Set***' : 'Not set');
  console.log('');

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('❌ Email configuration incomplete!');
    console.log('Please set EMAIL_USER and EMAIL_PASS environment variables.');
    return;
  }

  try {
    // Verify connection configuration
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully!');

    // Send test email
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // Send to yourself for testing
      subject: "🧪 Test Email - Construction Management API",
      text: "This is a test email to verify email configuration for the Construction Management API.",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">🧪 Test Email - Construction Management API</h2>
          <p>Hello,</p>
          <p>This is a test email to verify that your email configuration is working correctly for the Construction Management API.</p>
          <p><strong>Configuration Details:</strong></p>
          <ul>
            <li>SMTP Host: ${process.env.EMAIL_HOST || 'smtp.gmail.com'}</li>
            <li>SMTP Port: ${process.env.EMAIL_PORT || 587}</li>
            <li>Email User: ${process.env.EMAIL_USER}</li>
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

    console.log('✅ Test email sent successfully!');
    console.log('📧 Message ID:', info.messageId);
    console.log('📬 Check your email inbox for the test message.');
    
  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    
    if (error.code === 'EAUTH') {
      console.log('\n🔧 Authentication Error - Possible solutions:');
      console.log('1. Enable 2-factor authentication on your Gmail account');
      console.log('2. Generate an app password (not your main password)');
      console.log('3. Use the app password in EMAIL_PASS environment variable');
    } else if (error.code === 'ECONNECTION') {
      console.log('\n🔧 Connection Error - Possible solutions:');
      console.log('1. Check your internet connection');
      console.log('2. Verify EMAIL_HOST and EMAIL_PORT are correct');
      console.log('3. Check if your firewall is blocking the connection');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('\n🔧 Timeout Error - Possible solutions:');
      console.log('1. Try using port 465 with secure: true');
      console.log('2. Check if your network allows SMTP connections');
      console.log('3. Try a different email provider');
    }
  }
}

// Run the test
testEmail();
