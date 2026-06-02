import { Request, Response } from 'express';
import * as friendService from '../services/friend.service';

export async function getFriends(req: Request, res: Response) {
  try {
    const friends = await friendService.getFriends(req.userId);
    res.json(friends);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

export async function getRelationshipSummary(req: Request, res: Response) {
  try {
    const summary = await friendService.getRelationshipSummary(req.userId, req.params.peerId);
    res.json(summary);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function updateRelationshipSettings(req: Request, res: Response) {
  try {
    const summary = await friendService.updateRelationshipSettings(req.userId, req.params.peerId, req.body || {});
    res.json(summary);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function getEchoRankings(req: Request, res: Response) {
  try {
    const rankings = await friendService.getEchoRankings(req.userId);
    res.json(rankings);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

export async function getPending(req: Request, res: Response) {
  try {
    const requests = await friendService.getPendingRequests(req.userId);
    res.json(requests);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

export async function sendRequest(req: Request, res: Response) {
  const { peerId, alias } = req.body;
  if (!peerId) {
    return res.status(400).json({ error: 'peerId 为必填' });
  }
  try {
    const result = await friendService.sendRequest(req.userId, peerId, alias);
    res.status(201).json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function acceptRequest(req: Request, res: Response) {
  try {
    await friendService.acceptRequest(req.params.id, req.userId);
    res.json({ message: '已接受好友申请' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function rejectRequest(req: Request, res: Response) {
  try {
    await friendService.rejectRequest(req.params.id, req.userId);
    res.json({ message: '已拒绝好友申请' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function updateAlias(req: Request, res: Response) {
  const { alias } = req.body;
  try {
    const result = await friendService.updateAlias(req.params.id, req.userId, alias);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function removeFriend(req: Request, res: Response) {
  try {
    await friendService.removeFriend(req.params.id, req.userId);
    res.json({ message: '已删除好友' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function togglePin(req: Request, res: Response) {
  try {
    const result = await friendService.togglePin(req.params.id, req.userId);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function setBackground(req: Request, res: Response) {
  const { background } = req.body;
  try {
    const result = await friendService.setBackground(req.params.id, req.userId, background);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function toggleMute(req: Request, res: Response) {
  try {
    const result = await friendService.toggleMute(req.params.id, req.userId);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function toggleHidden(req: Request, res: Response) {
  try {
    const result = await friendService.toggleHidden(req.params.id, req.userId);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}
