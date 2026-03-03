# Email Configuration Guide - Password Reset Setup

This guide explains how to configure email settings for password reset functionality in your Construction Management API.

## ⚠️ Emails Not Arriving?

If users don't receive password reset emails:

1. **Set environment variables** – `EMAIL_HOST`, `EMAIL_USER`, and `EMAIL_PASS` must be set in your deployment (e.g. Vercel → Project → Settings → Environment Variables).
2. **Gmail** – Use an [App Password](https://myaccount.google.com/apppasswords), not your normal password. 2FA must be enabled.
3. **Check spam** – Ask users to check their spam/junk folder.
4. **Check logs** – Your server logs will show `EMAIL CONFIGURATION MISSING` or `Failed to send password reset email` if something is wrong.

## Email Configuration Variables

Your backend uses these environment variables for email functionality:

```bash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

## Setting Up Gmail for Email Sending

### Step 1: Enable 2-Factor Authentication

1. Go to your Google Account settings: https://myaccount.google.com/
2. Navigate to **Security**
3. Enable **2-Step Verification** if not already enabled

### Step 2: Generate App Password

1. Go to Google Account settings: https://myaccount.google.com/
2. Navigate to **Security** → **2-Step Verification**
3. Scroll down and click **App passwords**
4. Select **Mail** as the app and **Other** as the device
5. Click **Generate**
6. Copy the 16-character password (e.g., `abcd efgh ijkl mnop`)

### Step 3: Configure Environment Variables

#### For Local Development (.env file):
```bash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop
```

#### For Vercel Deployment:
1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add these variables:

| Name | Value | Environment |
|------|-------|-------------|
| `EMAIL_HOST` | `smtp.gmail.com` | Production |
| `EMAIL_PORT` | `587` | Production |
| `EMAIL_USER` | `your_email@gmail.com` | Production |
| `EMAIL_PASS` | `abcd efgh ijkl mnop` | Production |

## Alternative Email Providers

### Outlook/Hotmail
```bash
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
EMAIL_USER=your_email@outlook.com
EMAIL_PASS=your_app_password
```

### Yahoo Mail
```bash
EMAIL_HOST=smtp.mail.yahoo.com
EMAIL_PORT=587
EMAIL_USER=your_email@yahoo.com
EMAIL_PASS=your_app_password
```

### Custom SMTP Server
```bash
EMAIL_HOST=your-smtp-server.com
EMAIL_PORT=587
EMAIL_USER=your_username
EMAIL_PASS=your_password
```

## Testing Email Configuration

### 1. Test Email Service Locally

Create a test script to verify your email configuration:

```javascript
// test-email.js
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransporter({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function testEmail() {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: "test@example.com",
      subject: "Test Email from Construction Management API",
      text: "This is a test email to verify email configuration.",
      html: "<b>This is a test email to verify email configuration.</b>",
    });

    console.log("✅ Email sent successfully!");
    console.log("Message ID:", info.messageId);
  } catch (error) {
    console.error("❌ Email sending failed:", error);
  }
}

testEmail();
```

Run the test:
```bash
cd backend
node test-email.js
```

### 2. Test Password Reset Endpoint

Test the password reset functionality:

```bash
# Request password reset
curl -X POST https://your-backend.vercel.app/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

## Email Templates

Your backend uses these email templates for password reset:

### Password Reset Email Template
```html
<h2>Password Reset Request</h2>
<p>Hello,</p>
<p>You have requested to reset your password for the Construction Management App.</p>
<p>Your OTP code is: <strong>{{otp}}</strong></p>
<p>This code will expire in 10 minutes.</p>
<p>If you didn't request this, please ignore this email.</p>
<p>Best regards,<br>Construction Management Team</p>
```

### Welcome Email Template
```html
<h2>Welcome to Construction Management App</h2>
<p>Hello {{name}},</p>
<p>Welcome to the Construction Management App!</p>
<p>Your account has been successfully created.</p>
<p>Best regards,<br>Construction Management Team</p>
```

## Security Best Practices

### 1. Use App Passwords
- Never use your main Gmail password
- Always generate app-specific passwords
- Keep app passwords secure and private

### 2. Environment Variables
- Never commit email credentials to version control
- Use environment variables for all sensitive data
- Use different credentials for development and production

### 3. Rate Limiting
- Implement rate limiting for email sending
- Prevent abuse of password reset functionality
- Monitor email sending patterns

### 4. Email Validation
- Validate email addresses before sending
- Implement proper error handling
- Log email sending activities

## Troubleshooting Email Issues

### Issue: "Authentication failed"

**Solutions:**
1. Check that 2-factor authentication is enabled
2. Verify the app password is correct
3. Ensure the email address is correct
4. Check if the app password has expired

### Issue: "Connection timeout"

**Solutions:**
1. Check your internet connection
2. Verify the SMTP host and port
3. Check firewall settings
4. Try a different port (465 for SSL, 587 for TLS)

### Issue: "Email not received"

**Solutions:**
1. Check spam/junk folder
2. Verify the recipient email address
3. Check email provider settings
4. Test with a different email address

### Issue: "Invalid credentials"

**Solutions:**
1. Regenerate the app password
2. Ensure you're using the app password, not your main password
3. Check if the email account is locked
4. Verify the email address format

## Email Service Providers Comparison

| Provider | SMTP Host | Port | Security | Free Tier |
|----------|-----------|------|----------|-----------|
| Gmail | smtp.gmail.com | 587 | TLS | 500 emails/day |
| Outlook | smtp-mail.outlook.com | 587 | TLS | 300 emails/day |
| Yahoo | smtp.mail.yahoo.com | 587 | TLS | 500 emails/day |
| SendGrid | smtp.sendgrid.net | 587 | TLS | 100 emails/day |
| Mailgun | smtp.mailgun.org | 587 | TLS | 5,000 emails/month |

## Production Recommendations

### 1. Use Professional Email Services
For production applications, consider:
- **SendGrid**: Reliable, good free tier
- **Mailgun**: Developer-friendly
- **Amazon SES**: Cost-effective for high volume
- **Postmark**: Great deliverability

### 2. Email Templates
- Use professional email templates
- Include your company branding
- Make emails mobile-friendly
- Include unsubscribe links

### 3. Monitoring
- Monitor email delivery rates
- Track bounce rates
- Set up email alerts for failures
- Log all email activities

## Quick Setup Checklist

- [ ] Enable 2-factor authentication on Gmail
- [ ] Generate app password
- [ ] Set environment variables in Vercel
- [ ] Test email configuration locally
- [ ] Test password reset functionality
- [ ] Verify email templates
- [ ] Set up monitoring and logging

## Support

If you're having email issues:
1. Check the email service logs
2. Verify environment variables are set correctly
3. Test with a simple email script
4. Check Vercel function logs for errors
5. Contact your email provider support
