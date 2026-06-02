import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { verifyCode } from '../services/verification.service';

export async function register(req: Request, res: Response) {
  const { username, email, password, code } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email, password 均为必填' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '密码至少 6 位' });
  }

  // 只要配了任一邮件服务，就强制验证码
  const emailConfigured = process.env.RESEND_API_KEY || process.env.SMTP_USER || process.env.QQ_SMTP_USER;
  if (emailConfigured) {
    if (!code) {
      return res.status(400).json({ error: '请输入验证码' });
    }
    const valid = await verifyCode(email, code);
    if (!valid) {
      return res.status(400).json({ error: '验证码错误或已过期' });
    }
  }

  try {
    const result = await authService.register(username, email, password);
    res.status(201).json(result);
  } catch (e: any) {
    res.status(409).json({ error: e.message });
  }
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email 和 password 为必填' });
  }

  try {
    const result = await authService.login(email, password);
    res.json(result);
  } catch (e: any) {
    const status = e.message === '该邮箱未注册' ? 404 : 401;
    res.status(status).json({ error: e.message });
  }
}

export async function resetPassword(req: Request, res: Response) {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'email, code, newPassword 均为必填' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: '密码至少 6 位' });
  }

  try {
    await authService.resetPassword(email, code, newPassword);
    res.json({ message: '密码已重置，请登录' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}
