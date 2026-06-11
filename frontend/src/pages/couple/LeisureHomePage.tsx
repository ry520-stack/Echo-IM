import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Backpack, Brush, ChevronLeft, HeartHandshake, Home, PawPrint, ShoppingBag, Sparkles, SprayCan } from 'lucide-react';
import { getFurnitureCatalog, type FurnitureCatalogItem } from '../../api/furniture';
import { cleanLeisureHome, getLeisureHome, type LeisureHomeBundle } from '../../api/leisureHome';
import CoinBar from '../../components/leisure/CoinBar';
import HomeStatCard from '../../components/leisure/HomeStatCard';
import RoomCanvas from '../../components/leisure/RoomCanvas';
import { useToast } from '../../contexts/ToastContext';

export default function LeisureHomePage() {
  const nav = useNavigate();
  const toast = useToast();
  const [bundle, setBundle] = useState<LeisureHomeBundle | null>(null);
  const [catalog, setCatalog] = useState<FurnitureCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [home, items] = await Promise.all([getLeisureHome(), getFurnitureCatalog()]);
      setBundle(home);
      setCatalog(items);
    } catch (e) {
      toast(e instanceof Error ? e.message : '加载小屋失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const taskProgress = useMemo(() => {
    if (!bundle) return '0/3';
    let done = 0;
    if (bundle.home.cleanliness >= 90) done += 1;
    if (bundle.home.comfortScore > 0) done += 1;
    if (bundle.placed.length > 0) done += 1;
    return `${done}/3`;
  }, [bundle]);

  const clean = async () => {
    try {
      const next = await cleanLeisureHome();
      setBundle(prev => prev ? { ...prev, home: next.home } : prev);
      toast('小屋已打扫干净', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : '打扫失败', 'error');
    }
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center bg-[#f6f5fb] text-sm text-gray-400">加载小屋中...</div>;
  }

  if (!bundle) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-[#f6f5fb] px-6 text-center">
        <Home className="text-rose-400" size={42} />
        <h1 className="mt-4 text-xl font-black text-gray-950">先绑定情侣后开启小屋</h1>
        <button onClick={() => nav('/?space=couple')} className="mt-5 rounded-full bg-gray-950 px-5 py-2.5 text-sm font-bold text-white">返回情侣空间</button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f6f5fb] px-4 pb-8 pt-[calc(env(safe-area-inset-top,0px)+14px)] dark:bg-gray-950">
      <header className="flex items-center justify-between">
        <button onClick={() => nav('/?space=couple')} className="rounded-2xl bg-white p-3 text-gray-700 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:text-gray-100">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <p className="text-xs font-semibold text-rose-400">Echo Home</p>
          <h1 className="text-xl font-black text-gray-950 dark:text-gray-50">情侣休闲小屋</h1>
        </div>
        <CoinBar balance={bundle.myWallet.balance} />
      </header>

      <section className="mt-5 overflow-hidden rounded-[32px] bg-gradient-to-br from-rose-400 via-pink-400 to-orange-300 p-5 text-white shadow-lg shadow-rose-300/25">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-white/75">和 {bundle.peer?.nickname || bundle.peer?.username || '对方'} 的小家</p>
            <h2 className="mt-1 text-3xl font-black">Lv.{bundle.home.level} 温暖小屋</h2>
          </div>
          <div className="rounded-3xl bg-white/18 p-3 backdrop-blur">
            <HeartHandshake size={30} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-2xl bg-white/16 px-2 py-2">舒适度<br /><b className="text-base">{bundle.home.comfortScore}</b></div>
          <div className="rounded-2xl bg-white/16 px-2 py-2">清洁度<br /><b className="text-base">{bundle.home.cleanliness}</b></div>
          <div className="rounded-2xl bg-white/16 px-2 py-2">今日任务<br /><b className="text-base">{taskProgress}</b></div>
        </div>
      </section>

      <section className="mt-4">
        <RoomCanvas items={bundle.placed} catalog={catalog} />
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3">
        <HomeStatCard label="家具上限" value={`${bundle.placed.length}/${bundle.placementLimit}`} icon={<Sparkles size={20} />} />
        <HomeStatCard label="宠物状态" value={bundle.pet ? `${bundle.pet.name || '土豆'} Lv.${bundle.pet.level}` : '未入住'} icon={<PawPrint size={20} />} />
      </section>

      <section className="mt-4 grid grid-cols-4 gap-3">
        <QuickButton icon={<Brush size={20} />} label="装修" onClick={() => nav('/couple/leisure-home/decorate')} />
        <QuickButton icon={<ShoppingBag size={20} />} label="商城" onClick={() => nav('/couple/leisure-home/shop')} />
        <QuickButton icon={<Backpack size={20} />} label="背包" onClick={() => nav('/couple/leisure-home/inventory')} />
        <QuickButton icon={<SprayCan size={20} />} label="打扫" onClick={clean} />
      </section>

      <section className="mt-4 rounded-[26px] bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
        <p className="text-sm font-black text-gray-950 dark:text-gray-50">下一步玩法</p>
        <p className="mt-2 text-xs leading-5 text-gray-500">做饭、种植、订单、爱情银行、科技树和神秘商店会沿用这个小屋基础继续分阶段接入。</p>
      </section>
    </div>
  );
}

function QuickButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 rounded-[22px] bg-white px-2 py-3 text-sm font-bold text-gray-800 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:text-gray-100 dark:ring-white/[0.06]">
      <span className="text-rose-500">{icon}</span>
      {label}
    </button>
  );
}
