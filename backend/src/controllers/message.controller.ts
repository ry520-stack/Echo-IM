import { Request, Response } from 'express';
import * as messageService from '../services/message.service';
import { getIO } from '../services/socket.service';

export async function getMessages(req: Request, res: Response) {
  const { userId } = req.query;
  const before = req.query.before as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const messages = await messageService.getMessages(req.userId, userId, before, limit);
    res.json(messages);
  } catch (e: any) {
    console.error('[getMessages Error]', e);
    res.status(500).json({ error: 'Failed to get messages' });
  }
}

export async function getGroupMessages(req: Request, res: Response) {
  const { groupId } = req.query;
  const before = req.query.before as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

  if (!groupId || typeof groupId !== 'string') {
    return res.status(400).json({ error: 'groupId is required' });
  }

  try {
    const messages = await messageService.getGroupMessages(req.userId, groupId, before, limit);
    res.json(messages);
  } catch (e: any) {
    console.error('[getGroupMessages Error]', e);
    res.status(500).json({ error: 'Failed to get group messages' });
  }
}

export async function getConversations(req: Request, res: Response) {
  try {
    const conversations = await messageService.getConversations(req.userId);
    res.json(conversations);
  } catch (e: any) {
    console.error('[getConversations Error]', e);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
}

export async function recallMessage(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const msg = await messageService.recallMessage(id, req.userId);
    // 广播撤回事件给相关用�?
    const io = getIO();
    if (io) {
      if (msg.receiverId) {
        io.to(`user:${msg.receiverId}`).emit('message:recalled', { messageId: msg.id });
      } else if (msg.groupId) {
        io.to(`group:${msg.groupId}`).emit('message:recalled', { messageId: msg.id });
      }
    }
    res.json(msg);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function consecutiveDays(req: Request, res: Response) {
  const { peerId } = req.query;
  if (!peerId || typeof peerId !== 'string') {
    return res.status(400).json({ error: 'peerId is required' });
  }
  try {
    const days = await messageService.getConsecutiveDays(req.userId, peerId);
    res.json({ days, userIdA: req.userId, userIdB: peerId });
  } catch (e: any) {
    console.error('[consecutiveDays Error]', e);
    res.status(500).json({ error: 'Failed to get consecutive days' });
  }
}

export async function searchMessages(req: Request, res: Response) {
  const q = (req.query.q as string | undefined)?.trim();
  const peerId = req.query.peerId as string | undefined;
  const groupId = req.query.groupId as string | undefined;
  const date = req.query.date as string | undefined;
  if (!q && !date) {
    return res.status(400).json({ error: 'q or date is required' });
  }
  try {
    const messages = await messageService.searchMessages(req.userId, { query: q, peerId, groupId, date });
    res.json(messages);
  } catch (e: any) {
    console.error('[searchMessages Error]', e);
    res.status(500).json({ error: 'Search failed' });
  }
}

export async function getMessageContext(req: Request, res: Response) {
  try {
    const messages = await messageService.getMessageContext(req.userId, req.params.id);
    res.json(messages);
  } catch (e: any) {
    console.error('[getMessageContext Error]', e);
    res.status(400).json({ error: e.message || 'Failed to get message context' });
  }
}

export async function markRead(req: Request, res: Response) {
  const { peerId, groupId } = req.body;
  if (!peerId && !groupId) return res.status(400).json({ error: 'peerId or groupId is required' });
  try {
    const count = await messageService.markAllRead(req.userId, peerId, groupId);
    res.json({ ok: true, count });
  } catch (e: any) {
    console.error('[markRead Error]', e);
    res.status(500).json({ error: '����Ѷ�ʧ��' });
  }
}
// ——�?Message hiding (soft-delete for requesting user only) ——�?

export async function deleteMessage(req: Request, res: Response) {
  const { id } = req.params;
  try {
    await messageService.hideMessage(req.userId, id);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function batchDelete(req: Request, res: Response) {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids is required' });
  }
  if (ids.length > 100) {
    return res.status(400).json({ error: 'Max 100 messages per batch' });
  }
  try {
    const count = await messageService.batchHideMessages(req.userId, ids);
    res.json({ ok: true, count });
  } catch (e: any) {
    console.error('[batchDelete Error]', e);
    res.status(500).json({ error: 'Batch delete failed' });
  }
}

export async function clearConversation(req: Request, res: Response) {
  const { peerId, groupId } = req.body;
  if (!peerId && !groupId) {
    return res.status(400).json({ error: 'peerId or groupId is required' });
  }
  if (peerId && groupId) {
    return res.status(400).json({ error: 'Only one of peerId or groupId can be provided' });
  }
  try {
    if (peerId) {
      await messageService.clearUserConversation(req.userId, peerId);
    } else {
      await messageService.clearGroupConversation(req.userId, groupId);
    }
    res.json({ ok: true });
  } catch (e: any) {
    console.error('[clearConversation Error]', e);
    res.status(400).json({ error: e.message });
  }
}
