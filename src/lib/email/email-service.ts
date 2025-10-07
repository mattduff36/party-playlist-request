/**
 * Email Service using Resend API
 * Handles transactional emails for user registration, verification, and password reset
 */

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@partyplaylist.app';
const APP_NAME = 'Party Playlist';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export interface EmailVerificationData {
  username: string;
  email: string;
  verificationToken: string;
}

export interface PasswordResetData {
  username: string;
  email: string;
  resetToken: string;
}

export interface WelcomeEmailData {
  username: string;
  email: string;
}

/**
 * Send email verification email
 */
export async function sendVerificationEmail(data: EmailVerificationData): Promise<{ success: boolean; error?: string }> {
  try {
    const verificationUrl = `${APP_URL}/auth/verify-email?token=${data.verificationToken}`;
    
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: `Verify your ${APP_NAME} account`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verify Your Email</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🎵 ${APP_NAME}</h1>
            </div>
            
            <div style="background: #f9f9f9; padding: 40px 30px; border-radius: 0 0 10px 10px;">
              <h2 style="color: #333; margin-top: 0;">Welcome, ${data.username}! 👋</h2>
              
              <p style="font-size: 16px; line-height: 1.8;">
                Thank you for signing up! Please verify your email address to activate your account and start creating amazing playlist experiences.
              </p>
              
              <div style="text-align: center; margin: 40px 0;">
                <a href="${verificationUrl}" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; 
                          padding: 15px 40px; 
                          text-decoration: none; 
                          border-radius: 8px; 
                          font-weight: bold; 
                          font-size: 16px;
                          display: inline-block;">
                  Verify Email Address
                </a>
              </div>
              
              <p style="font-size: 14px; color: #666; margin-top: 40px;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="font-size: 12px; color: #999; word-break: break-all;">
                ${verificationUrl}
              </p>
              
              <hr style="border: none; border-top: 1px solid #ddd; margin: 40px 0;">
              
              <p style="font-size: 12px; color: #999; text-align: center;">
                This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
              </p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('❌ Failed to send verification email:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Verification email sent to:', data.email);
    return { success: true };
    
  } catch (error: any) {
    console.error('❌ Email service error:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(data: PasswordResetData): Promise<{ success: boolean; error?: string }> {
  try {
    const resetUrl = `${APP_URL}/auth/reset-password?token=${data.resetToken}`;
    
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: `Reset your ${APP_NAME} password`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Your Password</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🎵 ${APP_NAME}</h1>
            </div>
            
            <div style="background: #f9f9f9; padding: 40px 30px; border-radius: 0 0 10px 10px;">
              <h2 style="color: #333; margin-top: 0;">Password Reset Request 🔐</h2>
              
              <p style="font-size: 16px; line-height: 1.8;">
                Hi ${data.username},
              </p>
              
              <p style="font-size: 16px; line-height: 1.8;">
                We received a request to reset your password. Click the button below to create a new password:
              </p>
              
              <div style="text-align: center; margin: 40px 0;">
                <a href="${resetUrl}" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; 
                          padding: 15px 40px; 
                          text-decoration: none; 
                          border-radius: 8px; 
                          font-weight: bold; 
                          font-size: 16px;
                          display: inline-block;">
                  Reset Password
                </a>
              </div>
              
              <p style="font-size: 14px; color: #666; margin-top: 40px;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="font-size: 12px; color: #999; word-break: break-all;">
                ${resetUrl}
              </p>
              
              <hr style="border: none; border-top: 1px solid #ddd; margin: 40px 0;">
              
              <p style="font-size: 12px; color: #999; text-align: center;">
                This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email - your password will not be changed.
              </p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('❌ Failed to send password reset email:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Password reset email sent to:', data.email);
    return { success: true };
    
  } catch (error: any) {
    console.error('❌ Email service error:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

/**
 * Send welcome email after verification
 */
export async function sendWelcomeEmail(data: WelcomeEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const dashboardUrl = `${APP_URL}/${data.username}/admin/overview`;
    
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: `Welcome to ${APP_NAME}! 🎉`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome!</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🎵 ${APP_NAME}</h1>
            </div>
            
            <div style="background: #f9f9f9; padding: 40px 30px; border-radius: 0 0 10px 10px;">
              <h2 style="color: #333; margin-top: 0;">Welcome aboard, ${data.username}! 🎉</h2>
              
              <p style="font-size: 16px; line-height: 1.8;">
                Your account is now active! You're all set to create interactive playlist experiences for your parties, events, and gatherings.
              </p>
              
              <h3 style="color: #667eea; margin-top: 30px;">Getting Started:</h3>
              
              <ul style="font-size: 15px; line-height: 1.8; color: #555;">
                <li>🔌 Connect your Spotify account</li>
                <li>🎯 Set up your event details</li>
                <li>📱 Share your custom request page with guests</li>
                <li>🎶 Manage song requests in real-time</li>
              </ul>
              
              <div style="text-align: center; margin: 40px 0;">
                <a href="${dashboardUrl}" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; 
                          padding: 15px 40px; 
                          text-decoration: none; 
                          border-radius: 8px; 
                          font-weight: bold; 
                          font-size: 16px;
                          display: inline-block;">
                  Go to Dashboard
                </a>
              </div>
              
              <hr style="border: none; border-top: 1px solid #ddd; margin: 40px 0;">
              
              <p style="font-size: 14px; color: #666;">
                Your unique request page URL:<br>
                <strong style="color: #667eea;">${APP_URL}/${data.username}/request</strong>
              </p>
              
              <p style="font-size: 12px; color: #999; text-align: center; margin-top: 40px;">
                Need help? Check out our docs or contact support.
              </p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('❌ Failed to send welcome email:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Welcome email sent to:', data.email);
    return { success: true };
    
  } catch (error: any) {
    console.error('❌ Email service error:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}
