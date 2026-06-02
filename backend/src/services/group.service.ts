import prisma from '../utils/prisma';
import { getIO } from './socket.service';

const memberSelect = {
  userId: true,
  role: true,
  alias: true,
  remark: true,
  joinedAt: true,
  user: { select: { id: true, username: true, nickname: true, avatar: true, digitalId: true } },
};

function canManage(role?: string) {
  return role === 'owner' || role === 'admin';
}

function notifyGroupUpdated(groupId: string, action: string, userIds: string[] = []) {
  const io = getIO();
  if (!io) return;
  io.to(`group:${groupId}`).emit('group:updated', { groupId, action });
  userIds.forEach(userId => io.to(`user:${userId}`).emit('group:updated', { groupId, action }));
}

function removeUsersFromGroupRoom(groupId: string, userIds: string[]) {
  const io = getIO();
  if (!io || userIds.length === 0) return;
  io.in(userIds.map(userId => `user:${userId}`)).socketsLeave(`group:${groupId}`);
}

export async function getMyGroups(userId: string) {
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    include: {
      group: {
        include: {
          members: {
            select: memberSelect,
          },
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });

  return memberships.map(m => ({
    id: m.groupId,
    name: m.group.name,
    avatar: m.group.avatar,
    notice: m.group.notice,
    creatorId: m.group.creatorId,
    role: m.role,
    alias: m.alias,
    remark: m.remark,
    memberCount: m.group._count.members,
    members: m.group.members,
    createdAt: m.group.createdAt,
  }));
}

export async function getGroupDetail(groupId: string, userId: string) {
  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
  if (!member) throw new Error('你不在该群组中');

  const group = await prisma.groupChat.findUnique({
    where: { id: groupId },
    include: {
      members: { select: memberSelect, orderBy: [{ role: 'desc' }, { joinedAt: 'asc' }] },
      _count: { select: { members: true, messages: true } },
    },
  });
  if (!group) throw new Error('群组不存在');

  return {
    id: group.id,
    name: group.name,
    avatar: group.avatar,
    notice: group.notice,
    creatorId: group.creatorId,
    role: member.role,
    alias: member.alias,
    remark: member.remark,
    memberCount: group._count.members,
    messageCount: group._count.messages,
    members: group.members,
    createdAt: group.createdAt,
  };
}

export async function createGroup(userId: string, name: string, memberIds: string[] = [], avatar?: string, notice?: string) {
  const uniqueMemberIds = [...new Set(memberIds.filter(id => id && id !== userId))];
  const group = await prisma.groupChat.create({
    data: {
      name,
      avatar,
      notice,
      creatorId: userId,
      members: {
        create: [
          { userId, role: 'owner' },
          ...uniqueMemberIds.map(id => ({ userId: id, role: 'member' as const })),
        ],
      },
    },
    include: {
      members: {
        select: memberSelect,
      },
    },
  });

  const io = getIO();
  if (io) {
    const memberRooms = [userId, ...uniqueMemberIds].map(id => `user:${id}`);
    io.in(memberRooms).socketsJoin(`group:${group.id}`);
    memberRooms.forEach(room => io.to(room).emit('group:updated', { groupId: group.id, action: 'created' }));
  }

  return group;
}

export async function renameGroup(groupId: string, userId: string, name: string) {
  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
  if (!member || !canManage(member.role)) {
    throw new Error('无权修改群名');
  }

  const group = await prisma.groupChat.update({ where: { id: groupId }, data: { name } });
  notifyGroupUpdated(groupId, 'profile-updated');
  return group;
}

export async function updateGroupProfile(groupId: string, userId: string, data: { name?: string; avatar?: string | null; notice?: string | null }) {
  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
  if (!member || !canManage(member.role)) throw new Error('无权修改群资料');
  const group = await prisma.groupChat.update({
    where: { id: groupId },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.avatar !== undefined ? { avatar: data.avatar } : {}),
      ...(data.notice !== undefined ? { notice: data.notice } : {}),
    },
  });
  notifyGroupUpdated(groupId, 'profile-updated');
  return group;
}

export async function updateMyGroupProfile(groupId: string, userId: string, data: { alias?: string | null; remark?: string | null }) {
  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
  if (!member) throw new Error('你不在该群组中');
  const updatedMember = await prisma.groupMember.update({
    where: { groupId_userId: { groupId, userId } },
    data: {
      ...(data.alias !== undefined ? { alias: data.alias?.trim() || null } : {}),
      ...(data.remark !== undefined ? { remark: data.remark?.trim() || null } : {}),
    },
  });
  notifyGroupUpdated(groupId, 'member-profile-updated');
  return updatedMember;
}

