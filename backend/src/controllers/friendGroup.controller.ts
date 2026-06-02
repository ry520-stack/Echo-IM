import { Request, Response } from 'express';
import * as groupService from '../services/friendGroup.service';

const colorPattern = /^#[0-9a-fA-F]{6}$/;

function normalizeColor(color?: string) {
  if (!color) return undefined;
  return colorPattern.test(color) ? color : '#6366f1';
}

export async function createGroup(req: Request, res: Response) {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (!name) return res.status(400).json({ error: '星域名称不能为空' });

  try {
    const group = await groupService.createGroup(req.userId, name, normalizeColor(req.body.color));
    res.status(201).json(group);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function updateGroup(req: Request, res: Response) {
  const data: { name?: string; color?: string } = {};

  if (req.body.name !== undefined) {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name) return res.status(400).json({ error: '星域名称不能为空' });
    data.name = name;
  }
  if (req.body.color !== undefined) data.color = normalizeColor(req.body.color);

  try {
    const group = await groupService.updateGroup(req.params.id, req.userId, data);
    res.json(group);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function deleteGroup(req: Request, res: Response) {
  try {
    await groupService.deleteGroup(req.params.id, req.userId);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function addMember(req: Request, res: Response) {
  const { peerId } = req.body;
  if (!peerId) return res.status(400).json({ error: 'peerId 必填' });

  try {
    await groupService.addMember(req.params.id, peerId, req.userId);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function removeMember(req: Request, res: Response) {
  try {
    await groupService.removeMember(req.params.id, req.params.peerId, req.userId);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function getMyGroups(req: Request, res: Response) {
  try {
    const groups = await groupService.getMyGroups(req.userId);
    res.json(groups);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
