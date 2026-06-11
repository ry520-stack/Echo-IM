import type { FurnitureCatalogItem } from '../../api/furniture';
import type { PlacedFurniture } from '../../api/leisureHome';
import { furnitureSymbol } from './FurnitureItem';

interface RoomCanvasProps {
  items: PlacedFurniture[];
  catalog: FurnitureCatalogItem[];
  editable?: boolean;
  selectedIndex?: number;
  onSelect?: (index: number) => void;
}

export default function RoomCanvas({ items, catalog, editable = false, selectedIndex = -1, onSelect }: RoomCanvasProps) {
  const catalogMap = new Map(catalog.map(item => [item.id, item]));
  return (
    <div className="relative aspect-[12/8] overflow-hidden rounded-[32px] bg-gradient-to-b from-rose-50 via-orange-50 to-amber-50 p-3 shadow-inner ring-1 ring-black/[0.04]">
      <div className="absolute inset-x-0 top-0 h-[38%] bg-gradient-to-b from-white/80 to-transparent" />
      <div
        className="relative grid h-full w-full rounded-[24px] border border-white/70 bg-white/35"
        style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gridTemplateRows: 'repeat(8, minmax(0, 1fr))' }}
      >
        {editable && Array.from({ length: 96 }).map((_, idx) => (
          <div key={idx} className="border border-white/35" />
        ))}
        {items.map((item, index) => {
          const meta = catalogMap.get(item.furnitureId);
          const rotated = Math.abs(item.rotation % 180) === 90;
          const width = Math.max(1, rotated ? Number(meta?.height || 1) : Number(meta?.width || 1));
          const height = Math.max(1, rotated ? Number(meta?.width || 1) : Number(meta?.height || 1));
          return (
            <button
              key={`${item.furnitureId}-${index}`}
              type="button"
              disabled={!editable}
              onClick={() => onSelect?.(index)}
              className={`z-10 m-0.5 flex items-center justify-center rounded-xl border text-lg font-bold shadow-sm transition ${
                selectedIndex === index ? 'border-rose-400 bg-white text-rose-500 ring-2 ring-rose-200' : 'border-white/70 bg-white/80 text-gray-700'
              }`}
              style={{
                gridColumn: `${item.x + 1} / span ${width}`,
                gridRow: `${item.y + 1} / span ${height}`,
              }}
            >
              {furnitureSymbol(meta)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
