import { Request, Response } from 'express';
import { getUploadUrl, deleteUploadFile } from '../services/upload.service';
import prisma from '../utils/prisma';

// POST /api/upload/avatar
export async function uploadAvatar(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ error: '请选择图片文件' });
  }

  // 删除旧头像文件
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { avatar: true } });
  if (user?.avatar) {
    const oldFilename = user.avatar.split('/').pop();
    if (oldFilename) deleteUploadFile(`avatars/${oldFilename}`);
  }

  const url = getUploadUrl(req.file.filename);
  await prisma.user.update({ where: { id: req.userId }, data: { avatar: url } });
  res.json({ url });
}

// POST /api/upload/background
export async function uploadBackground(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ error: '请选择图片文件' });
  }
  const url = getUploadUrl(req.file.filename);
  res.json({ url });
}

// POST /api/upload/chat-image
export async function uploadChatImage(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ error: '请选择图片文件' });
  }
  const url = getUploadUrl(req.file.filename);
  res.json({ url });
}

// POST /api/upload/voice
export async function uploadVoice(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ error: '请提供语音文件' });
  }
  const url = getUploadUrl(req.file.filename);
  res.json({ url });
}

// POST /api/upload/ringtone
export async function uploadRingtone(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ error: '请选择音频文件' });
  }
  const url = getUploadUrl(req.file.filename);
  res.json({ url });
}

// POST /api/upload/video
export async function uploadVideo(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ error: '请选择视频文件' });
  }
  const url = getUploadUrl(req.file.filename);
  res.json({ url });
}

// POST /api/upload/emoji
export async function uploadEmoji(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ error: '请选择图片文件' });
  }
  const url = getUploadUrl(req.file.filename);
  const name = req.body.name || 'emoji';
  const last = await prisma.emoji.findFirst({ where: { userId: req.userId }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
  const emoji = await prisma.emoji.create({
    data: { userId: req.userId, imageUrl: url, name, sortOrder: (last?.sortOrder || 0) + 1 },
  });
  res.status(201).json(emoji);
}
