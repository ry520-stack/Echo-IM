import type { FurnitureCatalogItem } from '../../api/furniture';

const iconMap: Record<string, string> = {
  bed: '🛏',
  sofa: '🛋',
  table: '▣',
  chair: '◑',
  rug: '▤',
  lamp: '◉',
  wallpaper: '▥',
  floor: '▧',
  'pet-bed': '♡',
  frame: '▢',
  stove: '▰',
  fridge: '▱',
  plant: '✿',
  beanbag: '◒',
  chandelier: '✦',
};

export function furnitureSymbol(item?: Pick<FurnitureCatalogItem, 'icon' | 'name'> | null) {
  if (!item) return '□';
  return iconMap[item.icon] || item.name.slice(0, 1);
}

export default function FurnitureItem({ item, compact = false }: { item: FurnitureCatalogItem; compact?: boolean }) {
  return (
    <div className={`flex items-center justify-center rounded-2xl bg-rose-50 text-rose-500 ${compact ? 'h-10 w-10 text-lg' : 'h-16 w-16 text-2xl'}`}>
      {furnitureSymbol(item)}
    </div>
  );
}
