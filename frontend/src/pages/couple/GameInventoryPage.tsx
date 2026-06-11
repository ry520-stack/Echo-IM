import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { getFurnitureCatalog, getMyFurniture, type FurnitureCatalogItem, type UserFurnitureInventory } from '../../api/furniture';
import { getGameInventory, type GameInventoryItem } from '../../api/gameInventory';
import FurnitureItem from '../../components/leisure/FurnitureItem';
import { useToast } from '../../contexts/ToastContext';

export default function GameInventoryPage() {
  const nav = useNavigate();
  const toast = useToast();
  const [catalog, setCatalog] = useState<FurnitureCatalogItem[]>([]);
  const [furniture, setFurniture] = useState<UserFurnitureInventory[]>([]);
  const [items, setItems] = useState<GameInventoryItem[]>([]);

  useEffect(() => {
    Promise.all([getFurnitureCatalog(), getMyFurniture(), getGameInventory()])
      .then(([all, owned, inventory]) => {
        setCatalog(all);
        setFurniture(owned);
        setItems(inventory);
      })
      .catch(() => toast('加载背包失败', 'error'));
  }, []);

  const catalogMap = useMemo(() => new Map(catalog.map(item => [item.id, item])), [catalog]);

  return (
    <div className="h-full overflow-y-auto bg-[#f6f5fb] px-4 pb-8 pt-[calc(env(safe-area-inset-top,0px)+14px)] dark:bg-gray-950">
      <header className="flex items-center justify-between">
        <button onClick={() => nav('/couple/leisure-home')} className="rounded-2xl bg-white p-3 text-gray-700 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:text-gray-100"><ChevronLeft size={20} /></button>
        <h1 className="text-xl font-black text-gray-950 dark:text-gray-50">小屋背包</h1>
        <button onClick={() => nav('/couple/leisure-home/decorate')} className="rounded-full bg-gray-950 px-4 py-2 text-sm font-bold text-white">去装修</button>
      </header>

      <h2 className="mb-3 mt-5 text-sm font-black text-gray-950 dark:text-gray-50">家具</h2>
      <main className="grid grid-cols-2 gap-3">
        {furniture.map(inv => {
          const item = catalogMap.get(inv.furnitureId);
          if (!item) return null;
          return (
            <section key={inv.id} className="rounded-[24px] bg-white p-3 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
              <FurnitureItem item={item} />
              <p className="mt-3 text-sm font-black text-gray-950 dark:text-gray-50">{item.name}</p>
              <p className="mt-1 text-xs text-gray-500">数量 {inv.quantity} · 舒适度 +{item.comfortValue}</p>
            </section>
          );
        })}
        {!furniture.length && (
          <section className="col-span-2 rounded-[28px] bg-white p-8 text-center shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900">
            <p className="text-sm font-bold text-gray-950 dark:text-gray-50">还没有家具</p>
            <button onClick={() => nav('/couple/leisure-home/shop')} className="mt-4 rounded-full bg-rose-500 px-5 py-2.5 text-sm font-bold text-white">去商城看看</button>
          </section>
        )}
      </main>

      <h2 className="mb-3 mt-5 text-sm font-black text-gray-950 dark:text-gray-50">道具</h2>
      <section className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
        {items.length ? items.map(item => (
          <div key={item.id} className="flex items-center justify-between border-b border-gray-100 py-3 last:border-0 dark:border-gray-800">
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{item.itemType}:{item.itemId}</span>
            <span className="text-xs text-gray-500">x{item.quantity}</span>
          </div>
        )) : <p className="py-6 text-center text-sm text-gray-400">还没有道具</p>}
      </section>
    </div>
  );
}
