import nodemailer from 'nodemailer';

const RESEND_API = 'https://api.resend.com/emails';

function getGmailTransport() {
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });
}

function getQQTransport() {
  const user = process.env.QQ_SMTP_USER || '';
  const pass = process.env.QQ_SMTP_PASS || '';
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: 'smtp.qq.com',
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });
}

async function sendViaTransport(
  transport: ReturnType<typeof nodemailer.createTransport>,
  fromEmail: string,
  email: string,
  code: string,
  label: string,
): Promise<boolean> {
  try {
    await transport.sendMail({
      from: `"Echo" <${fromEmail}>`,
      to: email,
      subject: '验证码 - Echo',
      html: emailTemplate(code),
    });
    return true;
  } catch (e: any) {
    console.error(`[email] ${label} 发送失败:`, e?.message || e);
    return false;
  }
}

async function sendViaResend(email: string, code: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: 'Echo <onboarding@resend.dev>',
      to: [email],
      subject: '验证码 - Echo',
      html: emailTemplate(code),
    }),
    signal: AbortSignal.timeout(15000),
  });

  return res.ok;
}

export async function sendVerificationCode(email: string, code: string): Promise<{ ok: boolean; message: string }> {
  const qqUser = process.env.QQ_SMTP_USER || '';

  // ① QQ邮箱 SMTP（ECS 上稳定可用）
  const qq = getQQTransport();
  if (qq && qqUser) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const ok = await sendViaTransport(qq, qqUser, email, code, 'QQ');
      if (ok) return { ok: true, message: '' };
      if (attempt < 2) await new Promise(r => setTimeout(r, 1500));
    }
  }

  // ② Gmail SMTP（ECS 可能超时，快速尝试一次）
  const gmailUser = process.env.SMTP_USER || '';
  const gmail = getGmailTransport();
  if (gmail && gmailUser) {
    const ok = await sendViaTransport(gmail, gmailUser, email, code, 'Gmail');
    if (ok) return { ok: true, message: '' };
  }

  // ③ Resend API（可选）
  if (process.env.RESEND_API_KEY) {
    try {
      const ok = await sendViaResend(email, code);
      if (ok) return { ok: true, message: '' };
    } catch { /* skip */ }
  }

  return { ok: false, message: '邮件发送失败，请稍后重试' };
}

function emailTemplate(code: string) {
  return `
    <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:30px">
      <h2 style="color:#6366f1;margin:0 0 20px">Echo 回声</h2>
      <p style="color:#333;font-size:15px">你的验证码：</p>
      <div style="border:2px dashed #6366f1;border-radius:10px;padding:18px;text-align:center;margin:16px 0">
        <span style="font-size:32px;font-weight:700;letter-spacing:6px;color:#6366f1">${code}</span>
      </div>
      <p style="color:#86868b;font-size:13px">验证码 5 分钟内有效，请勿转发给他人。</p>
    </div>
  `;
}
