import prisma from '../utils/prisma';

export function orderedPair(userId: string, peerId: string) {
  return userId < peerId ? { userAId: userId, userBId: peerId } : { userAId: peerId, userBId: userId };
}

export function getCouplePeerId(bond: { userAId: string; userBId: string }, userId: string) {
  return bond.userAId === userId ? bond.userBId : bond.userAId;
}

export async function requireActiveCouple(userId: string) {
  const bond = await prisma.coupleBond.findFirst({
    where: {
      status: 'active',
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    orderBy: { updatedAt: 'desc' },
  });
  if (!bond) throw new Error('请先绑定情侣后开启小屋');

  const peerId = getCouplePeerId(bond, userId);
  const block = await prisma.blockList.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: peerId },
        { blockerId: peerId, blockedId: userId },
      ],
    },
  });
  if (block) throw new Error('当前关系已冻结，无法继续情侣小屋互动');

  return { bond, peerId };
}

export async function requireCoupleMember(userId: string, coupleId: string) {
  const bond = await prisma.coupleBond.findFirst({
    where: {
      id: coupleId,
      status: 'active',
      OR: [{ userAId: userId }, { userBId: userId }],
    },
  });
  if (!bond) throw new Error('没有权限访问该情侣小屋');
  return bond;
}
