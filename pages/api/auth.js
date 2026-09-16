import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { findPartnerByEmail, isAdminEmail } from '../../lib/salesforce';
import { getSession } from '../../lib/session';

function displayNameFromEmail(email) {
  const local = (email || '').split('@')[0] || '';
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ') || 'Admin';
}

const mailTransport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  // Fail fast instead of hanging the login when SMTP is unset/misconfigured.
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export default async function handler(req, res) {
  if (req.method === 'POST' && req.body.step === 'send') {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required.' });
    const emailLower = email.trim().toLowerCase();

    // Internal Unframe admins get the all-partners view. Signed in immediately,
    // like the demo test login. Harden to OTP before a public domain launch.
    if (isAdminEmail(emailLower)) {
      const session = await getSession(req, res);
      session.isAdmin = true;
      session.email = emailLower;
      session.name = displayNameFromEmail(emailLower);
      session.partnerAccountId = null;
      session.partnerAccountName = null;
      session.partnerType = null;
      await session.save();
      return res.status(200).json({ ok: true, adminLogin: true });
    }

    let partner;
    try {
      partner = await findPartnerByEmail(emailLower);
    } catch (err) {
      console.error('Partner lookup failed:', err);
      return res.status(502).json({ error: `Could not reach Salesforce: ${err?.message || 'unknown error'}` });
    }
    if (!partner) {
      return res.status(404).json({
        error: 'We couldn’t match your email to a registered Unframe partner. Use your work email, or contact your Unframe partner manager.',
      });
    }

    // Test login (demo): skip the emailed code and sign in immediately.
    if (partner.isTest) {
      const session = await getSession(req, res);
      session.partnerAccountId = partner.accountId;
      session.partnerAccountName = partner.accountName;
      session.partnerType = partner.partnerType;
      session.contactId = partner.contactId;
      session.name = partner.contactName;
      session.email = emailLower;
      await session.save();
      return res.status(200).json({ ok: true, testLogin: true, partnerName: partner.accountName });
    }

    const otp = generateOtp();
    const session = await getSession(req, res);
    session.pendingEmail = email.trim().toLowerCase();
    session.pendingAccountId = partner.accountId;
    session.pendingAccountName = partner.accountName;
    session.pendingPartnerType = partner.partnerType;
    session.pendingContactId = partner.contactId;
    session.pendingName = partner.contactName;
    session.otpHash = hashOtp(otp);
    session.otpExpiry = Date.now() + 10 * 60 * 1000;
    await session.save();

    try {
      await mailTransport.sendMail({
        from: process.env.SMTP_FROM || `Unframe Partner Portal <${process.env.SMTP_USER}>`,
        to: email.trim(),
        subject: 'Your login code',
        html: `
  <div style="font-family: 'Poppins', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #141414;">
    <div style="height: 4px; background: #7800FF; border-radius: 2px; margin-bottom: 24px;"></div>
    <div style="font-size: 22px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 20px;"><span style="color: #7800FF;">U</span>nframe</div>
    <h2 style="font-size: 18px; font-weight: 600; margin: 0 0 8px;">Your login code</h2>
    <p style="color: #3D3D42; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">Enter this code in the Partner Portal. It expires in 10 minutes.</p>
    <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #141414; margin-bottom: 24px;">${otp}</div>
    <p style="font-size: 13px; color: #6E6E75; margin: 0;">If you didn’t request this, you can ignore this email.</p>
  </div>
        `,
      });
    } catch (err) {
      console.error('SMTP send failed:', err);
      const detail = err?.message || 'email delivery failed';
      return res.status(502).json({ error: `Could not send the login code: ${detail}` });
    }

    return res.status(200).json({ ok: true, partnerName: partner.accountName });
  }

  if (req.method === 'POST' && req.body.step === 'verify') {
    const { otp } = req.body;
    const session = await getSession(req, res);

    if (!session.otpHash || !session.otpExpiry) {
      return res.status(400).json({ error: 'No code pending. Please request a new one.' });
    }
    if (Date.now() > session.otpExpiry) {
      session.otpHash = null;
      session.otpExpiry = null;
      await session.save();
      return res.status(400).json({ error: 'Code expired. Please request a new one.' });
    }
    if (hashOtp(String(otp).trim()) !== session.otpHash) {
      return res.status(400).json({ error: 'Incorrect code. Please try again.' });
    }

    session.partnerAccountId = session.pendingAccountId;
    session.partnerAccountName = session.pendingAccountName;
    session.partnerType = session.pendingPartnerType;
    session.contactId = session.pendingContactId;
    session.name = session.pendingName;
    session.email = session.pendingEmail;

    session.otpHash = null;
    session.otpExpiry = null;
    session.pendingAccountId = null;
    session.pendingAccountName = null;
    session.pendingPartnerType = null;
    session.pendingContactId = null;
    session.pendingName = null;
    session.pendingEmail = null;
    await session.save();

    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const session = await getSession(req, res);
    await session.destroy();
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
