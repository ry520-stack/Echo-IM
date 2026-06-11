import { z } from 'zod';
import prisma from '../utils/prisma';
import { requireActiveCouple } from './coupleAccess.service';
import { ensureLeisureSeedData } from './leisureSeed.service';
import { changeCoins } from './gameWallet.service';

export const buyFurnitureSchema = z.object({
  furnitureId: z.string().min(1),
  quantity: z.number().int().min(1).max(20).optional().default(1),
});

export async function getCatalog(query: { type?: string; rarity?: string }) {
  await ensureLeisureSeedData();
  return (prisma as any).furnitureCatalog.findMany({
    where: {
      ...(query.type ? { type: query.type } : {}),
      ...(query.rarity ? { rarity: query.rarity } : {}),
    },
    orderBy: [{ isLimited: 'desc' }, { price: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function getMyFurniture(userId: string) {
  await ensureLeisureSeedData();
  return (prisma as any).userFurnitureInventory.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function buyFurniture(userId: string, raw: unknown) {
  const payload = buyFurnitureSchema.parse(raw);
  const { bond } = await requireActiveCouple(userId);
  await ensureLeisureSeedData();
  const furniture = await (prisma as any).furnitureCatalog.findUnique({ where: { id: payload.furnitureId } });
  if (!furniture) throw new Error('家具不存在');
  const now = Date.now();
  if (furniture.startsAt && furniture.startsAt.getTime() > now) throw new Error('该家具还未开售');
  if (furniture.endsAt && furniture.endsAt.getTime() < now) throw new Error('该家具已下架');
  const totalPrice = Number(furniture.price || 0) * payload.quantity;

  await changeCoins({
    userId,
    coupleId: bond.id,
    amount: -totalPrice,
    type: 'furniture_expense',
    source: 'furniture-shop',
    description: `购买${furniture.name} x${payload.quantity}`,
    refType: 'furniture',
    refId: furniture.id,
  });

  const inventory = await (prisma as any).userFurnitureInventory.upsert({
    where: { userId_furnitureId: { userId, furnitureId: furniture.id } },
    create: { userId, furnitureId: furniture.id, quantity: payload.quantity },
    update: { quantity: { increment: payload.quantity } },
  });
  return { furniture, inventory };
}
