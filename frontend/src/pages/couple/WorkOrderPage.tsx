import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BriefcaseBusiness, ChevronLeft, Clock, Coins, PackageCheck, Store } from 'lucide-react';
import CoinBar from '../../components/leisure/CoinBar';
import { getGameWallet, type GameWallet } from '../../api/gameWallet';
import { useToast } from '../../contexts/ToastContext';

type WorkJob = {
  id: string;
  title: string;
  reward: number;
  startedAt: number;
  finishesAt: number;
  status: 'working' | 'done' | 'claimed';
};

const workOptions = [
  { id: 'coffee', title: '咖啡店兼职', time: 180, reward: 36, desc: '适合小屋初期的稳定收入' },
  { id: 'flower', title: '花店帮工', time: 240, reward: 48, desc: '有概率获得装饰材料' },
  { id: 'clean', title: '小屋清洁', time: 120, reward: 24, desc: '提升清洁度玩法后会接入' },
  { id: 'pet', title: '宠物陪玩', time: 210, reward: 42, desc: '后续影响宠物心情' },
];

const orders = [
  { id: 'o1', title: '邻居的早餐订单', need: '爱心煎蛋 x1 · 热牛奶 x1', reward: 88 },
  { id: 'o2', title: '甜品柜补货', need: '草莓蛋糕 x1', reward: 130 },
  { id: 'o3', title: '宠物营养餐配送', need: '宠物营养餐 x1', reward: 96 },
];

const storeKey = 'echo-leisure-work-jobs';

export default function WorkOrderPage() {
  const nav = useNavigate();
  const toast = useToast();
  const [wallet, setWallet] = useState<GameWallet | null>(null);
  const [jobs, setJobs] = useState<WorkJob[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    getGameWallet().then(setWallet).catch(() => {});
    try { setJobs(JSON.parse(localStorage.getItem(storeKey) || '[]')); } catch { setJobs([]); }
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem(storeKey, JSON.stringify(jobs));
  }, [jobs]);

  const startWork = (option: typeof workOptions[number]) => {
    if (jobs.filter(job => job.status === 'working').length >= 1) {
      toast('一次只能安排一份打工', 'info');
      return;
    }
    setJobs(prev => [{
      id: `work_${Date.now()}`,
      title: option.title,
      reward: option.reward,
      startedAt: Date.now(),
      finishesAt: Date.now() + option.time * 1000,
      status: 'working',
    }, ...prev]);
    toast('打工开始了', 'success');
  };

  const claimWork = (id: string) => {
    setJobs(prev => prev.map(job => job.id === id ? { ...job, status: 'claimed' } : job));
    toast('奖励已记录，后续会接入金币流水', 'success');
  };

  return (
    <div className="h-full overflow-y-auto bg-[#f6f5fb] px-4 pb-8 pt-[calc(env(safe-area-inset-top,0px)+14px)] dark:bg-gray-950">
      <header className="flex items-center justify-between">
        <button onClick={() => nav('/couple/leisure-home')} className="rounded-2xl bg-white p-3 text-gray-700 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:text-gray-100"><ChevronLeft size={20} /></button>
        <div className="text-center">
          <p className="text-xs font-semibold text-sky-500">Echo Jobs</p>
          <h1 className="text-xl font-black text-gray-950 dark:text-gray-50">打工与订单</h1>
        </div>
        <CoinBar balance={wallet?.balance || 0} />
      </header>

      <section className="mt-5 rounded-[30px] bg-gradient-to-br from-sky-300 via-cyan-300 to-emerald-200 p-5 text-gray-950 shadow-lg shadow-sky-300/20">
        <Store size={34} />
        <h2 className="mt-4 text-2xl font-black">经营小屋的收入来源</h2>
        <p className="mt-2 text-sm text-gray-700">先做打工和订单 MVP，后续会接金币流水、背包扣材料和双方实时同步。</p>
      </section>

      <h2 className="mb-3 mt-5 text-sm font-black text-gray-950 dark:text-gray-50">进行中</h2>
      <section className="space-y-3">
        {jobs.filter(job => job.status !== 'claimed').map(job => {
          const left = Math.max(0, job.finishesAt - now);
          const done = left <= 0;
          return (
            <div key={job.id} className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-black text-gray-950 dark:text-gray-50">{job.title}</p>
                  <p className="mt-1 text-xs text-gray-500">{done ? '已完成' : `剩余 ${Math.ceil(left / 1000)} 秒`} · +{job.reward} 金币</p>
                </div>
                <button disabled={!done} onClick={() => claimWork(job.id)} className="rounded-full bg-gray-950 px-4 py-2 text-xs font-bold text-white disabled:bg-gray-200 disabled:text-gray-400">领取</button>
              </div>
            </div>
          );
        })}
        {!jobs.filter(job => job.status !== 'claimed').length && <Empty text="还没有安排打工" />}
      </section>

      <h2 className="mb-3 mt-5 text-sm font-black text-gray-950 dark:text-gray-50">打工</h2>
      <main className="grid grid-cols-2 gap-3">
        {workOptions.map(option => (
          <button key={option.id} onClick={() => startWork(option)} className="rounded-[24px] bg-white p-4 text-left shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900">
            <BriefcaseBusiness className="text-sky-500" size={24} />
            <p className="mt-3 text-base font-black text-gray-950 dark:text-gray-50">{option.title}</p>
            <p className="mt-1 text-xs leading-4 text-gray-500">{option.desc}</p>
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span className="inline-flex items-center gap-1"><Clock size={13} />{option.time}s</span>
              <span className="inline-flex items-center gap-1 font-bold text-amber-600"><Coins size={13} />{option.reward}</span>
            </div>
          </button>
        ))}
      </main>

      <h2 className="mb-3 mt-5 text-sm font-black text-gray-950 dark:text-gray-50">订单</h2>
      <section className="space-y-3">
        {orders.map(order => (
          <div key={order.id} className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black text-gray-950 dark:text-gray-50">{order.title}</p>
                <p className="mt-1 text-xs text-gray-500">{order.need}</p>
              </div>
              <PackageCheck className="shrink-0 text-emerald-500" size={22} />
            </div>
            <button onClick={() => toast('订单会在背包材料接入后开放提交', 'info')} className="mt-3 w-full rounded-full bg-sky-500 px-4 py-2 text-xs font-bold text-white">提交订单 · +{order.reward}</button>
          </div>
        ))}
      </section>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-[24px] bg-white p-6 text-center text-sm text-gray-400 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900">{text}</div>;
}
