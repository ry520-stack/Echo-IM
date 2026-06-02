import crypto from 'crypto';
import prisma from '../utils/prisma';
import { sendVerificationCode } from './email.service';

function generateCode(): string {
  return String(crypto.randomInt(100000, 999999));
}

function randomInt(min: number, max: number): number {
  return crypto.randomInt(min, max + 1);
}

export async function generateCaptcha(): Promise<{ key: string; question: string }> {
  const a = randomInt(1, 20);
  const b = randomInt(1, 20);
  const ops = ['+', '-', '×'];
  const op = ops[randomInt(0, 2)];

  let answer: number;
  let question: string;
  switch (op) {
    case '+': answer = a + b; question = `${a} + ${b} = ?`; break;
    case '-': answer = a - b; question = `${a} - ${b} = ?`; break;
    default: answer = a * b; question = `${a} × ${b} = ?`; break;
  }

  const key = crypto.randomBytes(12).toString('hex');

  await prisma.captcha.deleteMany({ where: { expiresAt: { lt: new Date() } } });

  await prisma.captcha.create({
    data: { key, answer, expiresAt: new Date(Date.now() + 2 * 60 * 1000) },
  });

  return { key, question };
}

async function verifyCaptcha(key: string, answer: number): Promise<boolean> {
  const captcha = await prisma.captcha.findUnique({ where: { key } });
  if (!captcha || captcha.used || captcha.expiresAt < new Date()) return false;

  const correct = captcha.answer === answer;
  await prisma.captcha.update({ where: { key }, data: { used: true } });

  return correct;
}

export async function sendCode(
  email: string,
  captchaKey?: string,
  captchaAnswer?: number,
): Promise<{ success: boolean; message: string }> {
  if (captchaKey) {
    if (captchaAnswer === undefined || captchaAnswer === null) {
      return { success: false, message: '请回答数学题' };
    }
    const ok = await verifyCaptcha(captchaKey, captchaAnswer);
    if (!ok) {
      return { success: false, message: '答案错误，请重新获取题目' };
    }
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return { success: false, message: '该邮箱已被注册' };
  }

  await prisma.verificationCode.deleteMany({ where: { email } });

  const recent = await prisma.verificationCode.findFirst({
    where: { email, createdAt: { gte: new Date(Date.now() - 60000) } },
  });
  if (recent) {
    return { success: false, message: '请60秒后再试' };
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  const result = await sendVerificationCode(email, code);
  if (!result.ok) {
    return { success: false, message: result.message || '邮件发送失败' };
  }

  await prisma.verificationCode.create({
    data: { email, code, expiresAt },
  });

  return { success: true, message: '验证码已发送，5分钟内有效' };
}

export async function verifyCode(email: string, code: string): Promise<boolean> {
  const record = await prisma.verificationCode.findFirst({
    where: { email, code, used: false, expiresAt: { gte: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!record) return false;

  await prisma.verificationCode.update({
    where: { id: record.id },
    data: { used: true },
  });
  return true;
}
