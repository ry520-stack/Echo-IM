import { Request, Response } from 'express';
import * as userService from '../services/user.service';

export async function getMe(req: Request, res: Response) {
  try {
    const user = await userService.getUser(req.userId);
    res.json(user);
  } catch {
    res.status(404).json({ error: '用户不存在' });
  }
}

export async function updateMe(req: Request, res: Response) {
  const { nickname, avatar, status, allowStrangerMessage, readReceiptsEnabled, callRingtoneUrl, callRingtoneMode } = req.body;
  try {
    const user = await userService.updateUser(req.userId, {
      nickname,
      avatar,
      status,
      allowStrangerMessage,
      readReceiptsEnabled,
      callRingtoneUrl,
      callRingtoneMode,
    });
    res.json(user);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function search(req: Request, res: Response) {
  const q = req.query.q as string;
  if (!q) {
    return res.status(400).json({ error: 'q 为必填' });
  }
  try {
    const users = await userService.searchUsers(q);
    res.json(users);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
