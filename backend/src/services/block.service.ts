import prisma from '../utils/prisma';
import { getIO } from './socket.service';

function notifyRelationshipUpdated(userId: string, peerId: string, action: string) {
  const io = getIO();
  if (!io) return;
  io.to(`user:${userId}`).emit('relationship:updated', { action, peerId });
  io.to(`user:${peerId}`).emit('relationship:updated', { action, peerId: userId });
}

export async function blockUser(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) throw new Error('不能拉黑自己');

  const existing = await prisma.blockList.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId } },
  });
  if (existing) throw new Error('已拉黑该用户');

  const block = await prisma.blockList.create({ data: { blockerId, blockedId } });

  notifyRelationshipUpdated(blockerId, blockedId, 'blocked');
  return block;
}

export async function unblockUser(blockerId: string, blockedId: string) {
  const block = await prisma.blockList.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId } },
  });
  if (!block) throw new Error('未拉黑该用户');

  await prisma.blockList.delete({ where: { id: block.id } });
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
      status: 'accepted',
      blockedBy: null,
      blockedAt: null,
      deletedBy: null,
      deletedAt: null,
    },
  });
  notifyRelationshipUpdated(blockerId, blockedId, 'unblocked');
}

export async function getBlockedUsers(blockerId: string) {
  const blocks = await prisma.blockList.findMany({
    where: { blockerId },
    include: {
      blocked: {
        select: { id: true, username: true, nickname: true, avatar: true, digitalId: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return Promise.all(blocks.map(async block => ({
    ...block,
    hiddenMessageCount: await prisma.message.count({
      where: {
        senderId: block.blockedId,
        receiverId: blockerId,
        createdAt: { gt: block.createdAt },
        isRecalled: false,
      },
    }),
  })));
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
