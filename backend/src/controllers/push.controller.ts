import { Request, Response } from 'express';
import * as pushService from '../services/push.service';

export async function registerDevice(req: Request, res: Response) {
  try {
    const { clientId, platform, appId } = req.body || {};
    if (
      !clientId ||
      typeof clientId !== 'string' ||
      !clientId.trim() ||
      clientId.trim() === 'null' ||
      clientId.trim() === 'undefined'
    ) {
      return res.status(400).json({ error: 'clientId 不能为空' });
    }
    await pushService.registerDevice({
      userId: req.userId,
      clientId,
      platform,
      appId,
    });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message || '绑定推送设备失败' });
  }
}

export async function unregisterDevice(req: Request, res: Response) {
  try {
    const { clientId } = req.body || {};
    if (!clientId || typeof clientId !== 'string') {
      return res.status(400).json({ error: 'clientId 不能为空' });
    }
    await pushService.unregisterDevice(req.userId, clientId);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message || '解绑推送设备失败' });
  }
}
