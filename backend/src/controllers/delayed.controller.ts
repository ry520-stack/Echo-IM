import { Request, Response } from 'express';
import * as delayedService from '../services/delayed.service';
import prisma from '../utils/prisma';

export async function schedule(req: Request, res: Response) {
  let { receiverId, groupId, content, type, sendAt } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: '消息内容不能为空' });
  if (!sendAt) return res.status(400).json({ error: '发送时间为必填' });

  // 留空 = 私密日记（发给自己）
  if (!receiverId && !groupId) {
    receiverId = req.userId;
  }
  // Echo ID (6位数字) → UUID
  else if (receiverId && /^\d{6}$/.test(receiverId)) {
    const targetUser = await prisma.user.findUnique({ where: { digitalId: parseInt(receiverId) } });
    if (!targetUser) return res.status(404).json({ error: '接收人不存在' });
    receiverId = targetUser.id;
  }

  try {
    const dm = await delayedService.scheduleMessage(req.userId, {
      receiverId,
      groupId,
      content: content.trim(),
      type: type || 'text',
      sendAt,
    });
    res.status(201).json(dm);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function getScheduled(req: Request, res: Response) {
  try {
    const messages = await delayedService.getScheduledMessages(req.userId);
    res.json(messages);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

export async function cancel(req: Request, res: Response) {
  try {
    await delayedService.cancelScheduled(req.params.id, req.userId);
    res.json({ message: '已取消定时消息' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}
