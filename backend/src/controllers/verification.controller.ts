import { Request, Response } from 'express';
import * as verificationService from '../services/verification.service';

export async function getCaptcha(_req: Request, res: Response) {
  try {
    const captcha = await verificationService.generateCaptcha();
    res.json(captcha);
  } catch {
    res.status(500).json({ error: '生成题目失败' });
  }
}

export async function sendCode(req: Request, res: Response) {
  const { email, captchaKey, captchaAnswer } = req.body;
  if (!email) {
    return res.status(400).json({ error: '邮箱为必填' });
  }

  const result = await verificationService.sendCode(email, captchaKey, captchaAnswer);
  if (!result.success) {
    return res.status(400).json({ error: result.message });
  }

  res.json({ message: result.message });
}
