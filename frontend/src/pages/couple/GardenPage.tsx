import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Clock, Leaf, Sprout, Wheat } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

type Plot = {
  slot: number;
  cropId?: string;
  cropName?: string;
  plantedAt?: number;
  finishesAt?: number;
  status: 'empty' | 'growing' | 'ready';
};

const crops = [
  { id: 'wheat', name: '小麦', time: 90, reward: '小麦 x2', icon: '🌾' },
  { id: 'tomato', name: '番茄', time: 120, reward: '番茄 x2', icon: '🍅' },
  { id: 'strawberry', name: '草莓', time: 180, reward: '草莓 x2', icon: '🍓' },
  { id: 'carrot', name: '胡萝卜', time: 150, reward: '胡萝卜 x2', icon: '🥕' },
  { id: 'mint', name: '薄荷', time: 100, reward: '薄荷 x2', icon: '🌿' },
  { id: 'sunflower', name: '向日葵', time: 240, reward: '向日葵 x1', icon: '🌻' },
];

const storeKey = 'echo-leisure-garden-plots';

export default function GardenPage() {
  const nav = useNavigate();
  const toast = useToast();
  const [plots, setPlots] = useState<Plot[]>(() => Array.from({ length: 6 }, (_, slot) => ({ slot, status: 'empty' })));
  const [selectedCrop, setSelectedCrop] = useState(crops[0].id);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey) || '[]') as Plot[];
      if (saved.length) setPlots(saved);
    } catch {}
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem(storeKey, JSON.stringify(plots));
  }, [plots]);

  const plant = (slot: number) => {
    const crop = crops.find(item => item.id === selectedCrop) || crops[0];
    setPlots(prev => prev.map(plot => plot.slot === slot ? {
      slot,
      cropId: crop.id,
      cropName: crop.name,
      plantedAt: Date.now(),
      finishesAt: Date.now() + crop.time * 1000,
      status: 'growing',
    } : plot));
    toast(`种下了${crop.name}`, 'success');
  };

  const harvest = (slot: number) => {
    const plot = plots.find(item => item.slot === slot);
    setPlots(prev => prev.map(item => item.slot === slot ? { slot, status: 'empty' } : item));
    toast(`${plot?.cropName || '作物'}已收获`, 'success');
  };

  return (
    <div className="h-full overflow-y-auto bg-[#f6f5fb] px-4 pb-8 pt-[calc(env(safe-area-inset-top,0px)+14px)] dark:bg-gray-950">
      <header className="flex items-center justify-between">
        <button onClick={() => nav('/couple/leisure-home')} className="rounded-2xl bg-white p-3 text-gray-700 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:text-gray-100"><ChevronLeft size={20} /></button>
        <div className="text-center">
          <p className="text-xs font-semibold text-emerald-500">Echo Garden</p>
          <h1 className="text-xl font-black text-gray-950 dark:text-gray-50">阳台花园</h1>
        </div>
        <div className="h-11 w-11 rounded-2xl bg-emerald-500 text-white grid place-items-center"><Leaf size={21} /></div>
      </header>

      <section className="mt-5 rounded-[30px] bg-gradient-to-br from-emerald-300 via-lime-300 to-amber-200 p-5 text-gray-950 shadow-lg shadow-emerald-300/20">
        <Sprout size={34} />
        <h2 className="mt-4 text-2xl font-black">种点食材，喂饱小屋</h2>
        <p className="mt-2 text-sm text-gray-700">种出来的食材后续会进入背包，用于做饭、订单和宠物料理。</p>
      </section>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {crops.map(crop => (
          <button key={crop.id} onClick={() => setSelectedCrop(crop.id)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${selectedCrop === crop.id ? 'bg-gray-950 text-white' : 'bg-white text-gray-500'}`}>
            {crop.icon} {crop.name}
          </button>
        ))}
      </div>

      <main className="mt-4 grid grid-cols-2 gap-3">
        {plots.map(plot => {
          const crop = crops.find(item => item.id === plot.cropId);
          const left = Math.max(0, (plot.finishesAt || 0) - now);
          const ready = plot.status !== 'empty' && left <= 0;
          return (
            <section key={plot.slot} className="rounded-[26px] bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900">
              <div className="grid aspect-square place-items-center rounded-[22px] bg-emerald-50 text-4xl">
                {plot.status === 'empty' ? '□' : crop?.icon || '🌱'}
              </div>
              <p className="mt-3 text-sm font-black text-gray-950 dark:text-gray-50">地块 {plot.slot + 1}</p>
              <p className="mt-1 text-xs text-gray-500">
                {plot.status === 'empty' ? '空地' : ready ? '可以收获了' : <><Clock size={12} className="inline" /> 剩余 {Math.ceil(left / 1000)} 秒</>}
              </p>
              <button
                onClick={() => plot.status === 'empty' ? plant(plot.slot) : ready ? harvest(plot.slot) : undefined}
                disabled={plot.status !== 'empty' && !ready}
                className="mt-3 w-full rounded-full bg-emerald-500 px-3 py-2 text-xs font-bold text-white disabled:bg-gray-200 disabled:text-gray-400"
              >
                {plot.status === 'empty' ? '种植' : ready ? '收获' : '成长中'}
              </button>
            </section>
          );
        })}
      </main>

      <section className="mt-4 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900">
        <div className="flex items-center gap-2 text-sm font-black text-gray-950 dark:text-gray-50"><Wheat size={18} className="text-amber-500" /> 作物用途</div>
        <p className="mt-2 text-xs leading-5 text-gray-500">小麦、番茄、草莓、胡萝卜等会进入后续料理、订单、宠物营养餐和情侣任务系统。</p>
      </section>
    </div>
  );
}
