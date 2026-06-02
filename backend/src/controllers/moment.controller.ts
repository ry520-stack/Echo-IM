import { Request, Response } from 'express';
import * as momentService from '../services/moment.service';
import { getIO } from '../services/socket.service';

export async function getMoments(req: Request, res: Response) {
  const page = parseInt(req.query.page as string) || 1;
  const targetUserId = req.query.userId as string | undefined;
  try {
    const data = await momentService.getMoments(req.userId, page, 20, targetUserId);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

export async function createMoment(req: Request, res: Response) {
  const { content, images, privacyType, targetGroupIds, hiddenUserIds, visibleUserIds, galleryMode, coverIndex } = req.body;
  const contentText = typeof content === 'string' ? content.trim() : '';
  const imageList = Array.isArray(images) ? images : [];
  if (imageList.length > 18) return res.status(400).json({ error: '动态图片最多 18 张' });
  if (!contentText && imageList.length === 0) return res.status(400).json({ error: '内容或图片不能同时为空' });

  const validTypes = ['PUBLIC', 'PRIVATE', 'VISIBLE_TO', 'INVISIBLE_TO'];
  const finalType = validTypes.includes(privacyType) ? privacyType : 'PUBLIC';

  try {
    const moment = await momentService.createMoment(
      req.userId,
      contentText,
      imageList,
      finalType,
      Array.isArray(targetGroupIds) ? targetGroupIds : [],
      Array.isArray(hiddenUserIds) ? hiddenUserIds : [],
      Array.isArray(visibleUserIds) ? visibleUserIds : [],
      galleryMode,
      Number.isInteger(coverIndex) ? coverIndex : parseInt(coverIndex, 10) || 0,
    );
    getIO()?.emit('moment:new', { momentId: moment.id, userId: req.userId });
    res.status(201).json(moment);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function toggleLike(req: Request, res: Response) {
  try {
    const result = await momentService.toggleLike(req.params.id, req.userId);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function addComment(req: Request, res: Response) {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: '内容不能为空' });
  try {
    const comment = await momentService.addComment(req.params.id, req.userId, content.trim());
    res.status(201).json(comment);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function getComments(req: Request, res: Response) {
  try {
    const comments = await momentService.getComments(req.params.id, req.userId);
    res.json(comments);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

export async function deleteMoment(req: Request, res: Response) {
  try {
    await momentService.deleteMoment(req.params.id, req.userId);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function deleteComment(req: Request, res: Response) {
  try {
    await momentService.deleteComment(req.params.id, req.userId);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}
