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
  const count = await (prisma as any).furnitureCatalog.count();
  if (count === 0) {
    await (prisma as any).furnitureCatalog.createMany({ data: FURNITURE_SEED });
  }
  seeded = true;
}
