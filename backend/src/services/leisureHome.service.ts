import { z } from 'zod';
import prisma from '../utils/prisma';
import { requireActiveCouple } from './coupleAccess.service';
import { ensureLeisureSeedData } from './leisureSeed.service';
import { ensureWallet } from './gameWallet.service';

export const ROOM_WIDTH = 12;
export const ROOM_HEIGHT = 8;

const LEVEL_LIMITS: Record<number, number> = {
  1: 12,
  2: 20,
  3: 35,
  4: 50,
  5: 70,
};

const layoutItemSchema = z.object({
  id: z.string().optional(),
  furnitureId: z.string().min(1),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  rotation: z.number().int().optional().default(0),
  layer: z.number().int().optional().default(1),
});

export const saveLayoutSchema = z.object({
  items: z.array(layoutItemSchema).max(80),
});

export function placementLimit(level: number) {
  return LEVEL_LIMITS[Math.min(Math.max(level, 1), 5)] || LEVEL_LIMITS[1];
}

export async function ensureHome(userId: string) {
  await ensureLeisureSeedData();
  const { bond, peerId } = await requireActiveCouple(userId);
  const [home, myWallet, peerWallet] = await prisma.$transaction(async tx => {
    const nextHome = await (tx as any).coupleLeisureHome.upsert({
      where: { coupleId: bond.id },
      create: { coupleId: bond.id },
      update: {},
    });
    const walletA = await ensureWallet(userId, tx as any);
    const walletB = await ensureWallet(peerId, tx as any);
    return [nextHome, walletA, walletB];
  });
  return { bond, peerId, home, myWallet, peerWallet };
}

async function loadHomeBundle(userId: string) {
  const base = await ensureHome(userId);
  const [placed, pet, peer] = await Promise.all([
    (prisma as any).homePlacedFurniture.findMany({
      where: { homeId: base.home.id },
      orderBy: [{ layer: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.petBond.findUnique({
      where: { userAId_userBId: { userAId: base.bond.userAId, userBId: base.bond.userBId } },
    }).catch(() => null),
    prisma.user.findUnique({
      where: { id: base.peerId },
      select: { id: true, username: true, nickname: true, avatar: true, digitalId: true },
    }),
  ]);
  return { ...base, placed, pet, peer, placementLimit: placementLimit(base.home.level) };
}

export async function getHome(userId: string) {
  return loadHomeBundle(userId);
}

export async function cleanHome(userId: string) {
  const { home } = await ensureHome(userId);
  const updated = await (prisma as any).coupleLeisureHome.update({
    where: { id: home.id },
    data: { cleanliness: 100 },
  });
  return { home: updated };
}

export async function saveLayout(userId: string, raw: unknown) {
  const payload = saveLayoutSchema.parse(raw);
  const { bond, peerId, home } = await ensureHome(userId);
  const limit = placementLimit(home.level);
  if (payload.items.length > limit) throw new Error(`当前小屋最多摆放 ${limit} 件家具`);

  const userIds = [userId, peerId];
  const furnitureIds = [...new Set(payload.items.map(item => item.furnitureId))];
  const [catalog, inventories] = await Promise.all([
    (prisma as any).furnitureCatalog.findMany({ where: { id: { in: furnitureIds } } }),
    (prisma as any).userFurnitureInventory.findMany({
      where: { userId: { in: userIds }, furnitureId: { in: furnitureIds } },
    }),
  ]);

  const catalogMap = new Map<string, any>(catalog.map((item: any) => [item.id, item]));
  const owned = new Map<string, number>();
  for (const inv of inventories) {
    owned.set(inv.furnitureId, (owned.get(inv.furnitureId) || 0) + inv.quantity);
  }
  const used = new Map<string, number>();
  const cells = new Set<string>();

  for (const item of payload.items) {
    const meta = catalogMap.get(item.furnitureId);
    if (!meta) throw new Error('家具不存在');
    used.set(item.furnitureId, (used.get(item.furnitureId) || 0) + 1);
    if ((used.get(item.furnitureId) || 0) > (owned.get(item.furnitureId) || 0)) {
      throw new Error(`${meta.name} 库存不足`);
    }
    const width = Math.max(0, Number(meta.width || 0));
    const height = Math.max(0, Number(meta.height || 0));
    if (width === 0 || height === 0) continue;
    const rotated = Math.abs(item.rotation % 180) === 90;
    const w = rotated ? height : width;
    const h = rotated ? width : height;
    if (item.x + w > ROOM_WIDTH || item.y + h > ROOM_HEIGHT) throw new Error(`${meta.name} 超出小屋边界`);
    for (let dx = 0; dx < w; dx += 1) {
      for (let dy = 0; dy < h; dy += 1) {
        const key = `${item.x + dx}:${item.y + dy}`;
        if (cells.has(key)) throw new Error('家具不能重叠摆放');
        cells.add(key);
      }
    }
  }

  const comfortScore = payload.items.reduce((total, item) => {
    const meta = catalogMap.get(item.furnitureId);
    return total + Number(meta?.comfortValue || 0);
  }, 0);

  return prisma.$transaction(async tx => {
    await (tx as any).homePlacedFurniture.deleteMany({ where: { homeId: home.id } });
    if (payload.items.length > 0) {
      await (tx as any).homePlacedFurniture.createMany({
        data: payload.items.map(item => ({
          homeId: home.id,
          userId,
          furnitureId: item.furnitureId,
          x: item.x,
          y: item.y,
          rotation: item.rotation,
          layer: item.layer,
        })),
      });
    }
    const updatedHome = await (tx as any).coupleLeisureHome.update({
      where: { id: home.id },
      data: {
        comfortScore,
        layoutJson: JSON.stringify(payload.items),
      },
    });
    return { bond, home: updatedHome, placed: payload.items };
  });
}
