import prisma from '../utils/prisma';
import { getIO } from './socket.service';

function notifyRelationshipUpdated(userId: string, peerId: string, action: string) {
  const io = getIO();
  if (!io) return;
  io.to(`user:${userId}`).emit('relationship:updated', { action, peerId });
  io.to(`user:${peerId}`).emit('relationship:updated', { action, peerId: userId });
}

async function removeFriendGroupMemberships(userId: string, peerId: string) {
  await prisma.friendGroupMember.deleteMany({
    where: {
      OR: [
        { peerId, group: { userId } },
        { peerId: userId, group: { userId: peerId } },
      ],
    },
  });
}

export async function blockUser(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) throw new Error('不能拉黑自己');

  const existing = await prisma.blockList.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId } },
  });
  if (existing) throw new Error('已拉黑该用户');

  // 创建 blockList 记录
  const block = await prisma.blockList.create({ data: { blockerId, blockedId } });

  // 同步更新 Friend 关系为 blocked
  await prisma.friend.updateMany({
    where: {
      OR: [
        { userId: blockerId, friendId: blockedId },
        { userId: blockedId, friendId: blockerId },
      ],
      status: { in: ['accepted', 'pending', 'deleted', 'rejected'] },
    },
    data: {
      status: 'blocked',
      blockedBy: blockerId,
      blockedAt: new Date(),
    },
  });
  await removeFriendGroupMemberships(blockerId, blockedId);

  notifyRelationshipUpdated(blockerId, blockedId, 'blocked');
  return block;
}

export async function unblockUser(blockerId: string, blockedId: string) {
  const block = await prisma.blockList.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId } },
  });
  if (!block) throw new Error('未拉黑该用户');

  // 删除 blockList 记录
  await prisma.blockList.delete({ where: { id: block.id } });

  // 不自动恢复好友关系，改为 deleted
  await prisma.friend.updateMany({
    where: {
      OR: [
        { userId: blockerId, friendId: blockedId },
        { userId: blockedId, friendId: blockerId },
      ],
      status: 'blocked',
      blockedBy: blockerId,
    },
    data: {
      status: 'deleted',
      deletedBy: blockerId,
      deletedAt: new Date(),
      blockedBy: null,
      blockedAt: null,
    },
  });
  notifyRelationshipUpdated(blockerId, blockedId, 'unblocked');
}

export async function getBlockedUsers(blockerId: string) {
  return prisma.blockList.findMany({
    where: { blockerId },
    include: {
      blocked: {
        select: { id: true, username: true, nickname: true, avatar: true, digitalId: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function isBlocked(userId: string, targetId: string): Promise<boolean> {
  const block = await prisma.blockList.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: targetId },
        { blockerId: targetId, blockedId: userId },
      ],
    },
  });
  return !!block;
}

export async function isFriend(userId: string, peerId: string): Promise<boolean> {
  const f = await prisma.friend.findFirst({
    where: {
      status: 'accepted',
      OR: [
        { userId, friendId: peerId },
        { userId: peerId, friendId: userId },
      ],
    },
  });
  return !!f;
}
