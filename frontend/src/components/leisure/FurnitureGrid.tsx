import type { FurnitureCatalogItem, UserFurnitureInventory } from '../../api/furniture';
import FurnitureItem from './FurnitureItem';

export default function FurnitureGrid({
  catalog,
  inventory,
  onPick,
}: {
  catalog: FurnitureCatalogItem[];
  inventory: UserFurnitureInventory[];
  onPick: (item: FurnitureCatalogItem) => void;
}) {
  const ownedMap = new Map(inventory.map(item => [item.furnitureId, item.quantity]));
  return (
    <div className="grid grid-cols-2 gap-3">
      {catalog.map(item => (
        <button
          key={item.id}
          type="button"
          disabled={!ownedMap.get(item.id)}
          onClick={() => onPick(item)}
          className="rounded-[24px] bg-white p-3 text-left shadow-sm ring-1 ring-black/[0.04] disabled:opacity-45 dark:bg-gray-900 dark:ring-white/[0.06]"
        >
          <FurnitureItem item={item} />
          <p className="mt-3 text-sm font-bold text-gray-950 dark:text-gray-50">{item.name}</p>
          <p className="mt-1 text-xs text-gray-500">拥有 {ownedMap.get(item.id) || 0} · 舒适度 +{item.comfortValue}</p>
        </button>
      ))}
    </div>
  );
}
