import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';

const SECRET = process.env.JWT_SECRET;
const EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

if (!SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: 生产环境必须配置 JWT_SECRET 环境变量');
  }
  console.warn('[auth] 未设置 JWT_SECRET 环境变量，使用不安全的临时密钥。请在生产环境中设置 JWT_SECRET。');
}

export interface AuthPayload {
  userId: string;
}

const JWT_SECRET: string = SECRET || 'echo-dev-fallback-not-for-production';

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: EXPIRES } as jwt.SignOptions);
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET) as AuthPayload;
}

async function generateDigitalId(): Promise<number> {
  for (let i = 0; i < 10; i++) {
    const id = 100000 + Math.floor(Math.random() * 900000);
    const exists = await prisma.user.findUnique({ where: { digitalId: id } });
    if (!exists) return id;
  }
  throw new Error('数字ID生成失败，请重试');
}

export async function register(username: string, email: string, password: string) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
  });
  if (existing) {
    throw new Error(existing.username === username ? '用户名已存在' : '邮箱已被注册');
  }

  const hashed = await bcrypt.hash(password, 10);
  const digitalId = await generateDigitalId();
  const user = await prisma.user.create({
    data: { username, email, password: hashed, digitalId },
  });

  const token = signToken({ userId: user.id });
  return { token, user: { id: user.id, username: user.username, email: user.email, digitalId: user.digitalId, nickname: user.nickname, avatar: user.avatar, status: user.status, lastSeenAt: user.lastSeenAt, bgConversation: user.bgConversation, bgGravity: user.bgGravity, bgChat: user.bgChat } };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error('该邮箱未注册');

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new Error('密码错误');

  const token = signToken({ userId: user.id });
  return { token, user: { id: user.id, username: user.username, email: user.email, digitalId: user.digitalId, nickname: user.nickname, avatar: user.avatar, status: user.status, lastSeenAt: user.lastSeenAt, bgConversation: user.bgConversation, bgGravity: user.bgGravity, bgChat: user.bgChat } };
}

export async function resetPassword(email: string, code: string, newPassword: string) {
  const { verifyCode } = await import('./verification.service');
  const valid = await verifyCode(email, code);
  if (!valid) throw new Error('验证码错误或已过期');

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error('该邮箱未注册');

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { email }, data: { password: hashed } });
}
