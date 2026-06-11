import prisma from '../utils/prisma';

export async function getInventory(userId: string, itemType?: string) {
  return (prisma as any).gameInventoryItem.findMany({
    where: { userId, ...(itemType ? { itemType } : {}) },
    orderBy: [{ itemType: 'asc' }, { updatedAt: 'desc' }],
  });
}
