import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Coins } from 'lucide-react';
import { buyFurniture, getFurnitureCatalog, getMyFurniture, type FurnitureCatalogItem, type UserFurnitureInventory } from '../../api/furniture';
import { getGameWallet, type GameWallet } from '../../api/gameWallet';
import FurnitureItem from '../../components/leisure/FurnitureItem';
import CoinBar from '../../components/leisure/CoinBar';
import { useToast } from '../../contexts/ToastContext';

const categories = [
  { key: '', label: '推荐' },
  { key: 'bed', label: '床' },
  { key: 'sofa', label: '沙发' },
  { key: 'table', label: '桌椅' },
  { key: 'lamp', label: '灯具' },
  { key: 'decoration', label: '装饰' },
  { key: 'kitchen', label: '厨房' },
  { key: 'plant', label: '植物' },
  { key: 'pet_item', label: '宠物' },
];

export default function FurnitureShopPage() {
  const nav = useNavigate();
  const toast = useToast();
  const [catalog, setCatalog] = useState<FurnitureCatalogItem[]>([]);
  const [inventory, setInventory] = useState<UserFurnitureInventory[]>([]);
  const [wallet, setWallet] = useState<GameWallet | null>(null);
  const [category, setCategory] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = async () => {
    const [items, owned, money] = await Promise.all([getFurnitureCatalog(), getMyFurniture(), getGameWallet()]);
    setCatalog(items);
    setInventory(owned);
    setWallet(money);
  };

  useEffect(() => { load().catch(() => toast('加载商城失败', 'error')); }, []);

  const ownedMap = useMemo(() => new Map(inventory.map(item => [item.furnitureId, item.quantity])), [inventory]);
  const visible = category ? catalog.filter(item => item.type === category) : catalog;

  const buy = async (item: FurnitureCatalogItem) => {
    setBusyId(item.id);
    try {
      await buyFurniture(item.id, 1);
      toast('家具已放入背包', 'success');
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : '购买失败', 'error');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#f6f5fb] px-4 pb-8 pt-[calc(env(safe-area-inset-top,0px)+14px)] dark:bg-gray-950">
      <header className="flex items-center justify-between">
        <button onClick={() => nav('/couple/leisure-home')} className="rounded-2xl bg-white p-3 text-gray-700 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:text-gray-100"><ChevronLeft size={20} /></button>
        <h1 className="text-xl font-black text-gray-950 dark:text-gray-50">家具商城</h1>
        <CoinBar balance={wallet?.balance || 0} />
      </header>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {categories.map(item => (
          <button key={item.key} onClick={() => setCategory(item.key)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${category === item.key ? 'bg-gray-950 text-white dark:bg-white dark:text-gray-950' : 'bg-white text-gray-500 dark:bg-gray-900'}`}>
            {item.label}
          </button>
        ))}
      </div>
      <main className="mt-4 grid grid-cols-2 gap-3">
        {visible.map(item => (
          <section key={item.id} className="rounded-[24px] bg-white p-3 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
            <FurnitureItem item={item} />
            <p className="mt-3 text-sm font-black text-gray-950 dark:text-gray-50">{item.name}</p>
            <p className="mt-1 text-xs text-gray-500">{item.rarity} · 舒适度 +{item.comfortValue}</p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-sm font-bold text-amber-600"><Coins size={14} />{item.price}</span>
              <button disabled={busyId === item.id} onClick={() => buy(item)} className="rounded-full bg-rose-500 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                {ownedMap.get(item.id) ? `已有${ownedMap.get(item.id)}` : '购买'}
              </button>
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
