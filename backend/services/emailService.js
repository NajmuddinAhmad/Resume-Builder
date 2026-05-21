const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

/**
 * Send password reset email
 */
async function sendPasswordReset(email, name, resetUrl) {
  if (!process.env.SMTP_USER) {
    console.log(`[DEV] Password reset URL for ${email}: ${resetUrl}`);
    return;
  }

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'Build My Resume <noreply@buildmyresume.com>',
    to: email,
    subject: 'Reset your Build My Resume password',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Inter', Arial, sans-serif; background: #f8fafc; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 40px auto; background: white; border-radius: 16px; padding: 40px; }
    .logo { font-size: 24px; font-weight: 700; color: #6366f1; margin-bottom: 32px; }
    h1 { font-size: 28px; color: #0f172a; margin-bottom: 16px; }
    p { color: #64748b; line-height: 1.6; }
    .btn { display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white !important; 
           text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; margin: 24px 0; }
    .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">✦ Build My Resume</div>
    <h1>Reset your password</h1>
    <p>Hi ${name},</p>
    <p>We received a request to reset your Build My Resume password. Click the button below to create a new password:</p>
    <a href="${resetUrl}" class="btn">Reset Password →</a>
    <p>This link will expire in <strong>1 hour</strong>. If you didn't request this, you can safely ignore this email.</p>
    <div class="footer">
      <p>© 2024 Build My Resume. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `
  });
}

/**
 * Send welcome email
 */
async function sendWelcome(email, name) {
  if (!process.env.SMTP_USER) {
    console.log(`[DEV] Welcome email sent to ${email}`);
    return;
  }

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'Build My Resume <noreply@buildmyresume.com>',
    to: email,
    subject: 'Welcome to Build My Resume! 🚀',
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background: #f8fafc; }
    .container { max-width: 560px; margin: 40px auto; background: white; border-radius: 16px; padding: 40px; }
    .logo { font-size: 24px; font-weight: 700; color: #6366f1; margin-bottom: 32px; }
    h1 { font-size: 28px; color: #0f172a; }
    p { color: #64748b; line-height: 1.6; }
    .btn { display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); 
           color: white !important; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">✦ Build My Resume</div>
    <h1>Welcome aboard, ${name}! 🎉</h1>
    <p>Your account is ready. Start building your AI-powered resume in minutes.</p>
    <a href="${process.env.FRONTEND_URL || `http://localhost:${process.env.PORT || 5001}`}/dashboard.html" class="btn">Go to Dashboard →</a>
  </div>
</body>
</html>
    `
  });
}

module.exports = { sendPasswordReset, sendWelcome };
