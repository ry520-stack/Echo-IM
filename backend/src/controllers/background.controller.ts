import { Request, Response } from 'express';
import * as backgroundService from '../services/background.service';

export async function getBackgrounds(req: Request, res: Response) {
  try {
    const backgrounds = await backgroundService.getBackgrounds(req.userId);
    res.json(backgrounds);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

export async function updateBackground(req: Request, res: Response) {
  const { page, imageUrl } = req.body;
  if (!page || !['conversation', 'gravity', 'chat'].includes(page)) {
    return res.status(400).json({ error: 'page 必须是 conversation/gravity/chat' });
  }
  try {
    const result = await backgroundService.updateBackground(req.userId, page, imageUrl || '');
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function updateChatBackground(req: Request, res: Response) {
  const { peerId, imageUrl } = req.body;
  if (!peerId) {
    return res.status(400).json({ error: 'peerId 为必填' });
  }
  try {
    const result = await backgroundService.updateChatBackground(req.userId, peerId, imageUrl || '');
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}
