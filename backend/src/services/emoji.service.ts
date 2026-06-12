import prisma from '../utils/prisma';

export async function getEmojis(userId: string) {
  return prisma.emoji.findMany({
    where: { userId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });
}

export async function createEmoji(userId: string, imageUrl: string, name: string) {
  const first = await prisma.emoji.findFirst({
    where: { userId },
    orderBy: { sortOrder: 'asc' },
    select: { sortOrder: true },
  });
  return prisma.emoji.create({
    data: { userId, imageUrl, name: name || 'emoji', sortOrder: (first?.sortOrder ?? 0) - 1 },
  });
}

export async function reorderEmojis(ids: string[], userId: string) {
  const owned = await prisma.emoji.findMany({ where: { userId, id: { in: ids } }, select: { id: true } });
  if (owned.length !== new Set(ids).size) throw new Error('Invalid emoji order');
  await prisma.$transaction(ids.map((id, sortOrder) => prisma.emoji.update({
    where: { id },
    data: { sortOrder },
  })));
}

export async function deleteEmoji(id: string, userId: string) {
  const emoji = await prisma.emoji.findUnique({ where: { id } });
  if (!emoji) throw new Error('表情不存在');
  if (emoji.userId !== userId) throw new Error('无权删除');
  return prisma.emoji.delete({ where: { id } });
}

export async function batchDeleteEmojis(ids: string[], userId: string) {
  return prisma.emoji.deleteMany({
    where: { id: { in: ids }, userId },
  });
}
