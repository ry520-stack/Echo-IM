import prisma from '../utils/prisma';

const FURNITURE_SEED = [
  { name: '普通小床', type: 'bed', rarity: 'common', price: 80, width: 3, height: 2, icon: 'bed', comfortValue: 12 },
  { name: '粉色沙发', type: 'sofa', rarity: 'common', price: 90, width: 3, height: 1, icon: 'sofa', comfortValue: 10 },
  { name: '木制桌子', type: 'table', rarity: 'common', price: 55, width: 2, height: 2, icon: 'table', comfortValue: 6 },
  { name: '小圆椅', type: 'chair', rarity: 'common', price: 35, width: 1, height: 1, icon: 'chair', comfortValue: 4 },
  { name: '温馨地毯', type: 'carpet', rarity: 'rare', price: 120, width: 3, height: 2, icon: 'rug', comfortValue: 18 },
  { name: '爱心台灯', type: 'lamp', rarity: 'rare', price: 110, width: 1, height: 1, icon: 'lamp', comfortValue: 14 },
  { name: '简约墙纸', type: 'wallpaper', rarity: 'common', price: 70, width: 0, height: 0, icon: 'wallpaper', comfortValue: 8 },
  { name: '木纹地板', type: 'floor', rarity: 'common', price: 70, width: 0, height: 0, icon: 'floor', comfortValue: 8 },
  { name: '宠物窝', type: 'pet_item', rarity: 'rare', price: 150, width: 2, height: 2, icon: 'pet-bed', comfortValue: 20 },
  { name: '纪念相框', type: 'decoration', rarity: 'rare', price: 130, width: 1, height: 1, icon: 'frame', comfortValue: 16 },
  { name: '厨房灶台', type: 'kitchen', rarity: 'epic', price: 260, width: 2, height: 1, icon: 'stove', comfortValue: 26 },
  { name: '小冰箱', type: 'kitchen', rarity: 'rare', price: 180, width: 1, height: 2, icon: 'fridge', comfortValue: 18 },
  { name: '阳台花架', type: 'plant', rarity: 'rare', price: 150, width: 2, height: 1, icon: 'plant', comfortValue: 17 },
  { name: '懒人沙发', type: 'sofa', rarity: 'epic', price: 320, width: 2, height: 2, icon: 'beanbag', comfortValue: 34 },
  { name: '梦幻吊灯', type: 'lamp', rarity: 'epic', price: 360, width: 2, height: 1, icon: 'chandelier', comfortValue: 38 },
];

let seeded = false;

export async function ensureLeisureSeedData() {
  if (seeded) return;

  for (const item of FURNITURE_SEED) {
    const existingItems = await (prisma as any).furnitureCatalog.findMany({
      where: { type: item.type, icon: item.icon, isLimited: false },
      orderBy: { createdAt: 'asc' },
    });

    if (existingItems.length > 0) {
      const [keeper, ...duplicates] = existingItems;
      await prisma.$transaction(async tx => {
        await (tx as any).furnitureCatalog.update({ where: { id: keeper.id }, data: item });
        for (const duplicate of duplicates) {
          await mergeFurnitureInventory(tx, duplicate.id, keeper.id);
          await (tx as any).homePlacedFurniture.updateMany({
            where: { furnitureId: duplicate.id },
            data: { furnitureId: keeper.id },
          });
          await (tx as any).furnitureCatalog.delete({ where: { id: duplicate.id } });
        }
      });
    } else {
      await (prisma as any).furnitureCatalog.create({ data: item });
    }
  }

  seeded = true;
}

async function mergeFurnitureInventory(tx: any, fromFurnitureId: string, toFurnitureId: string) {
  const sourceRows = await tx.userFurnitureInventory.findMany({ where: { furnitureId: fromFurnitureId } });
  for (const source of sourceRows) {
    await tx.userFurnitureInventory.upsert({
      where: { userId_furnitureId: { userId: source.userId, furnitureId: toFurnitureId } },
      create: { userId: source.userId, furnitureId: toFurnitureId, quantity: source.quantity },
      update: { quantity: { increment: source.quantity } },
    });
  }
  await tx.userFurnitureInventory.deleteMany({ where: { furnitureId: fromFurnitureId } });
}
