import { Request, Response } from 'express';
import * as emojiService from '../services/emoji.service';

export async function getEmojis(req: Request, res: Response) {
  try {
    const emojis = await emojiService.getEmojis(req.userId);
    res.json(emojis);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

export async function createEmoji(req: Request, res: Response) {
  const { imageUrl, name } = req.body;
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl 为必填' });
  try {
    const emoji = await emojiService.createEmoji(req.userId, imageUrl, name);
    res.status(201).json(emoji);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function deleteEmoji(req: Request, res: Response) {
  try {
    await emojiService.deleteEmoji(req.params.id, req.userId);
    res.json({ message: '已删除' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function batchDeleteEmojis(req: Request, res: Response) {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids 为必填' });
  }
  try {
    await emojiService.batchDeleteEmojis(ids, req.userId);
    res.json({ message: `已删除 ${ids.length} 个表情` });
  } catch (e: any) {
    console.error('[batchDeleteEmojis Error]', e);
    res.status(500).json({ error: '批量删除失败' });
  }
}

export async function reorderEmojis(req: Request, res: Response) {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids is required' });
  try {
    await emojiService.reorderEmojis(ids, req.userId);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}
