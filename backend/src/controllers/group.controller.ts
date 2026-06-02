import { Request, Response } from 'express';
import * as groupService from '../services/group.service';

export async function getMyGroups(req: Request, res: Response) {
  try {
    const groups = await groupService.getMyGroups(req.userId);
    res.json(groups);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

export async function getGroupDetail(req: Request, res: Response) {
  try {
    const group = await groupService.getGroupDetail(req.params.id, req.userId);
    res.json(group);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function createGroup(req: Request, res: Response) {
  const { name, memberIds, avatar, notice } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: '群组名称为必填' });
  }
  try {
    const group = await groupService.createGroup(req.userId, name.trim(), memberIds || [], avatar || undefined, notice?.trim() || undefined);
    res.status(201).json(group);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function updateGroupProfile(req: Request, res: Response) {
  const { name, avatar, notice } = req.body;
  if (name !== undefined && !String(name).trim()) {
    return res.status(400).json({ error: '群组名称不能为空' });
  }
  try {
    const group = await groupService.updateGroupProfile(req.params.id, req.userId, { name, avatar, notice });
    res.json(group);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function updateMyGroupProfile(req: Request, res: Response) {
  const { alias, remark } = req.body;
  try {
    const member = await groupService.updateMyGroupProfile(req.params.id, req.userId, { alias, remark });
    res.json(member);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function renameGroup(req: Request, res: Response) {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: '群组名称为必填' });
  }
  try {
    const group = await groupService.renameGroup(req.params.id, req.userId, name.trim());
    res.json(group);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function addMembers(req: Request, res: Response) {
  const { memberIds } = req.body;
  if (!memberIds || !memberIds.length) {
    return res.status(400).json({ error: 'memberIds 为必填' });
  }
  try {
    const group = await groupService.addMembers(req.params.id, req.userId, memberIds);
    res.json(group);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function removeMember(req: Request, res: Response) {
  const { userId: targetUserId } = req.params;
  try {
    await groupService.removeMember(req.params.id, req.userId, targetUserId);
    res.json({ message: '已移出群组' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function updateMemberRole(req: Request, res: Response) {
  const { role } = req.body;
  try {
    const member = await groupService.updateMemberRole(req.params.id, req.userId, req.params.userId, role);
    res.json(member);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function transferOwner(req: Request, res: Response) {
  const { targetUserId } = req.body;
  if (!targetUserId) return res.status(400).json({ error: 'targetUserId 为必填' });
  try {
    const group = await groupService.transferOwner(req.params.id, req.userId, targetUserId);
    res.json(group);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function leaveGroup(req: Request, res: Response) {
  try {
    await groupService.leaveGroup(req.params.id, req.userId);
    res.json({ message: '已退出群聊' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function dismissGroup(req: Request, res: Response) {
  try {
    await groupService.dismissGroup(req.params.id, req.userId);
    res.json({ message: '群聊已解散' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}
