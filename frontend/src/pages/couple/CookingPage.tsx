import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChefHat, Clock, Heart, Soup } from 'lucide-react';
import CoinBar from '../../components/leisure/CoinBar';
import { getGameWallet, type GameWallet } from '../../api/gameWallet';
import { useToast } from '../../contexts/ToastContext';

type CookingJob = {
  id: string;
  recipeId: string;
  recipeName: string;
  reward: string;
  startedAt: number;
  finishesAt: number;
  status: 'cooking' | 'done' | 'claimed';
};

const recipes = [
  { id: 'egg', name: '爱心煎蛋', time: 60, cost: '鸡蛋 x1', reward: '爱心早餐', rarity: '日常' },
  { id: 'noodle', name: '番茄面', time: 120, cost: '番茄 x1 · 面粉 x1', reward: '热腾腾的面', rarity: '温暖' },
  { id: 'milk', name: '热牛奶', time: 90, cost: '牛奶 x1', reward: '睡前热牛奶', rarity: '陪伴' },
  { id: 'cake', name: '草莓蛋糕', time: 240, cost: '草莓 x2 · 面粉 x1', reward: '纪念日甜点', rarity: '稀有' },
  { id: 'pet', name: '宠物营养餐', time: 180, cost: '胡萝卜 x1 · 牛奶 x1', reward: '宠物心情 +10', rarity: '宠物' },
  { id: 'bento', name: '情侣便当', time: 300, cost: '鸡蛋 x1 · 番茄 x1 · 小麦 x1', reward: '小屋舒适感 +1', rarity: '情侣' },
];

const storeKey = 'echo-leisure-cooking-jobs';

export default function CookingPage() {
  const nav = useNavigate();
  const toast = useToast();
  const [wallet, setWallet] = useState<GameWallet | null>(null);
  const [jobs, setJobs] = useState<CookingJob[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    getGameWallet().then(setWallet).catch(() => {});
    try {
      setJobs(JSON.parse(localStorage.getItem(storeKey) || '[]'));
    } catch {
      setJobs([]);
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem(storeKey, JSON.stringify(jobs));
  }, [jobs]);

  const activeJobs = useMemo(() => jobs.filter(job => job.status !== 'claimed'), [jobs]);

  const start = (recipe: typeof recipes[number]) => {
    if (activeJobs.filter(job => job.status === 'cooking').length >= 2) {
      toast('最多同时做 2 道料理', 'info');
      return;
    }
    setJobs(prev => [{
      id: `cook_${Date.now()}`,
      recipeId: recipe.id,
      recipeName: recipe.name,
      reward: recipe.reward,
      startedAt: Date.now(),
      finishesAt: Date.now() + recipe.time * 1000,
      status: 'cooking',
    }, ...prev]);
    toast('开始做饭了', 'success');
  };

  const claim = (jobId: string) => {
    setJobs(prev => prev.map(job => job.id === jobId ? { ...job, status: 'claimed' } : job));
    toast('料理已收进背包', 'success');
  };

  return (
    <div className="h-full overflow-y-auto bg-[#f6f5fb] px-4 pb-8 pt-[calc(env(safe-area-inset-top,0px)+14px)] dark:bg-gray-950">
      <header className="flex items-center justify-between">
        <button onClick={() => nav('/couple/leisure-home')} className="rounded-2xl bg-white p-3 text-gray-700 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:text-gray-100"><ChevronLeft size={20} /></button>
        <div className="text-center">
          <p className="text-xs font-semibold text-rose-400">Echo Kitchen</p>
          <h1 className="text-xl font-black text-gray-950 dark:text-gray-50">情侣厨房</h1>
        </div>
        <CoinBar balance={wallet?.balance || 0} />
      </header>

      <section className="mt-5 rounded-[30px] bg-gradient-to-br from-orange-300 via-rose-300 to-pink-400 p-5 text-white shadow-lg shadow-rose-300/25">
        <ChefHat size={34} />
        <h2 className="mt-4 text-2xl font-black">一起做点热乎的</h2>
        <p className="mt-2 text-sm text-white/80">料理后续会接入种植食材、宠物喂食、订单提交和情侣任务。</p>
      </section>

      <h2 className="mb-3 mt-5 text-sm font-black text-gray-950 dark:text-gray-50">正在制作</h2>
      <section className="space-y-3">
        {activeJobs.length ? activeJobs.map(job => {
          const left = Math.max(0, job.finishesAt - now);
          const done = left <= 0;
          return (
            <div key={job.id} className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-black text-gray-950 dark:text-gray-50">{job.recipeName}</p>
                  <p className="mt-1 text-xs text-gray-500">{done ? '已完成' : `剩余 ${Math.ceil(left / 1000)} 秒`} · {job.reward}</p>
                </div>
                <button disabled={!done} onClick={() => claim(job.id)} className="rounded-full bg-gray-950 px-4 py-2 text-xs font-bold text-white disabled:bg-gray-200 disabled:text-gray-400">领取</button>
              </div>
            </div>
          );
        }) : <Empty text="还没有料理，先选一个食谱吧" />}
      </section>

      <h2 className="mb-3 mt-5 text-sm font-black text-gray-950 dark:text-gray-50">食谱</h2>
      <main className="grid grid-cols-2 gap-3">
        {recipes.map(recipe => (
          <button key={recipe.id} onClick={() => start(recipe)} className="rounded-[24px] bg-white p-4 text-left shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900">
            <Soup className="text-rose-500" size={24} />
            <p className="mt-3 text-base font-black text-gray-950 dark:text-gray-50">{recipe.name}</p>
            <p className="mt-1 text-xs text-gray-500">{recipe.cost}</p>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1 text-gray-500"><Clock size={13} />{recipe.time}s</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 font-bold text-rose-500"><Heart size={12} />{recipe.rarity}</span>
            </div>
          </button>
        ))}
      </main>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-[24px] bg-white p-6 text-center text-sm text-gray-400 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900">{text}</div>;
}
