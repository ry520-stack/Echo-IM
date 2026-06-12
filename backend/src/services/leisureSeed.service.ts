import prisma from '../utils/prisma';

const cafe = '/leisure/cafe/assets';

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

  { name: '咖啡圆桌', type: 'table', rarity: 'common', price: 60, width: 2, height: 2, icon: 'cafe-table-00', imageUrl: `${cafe}/deco/DECO_00/DECO_00_00.png`, comfortValue: 8 },
  { name: '木质餐椅', type: 'chair', rarity: 'common', price: 42, width: 1, height: 1, icon: 'cafe-chair-01', imageUrl: `${cafe}/deco/DECO_00/DECO_00_01.png`, comfortValue: 5 },
  { name: '双人餐桌', type: 'table', rarity: 'rare', price: 138, width: 3, height: 2, icon: 'cafe-table-02', imageUrl: `${cafe}/deco/DECO_00/DECO_00_02.png`, comfortValue: 18 },
  { name: '吧台高椅', type: 'chair', rarity: 'rare', price: 96, width: 1, height: 2, icon: 'cafe-chair-03', imageUrl: `${cafe}/deco/DECO_00/DECO_00_03.png`, comfortValue: 12 },
  { name: '咖啡柜台', type: 'kitchen', rarity: 'rare', price: 220, width: 3, height: 2, icon: 'cafe-counter-04', imageUrl: `${cafe}/deco/DECO_00/DECO_00_04.png`, comfortValue: 24 },
  { name: '甜品展示柜', type: 'kitchen', rarity: 'epic', price: 360, width: 3, height: 2, icon: 'cafe-display-05', imageUrl: `${cafe}/deco/DECO_00/DECO_00_05.png`, comfortValue: 36 },
  { name: '咖啡机', type: 'kitchen', rarity: 'rare', price: 180, width: 1, height: 1, icon: 'coffee-machine-06', imageUrl: `${cafe}/deco/DECO_00/DECO_00_06.png`, comfortValue: 20 },
  { name: '餐具收纳柜', type: 'storage', rarity: 'common', price: 100, width: 2, height: 2, icon: 'cafe-storage-07', imageUrl: `${cafe}/deco/DECO_00/DECO_00_07.png`, comfortValue: 12 },
  { name: '暖光落地灯', type: 'lamp', rarity: 'rare', price: 150, width: 1, height: 2, icon: 'cafe-lamp-08', imageUrl: `${cafe}/deco/DECO_00/DECO_00_08.png`, comfortValue: 18 },
  { name: '窗边绿植', type: 'plant', rarity: 'common', price: 76, width: 1, height: 1, icon: 'cafe-plant-09', imageUrl: `${cafe}/deco/DECO_00/DECO_00_09.png`, comfortValue: 9 },

  { name: '奶油餐桌', type: 'table', rarity: 'rare', price: 160, width: 2, height: 2, icon: 'cream-table-00', imageUrl: `${cafe}/deco/DECO_01/DECO_01_00_00.png`, comfortValue: 21 },
  { name: '烘焙小柜', type: 'storage', rarity: 'rare', price: 190, width: 2, height: 2, icon: 'bakery-cabinet-01', imageUrl: `${cafe}/deco/DECO_01/DECO_01_01_00.png`, comfortValue: 22 },
  { name: '草莓甜品台', type: 'kitchen', rarity: 'epic', price: 420, width: 3, height: 2, icon: 'strawberry-dessert-02', imageUrl: `${cafe}/deco/DECO_01/DECO_01_02_00.png`, comfortValue: 42 },
  { name: '小熊装饰架', type: 'decoration', rarity: 'rare', price: 170, width: 1, height: 2, icon: 'bear-shelf-03', imageUrl: `${cafe}/deco/DECO_01/DECO_01_03_00.png`, comfortValue: 19 },
  { name: '玻璃花瓶', type: 'decoration', rarity: 'common', price: 88, width: 1, height: 1, icon: 'vase-04', imageUrl: `${cafe}/deco/DECO_01/DECO_01_04_00.png`, comfortValue: 10 },
  { name: '午后沙发椅', type: 'sofa', rarity: 'rare', price: 210, width: 2, height: 2, icon: 'lazy-chair-05', imageUrl: `${cafe}/deco/DECO_01/DECO_01_05_00.png`, comfortValue: 28 },
  { name: '情侣靠窗桌', type: 'table', rarity: 'epic', price: 460, width: 3, height: 2, icon: 'couple-window-table-06', imageUrl: `${cafe}/deco/DECO_01/DECO_01_06_00.png`, comfortValue: 46 },
  { name: '餐厅挂画', type: 'decoration', rarity: 'common', price: 75, width: 1, height: 1, icon: 'cafe-painting-07', imageUrl: `${cafe}/deco/DECO_01/DECO_01_07_00.png`, comfortValue: 8 },
  { name: '复古收银台', type: 'storage', rarity: 'epic', price: 520, width: 3, height: 2, icon: 'cashier-08', imageUrl: `${cafe}/deco/DECO_01/DECO_01_08_00.png`, comfortValue: 50 },
  { name: '小屋招牌', type: 'decoration', rarity: 'rare', price: 150, width: 2, height: 1, icon: 'signboard-09', imageUrl: `${cafe}/deco/DECO_01/DECO_01_09_00.png`, comfortValue: 16 },

  { name: '料理备餐台', type: 'kitchen', rarity: 'rare', price: 240, width: 3, height: 2, icon: 'cook-station-00', imageUrl: `${cafe}/deco/DECO_02/DECO_02_00.png`, comfortValue: 30 },
  { name: '果茶小推车', type: 'kitchen', rarity: 'rare', price: 260, width: 2, height: 2, icon: 'tea-cart-01', imageUrl: `${cafe}/deco/DECO_02/DECO_02_01.png`, comfortValue: 31 },
  { name: '甜点托盘', type: 'decoration', rarity: 'common', price: 66, width: 1, height: 1, icon: 'dessert-tray-02', imageUrl: `${cafe}/deco/DECO_02/DECO_02_02.png`, comfortValue: 7 },
  { name: '花园餐位', type: 'table', rarity: 'epic', price: 480, width: 3, height: 2, icon: 'garden-seat-03', imageUrl: `${cafe}/deco/DECO_02/DECO_02_03.png`, comfortValue: 48 },
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
