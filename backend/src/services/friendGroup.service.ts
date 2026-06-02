import prisma from '../utils/prisma';

const DEFAULT_COLOR = '#6366f1';

export async function createGroup(userId: string, name: string, color?: string) {
  return prisma.friendGroup.create({
    data: { userId, name, color: color || DEFAULT_COLOR },
  });
}

export async function updateGroup(groupId: string, userId: string, data: { name?: string; color?: string }) {
  const group = await prisma.friendGroup.findUnique({ where: { id: groupId } });
  if (!group || group.userId !== userId) throw new Error('无权操作');

  return prisma.friendGroup.update({
    where: { id: groupId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.color !== undefined ? { color: data.color || DEFAULT_COLOR } : {}),
    },
  });
}

export async function deleteGroup(groupId: string, userId: string) {
  const group = await prisma.friendGroup.findUnique({ where: { id: groupId } });
  if (!group || group.userId !== userId) throw new Error('无权操作');

  return prisma.friendGroup.delete({ where: { id: groupId } });
}

export async function addMember(groupId: string, peerId: string, userId: string) {
  const group = await prisma.friendGroup.findUnique({ where: { id: groupId } });
  if (!group || group.userId !== userId) throw new Error('无权操作');

  const friendship = await prisma.friend.findFirst({
    where: {
      status: 'accepted',
      OR: [
        { userId, friendId: peerId },
        { userId: peerId, friendId: userId },
      ],
    },
  });
  if (!friendship) throw new Error('只能将好友加入星域');

  return prisma.friendGroupMember.upsert({
    where: { groupId_peerId: { groupId, peerId } },
    create: { groupId, peerId },
    update: {},
  });
}

export async function removeMember(groupId: string, peerId: string, userId: string) {
  const group = await prisma.friendGroup.findUnique({ where: { id: groupId } });
  if (!group || group.userId !== userId) throw new Error('无权操作');

  return prisma.friendGroupMember.deleteMany({ where: { groupId, peerId } });
}

export async function getMyGroups(userId: string) {
  return prisma.friendGroup.findMany({
    where: { userId },
    include: {
      members: {
        include: { peer: { select: { id: true, username: true, nickname: true, avatar: true } } },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}