export async function addMembers(groupId: string, userId: string, memberIds: string[]) {
  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
  if (!member) throw new Error('你不在该群组中');

  const uniqueMemberIds = [...new Set(memberIds.filter(id => id && id !== userId))];

  // Get existing members
  const existing = await prisma.groupMember.findMany({
    where: { groupId, userId: { in: uniqueMemberIds } },
    select: { userId: true },
  });
  const existingIds = new Set(existing.map(e => e.userId));
  const toAdd = uniqueMemberIds.filter(id => !existingIds.has(id));

  if (toAdd.length === 0) throw new Error('所选用户已在群组中');

  await prisma.groupMember.createMany({
    data: toAdd.map(id => ({ groupId, userId: id, role: 'member' })),
  });

  const io = getIO();
  if (io) {
    io.in(toAdd.map(id => `user:${id}`)).socketsJoin(`group:${groupId}`);
    toAdd.forEach(id => io.to(`user:${id}`).emit('group:updated', { groupId, action: 'added' }));
    notifyGroupUpdated(groupId, 'members-added');
  }

  return prisma.groupChat.findUnique({
    where: { id: groupId },
    include: {
      members: {
        select: memberSelect,
      },
    },
  });
}

export async function removeMember(groupId: string, operatorId: string, targetUserId: string) {
  const operator = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: operatorId } } });
  if (!operator) throw new Error('你不在该群组中');

  const target = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: targetUserId } } });
  if (!target) throw new Error('目标用户不在群组中');

  // Owner can remove anyone, admin can remove members
  if (operator.role !== 'owner' && operator.role !== 'admin') {
    throw new Error('无权移除成员');
  }
  if (target.role === 'owner') {
    throw new Error('不能移除群主');
  }
  if (operator.role === 'admin' && target.role === 'admin') {
    throw new Error('管理员不能移除其他管理员');
  }

  const removedMember = await prisma.groupMember.delete({ where: { id: target.id } });
  removeUsersFromGroupRoom(groupId, [targetUserId]);
  notifyGroupUpdated(groupId, 'member-removed');
  getIO()?.to(`user:${targetUserId}`).emit('group:updated', { groupId, action: 'access-revoked' });
  return removedMember;
}

export async function updateMemberRole(groupId: string, operatorId: string, targetUserId: string, role: string) {
  if (!['admin', 'member'].includes(role)) throw new Error('角色不合法');
  const operator = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: operatorId } } });
  if (!operator || operator.role !== 'owner') throw new Error('只有群主可以设置管理员');
  const target = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: targetUserId } } });
  if (!target) throw new Error('目标用户不在群组中');
  if (target.role === 'owner') throw new Error('不能修改群主角色');
  const updatedMember = await prisma.groupMember.update({ where: { groupId_userId: { groupId, userId: targetUserId } }, data: { role } });
  notifyGroupUpdated(groupId, 'member-role-updated');
  return updatedMember;
}

export async function transferOwner(groupId: string, operatorId: string, targetUserId: string) {
  if (operatorId === targetUserId) throw new Error('不能转让给自己');
  const operator = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: operatorId } } });
  if (!operator || operator.role !== 'owner') throw new Error('只有群主可以转让群');
  const target = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: targetUserId } } });
  if (!target) throw new Error('目标用户不在群组中');

  await prisma.$transaction([
    prisma.groupChat.update({ where: { id: groupId }, data: { creatorId: targetUserId } }),
    prisma.groupMember.update({ where: { groupId_userId: { groupId, userId: operatorId } }, data: { role: 'admin' } }),
    prisma.groupMember.update({ where: { groupId_userId: { groupId, userId: targetUserId } }, data: { role: 'owner' } }),
  ]);
  notifyGroupUpdated(groupId, 'owner-transferred');
  return getGroupDetail(groupId, operatorId);
}

export async function leaveGroup(groupId: string, userId: string) {
  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
  if (!member) throw new Error('你不在该群组中');
  if (member.role === 'owner') throw new Error('群主需要先转让群，或直接解散群');
  await prisma.groupMember.delete({ where: { groupId_userId: { groupId, userId } } });
  removeUsersFromGroupRoom(groupId, [userId]);
  notifyGroupUpdated(groupId, 'member-left');
  getIO()?.to(`user:${userId}`).emit('group:updated', { groupId, action: 'access-revoked' });
}

export async function dismissGroup(groupId: string, userId: string) {
  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
  if (!member || member.role !== 'owner') throw new Error('只有群主可以解散群');
  const members = await prisma.groupMember.findMany({ where: { groupId }, select: { userId: true } });
  await prisma.groupChat.delete({ where: { id: groupId } });
  const memberIds = members.map(item => item.userId);
  removeUsersFromGroupRoom(groupId, memberIds);
  notifyGroupUpdated(groupId, 'dismissed', memberIds);
}
