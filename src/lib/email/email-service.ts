/**
 * Email Service using Resend API
 * Stage Signal professional templates for transactional mail
 */

import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const FROM_EMAIL =
  process.env.EMAIL_FROM ||
  process.env.RESEND_FROM_EMAIL ||
  'noreply@partyplaylist.app';
const APP_NAME = 'Party Playlist';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const EMAIL_ENABLED = !!RESEND_API_KEY;

/** Stage Signal brand tokens (email-safe hex) */
const EMAIL_BRAND = {
  ink: '#0E1114',
  elevated: '#171B21',
  bone: '#F2F0EB',
  muted: '#9AA3AD',
  accent: '#1DB954',
  border: '#2A3038',
} as const;

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

export interface AccountDecisionEmailData {
  username: string;
  email: string;
}

interface EmailLayoutContent {
  preheader: string;
  title: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}

/**
 * Shared Stage Signal email shell — use for all future transactional templates.
 */
export function renderEmailLayout(content: EmailLayoutContent): string {
  const ctaBlock =
    content.ctaLabel && content.ctaUrl
      ? `
        <tr>
          <td align="center" style="padding: 28px 0 8px;">
            <a href="${content.ctaUrl}"
               style="background-color: ${EMAIL_BRAND.accent}; color: ${EMAIL_BRAND.ink}; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; display: inline-block;">
              ${content.ctaLabel}
            </a>
          </td>
        </tr>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${content.title}</title>
  </head>
  <body style="margin:0; padding:0; background-color:${EMAIL_BRAND.ink}; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">${content.preheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${EMAIL_BRAND.ink}; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px; background-color:${EMAIL_BRAND.elevated}; border:1px solid ${EMAIL_BRAND.border}; border-radius:12px; overflow:hidden;">
            <tr>
              <td style="padding: 28px 32px 20px; border-bottom: 1px solid ${EMAIL_BRAND.border};">
                <p style="margin:0; font-size:13px; letter-spacing:0.12em; text-transform:uppercase; color:${EMAIL_BRAND.accent}; font-weight:700;">
                  ${APP_NAME}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding: 32px;">
                <h1 style="margin:0 0 16px; font-size:24px; line-height:1.3; color:${EMAIL_BRAND.bone}; font-weight:700;">
                  ${content.title}
                </h1>
                <div style="font-size:15px; line-height:1.7; color:${EMAIL_BRAND.muted};">
                  ${content.bodyHtml}
                </div>
                ${ctaBlock}
                ${
                  content.ctaUrl
                    ? `<p style="margin:24px 0 0; font-size:12px; color:${EMAIL_BRAND.muted}; word-break:break-all;">
                         Or open this link:<br>
                         <a href="${content.ctaUrl}" style="color:${EMAIL_BRAND.accent};">${content.ctaUrl}</a>
                       </p>`
                    : ''
                }
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 32px; background-color:${EMAIL_BRAND.ink}; border-top:1px solid ${EMAIL_BRAND.border};">
                <p style="margin:0; font-size:12px; color:${EMAIL_BRAND.muted}; text-align:center;">
                  ${content.footerNote || `You received this email because of activity on ${APP_NAME}.`}
                </p>
                <p style="margin:8px 0 0; font-size:12px; color:${EMAIL_BRAND.muted}; text-align:center;">
                  <a href="${APP_URL}" style="color:${EMAIL_BRAND.accent}; text-decoration:none;">${APP_URL.replace(/^https?:\/\//, '')}</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendVerificationEmail(
  data: EmailVerificationData
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!EMAIL_ENABLED || !resend) {
      console.warn('⚠️ Email service not configured. Verification email not sent.');
      console.log(`📧 Would have sent verification email to: ${data.email}`);
      console.log(
        `🔗 Verification URL: ${APP_URL}/auth/verify-email?token=${data.verificationToken}`
      );
      return { success: false, error: 'Email service not configured' };
    }

    const verificationUrl = `${APP_URL}/auth/verify-email?token=${data.verificationToken}`;

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: `Verify your ${APP_NAME} account`,
      html: renderEmailLayout({
        preheader: `Confirm your email to activate ${APP_NAME}`,
        title: `Welcome, ${data.username}`,
        bodyHtml: `
          <p style="margin:0 0 12px;">
            Thanks for applying. Verify your email to continue — your DJ dashboard unlocks after admin approval.
          </p>
        `,
        ctaLabel: 'Verify email address',
        ctaUrl: verificationUrl,
        footerNote: 'This link expires in 24 hours. If you did not create an account, you can ignore this email.',
      }),
    });

    if (error) {
      console.error('❌ Failed to send verification email:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Verification email sent to:', data.email);
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send email';
    console.error('❌ Email service error:', error);
    return { success: false, error: message };
  }
}

export async function sendPasswordResetEmail(
  data: PasswordResetData
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!EMAIL_ENABLED || !resend) {
      console.warn('⚠️ Email service not configured. Password reset email not sent.');
      console.log(`📧 Would have sent password reset email to: ${data.email}`);
      console.log(`🔗 Reset URL: ${APP_URL}/auth/reset-password?token=${data.resetToken}`);
      return { success: false, error: 'Email service not configured' };
    }

    const resetUrl = `${APP_URL}/auth/reset-password?token=${data.resetToken}`;

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: `Reset your ${APP_NAME} password`,
      html: renderEmailLayout({
        preheader: 'Reset your Party Playlist password',
        title: 'Password reset',
        bodyHtml: `
          <p style="margin:0 0 12px;">Hi ${data.username},</p>
          <p style="margin:0 0 12px;">
            We received a request to reset your password. Use the button below to choose a new one.
          </p>
        `,
        ctaLabel: 'Reset password',
        ctaUrl: resetUrl,
        footerNote:
          'This link expires in 1 hour. If you did not request a reset, you can ignore this email - your password will not change.',
      }),
    });

    if (error) {
      console.error('❌ Failed to send password reset email:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Password reset email sent to:', data.email);
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send email';
    console.error('❌ Email service error:', error);
    return { success: false, error: message };
  }
}

export async function sendWelcomeEmail(
  data: WelcomeEmailData
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!EMAIL_ENABLED || !resend) {
      console.warn('⚠️ Email service not configured. Welcome email not sent.');
      console.log(`📧 Would have sent welcome email to: ${data.email}`);
      return { success: false, error: 'Email service not configured' };
    }

    const loginUrl = `${APP_URL}/login`;
    const requestUrl = `${APP_URL}/${data.username}/request`;

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: `Welcome to ${APP_NAME}`,
      html: renderEmailLayout({
        preheader: 'Email verified — awaiting admin approval',
        title: `Email verified, ${data.username}`,
        bodyHtml: `
          <p style="margin:0 0 12px;">
            Thanks for verifying your email. Your account is pending admin approval before the DJ dashboard unlocks.
          </p>
          <p style="margin:0 0 12px;">
            You can sign in now; once approved, you will be able to connect Spotify, set your event live, and share your request link with guests.
          </p>
          <p style="margin:20px 0 0;">
            Your guest link (available after approval):<br>
            <a href="${requestUrl}" style="color:${EMAIL_BRAND.accent}; word-break:break-all;">${requestUrl}</a>
          </p>
        `,
        ctaLabel: 'Sign in',
        ctaUrl: loginUrl,
        footerNote: `Thanks for applying to host with ${APP_NAME}.`,
      }),
    });

    if (error) {
      console.error('❌ Failed to send welcome email:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Welcome email sent to:', data.email);
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send email';
    console.error('❌ Email service error:', error);
    return { success: false, error: message };
  }
}

export async function sendAccountApprovedEmail(
  data: AccountDecisionEmailData
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!EMAIL_ENABLED || !resend) {
      console.warn('⚠️ Email service not configured. Approval email not sent.');
      console.log(`📧 Would have sent approval email to: ${data.email}`);
      return { success: false, error: 'Email service not configured' };
    }

    const dashboardUrl = `${APP_URL}/${data.username}/admin/spotify`;
    const requestUrl = `${APP_URL}/${data.username}/request`;

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: `Your ${APP_NAME} account is approved`,
      html: renderEmailLayout({
        preheader: 'Your DJ dashboard is unlocked',
        title: `You're approved, ${data.username}`,
        bodyHtml: `
          <p style="margin:0 0 12px;">
            Great news — your ${APP_NAME} account has been approved. Your DJ dashboard is ready to use.
          </p>
          <p style="margin:16px 0 8px; color:${EMAIL_BRAND.bone}; font-weight:600;">Next steps</p>
          <ol style="margin:0; padding-left:18px;">
            <li style="margin-bottom:6px;">Connect your Spotify account</li>
            <li style="margin-bottom:6px;">Configure your event and display</li>
            <li style="margin-bottom:6px;">Share your guest request page</li>
            <li>Go live and run the night</li>
          </ol>
          <p style="margin:20px 0 0;">
            Your guest link:<br>
            <a href="${requestUrl}" style="color:${EMAIL_BRAND.accent}; word-break:break-all;">${requestUrl}</a>
          </p>
        `,
        ctaLabel: 'Open dashboard',
        ctaUrl: dashboardUrl,
        footerNote: `Thanks for hosting with ${APP_NAME}.`,
      }),
    });

    if (error) {
      console.error('❌ Failed to send approval email:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Approval email sent to:', data.email);
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send email';
    console.error('❌ Email service error:', error);
    return { success: false, error: message };
  }
}

export async function sendAccountRejectedEmail(
  data: AccountDecisionEmailData
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!EMAIL_ENABLED || !resend) {
      console.warn('⚠️ Email service not configured. Rejection email not sent.');
      console.log(`📧 Would have sent rejection email to: ${data.email}`);
      return { success: false, error: 'Email service not configured' };
    }

    const contactUrl = `${APP_URL}/contact`;

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: `Update on your ${APP_NAME} application`,
      html: renderEmailLayout({
        preheader: 'Your account application was not approved',
        title: `Application update, ${data.username}`,
        bodyHtml: `
          <p style="margin:0 0 12px;">
            Thanks for your interest in ${APP_NAME}. After review, your account application was not approved at this time.
          </p>
          <p style="margin:0 0 12px;">
            If you believe this was a mistake or you would like more information, please get in touch with us.
          </p>
        `,
        ctaLabel: 'Contact support',
        ctaUrl: contactUrl,
        footerNote: `We appreciate you considering ${APP_NAME}.`,
      }),
    });

    if (error) {
      console.error('❌ Failed to send rejection email:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Rejection email sent to:', data.email);
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send email';
    console.error('❌ Email service error:', error);
    return { success: false, error: message };
  }
}
