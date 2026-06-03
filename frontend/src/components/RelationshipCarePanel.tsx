import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, FileHeart, Gift, PieChart, Shirt } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';

interface Contract {
  id: string;
  title: string;
  content: string;
  deadline?: string;
  penalty: string;
  status: string;
}

interface Report {
  activeDays: number;
  messageCount: number;
  photoCount: number;
  callMinutes: number;
  pet?: { name: string; level: number; experience: number; intimacy: number; coins: number; skin: string } | null;
}

interface Config {
  events: Array<{ key: string; title: string; description: string; endsAt: string }>;
  skins: Array<{ key: string; name: string; limited: boolean; unlocked: boolean; requirement: string }>;
}

interface Cycle {
  periodStart?: string;
  cycleLength?: number;
  periodLength?: number;
  shareWithPartner?: boolean;
  isPeriodActive?: boolean;
  nextPeriodAt?: string;
}

function dateValue(value?: string) {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}

export default function RelationshipCarePanel({
  myCycle,
  peerCycle,
  currentSkin,
  onRefresh,
}: {
  myCycle?: Cycle | null;
  peerCycle?: Cycle | null;
  currentSkin?: string;
  onRefresh: () => void;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<'report' | 'cycle' | 'contract' | 'event'>('report');
  const [report, setReport] = useState<Report | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [config, setConfig] = useState<Config>({ events: [], skins: [] });
  const [busy, setBusy] = useState(false);
  const [cycle, setCycle] = useState({ periodStart: '', cycleLength: 28, periodLength: 5, shareWithPartner: false });
  const [contract, setContract] = useState({ title: '', content: '', deadline: '', penalty: '' });

  const load = useCallback(async () => {
    const [nextReport, nextContracts, nextConfig] = await Promise.all([
      api<Report>('GET', '/api/couples/weekly-report'),
      api<Contract[]>('GET', '/api/couples/contracts'),
      api<Config>('GET', '/api/couples/activity-config'),
    ]);
    setReport(nextReport);
    setContracts(nextContracts);
    setConfig(nextConfig);
  }, []);

  useEffect(() => { load().catch(() => {}); }, [load]);

  useEffect(() => {
    setCycle({
      periodStart: dateValue(myCycle?.periodStart),
      cycleLength: myCycle?.cycleLength || 28,
      periodLength: myCycle?.periodLength || 5,
      shareWithPartner: !!myCycle?.shareWithPartner,
    });
  }, [myCycle]);

  const run = async (request: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await request();
      await load();
      onRefresh();
      toast(message, 'success');
    } catch (error: any) {
      toast(error.message || '操作失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const tabs = [
    { key: 'report' as const, label: '周报', Icon: PieChart },
    { key: 'cycle' as const, label: '关怀', Icon: CalendarDays },
    { key: 'contract' as const, label: '契约', Icon: FileHeart },
    { key: 'event' as const, label: '活动', Icon: Gift },
  ];

  return (
    <section className="rounded-[28px] border border-white/70 bg-white/85 p-4 shadow-[0_18px_50px_rgba(244,63,94,0.10)] backdrop-blur dark:border-white/10 dark:bg-gray-900/80">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-400">Care</p>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">关怀与承诺</h3>
        </div>
        <div className="flex rounded-2xl bg-gray-100 p-1 dark:bg-gray-800">
          {tabs.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs transition-colors ${tab === key ? 'bg-white text-violet-600 shadow-sm dark:bg-gray-700 dark:text-violet-200' : 'text-gray-400'}`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'report' && (
        <div className="grid grid-cols-2 gap-3">
          {[
            ['互动天数', `${report?.activeDays || 0} 天`],
            ['聊天消息', `${report?.messageCount || 0} 条`],
            ['通话时长', `${report?.callMinutes || 0} 分钟`],
            ['聊天图片', `${report?.photoCount || 0} 张`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-violet-50 p-3 dark:bg-violet-950/25">
              <p className="text-xs text-gray-400">{label}</p>
              <p className="mt-1 text-lg font-bold text-violet-600 dark:text-violet-300">{value}</p>
            </div>
          ))}
          <p className="col-span-2 rounded-2xl bg-gray-50 p-3 text-xs text-gray-500 dark:bg-gray-800/70">
            {report?.pet ? `宠物摘要：${report.pet.name} · Lv.${report.pet.level} · 亲密度 ${report.pet.intimacy} · ${report.pet.coins} 金币` : '尚未领养共同宠物'}
          </p>
        </div>
      )}

      {tab === 'cycle' && (
        <div className="space-y-3">
          <p className="rounded-2xl bg-rose-50 p-3 text-xs leading-5 text-rose-500 dark:bg-rose-950/25">
            生理期默认仅本人可见。开启共享后，对方只看到关怀摘要，不展示完整记录。
          </p>
          <input type="date" value={cycle.periodStart} onChange={e => setCycle({ ...cycle, periodStart: e.target.value })} className="w-full rounded-2xl bg-gray-100 px-3 py-2.5 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={cycle.cycleLength} onChange={e => setCycle({ ...cycle, cycleLength: Number(e.target.value) })} placeholder="周期天数" className="rounded-2xl bg-gray-100 px-3 py-2.5 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />
            <input type="number" value={cycle.periodLength} onChange={e => setCycle({ ...cycle, periodLength: Number(e.target.value) })} placeholder="经期天数" className="rounded-2xl bg-gray-100 px-3 py-2.5 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />
          </div>
          <label className="flex items-center gap-2 rounded-2xl bg-gray-50 px-3 py-2.5 text-sm text-gray-600 dark:bg-gray-800/70 dark:text-gray-300">
            <input type="checkbox" checked={cycle.shareWithPartner} onChange={e => setCycle({ ...cycle, shareWithPartner: e.target.checked })} />
            主动共享关怀摘要给情侣
          </label>
          {peerCycle && (
            <p className="rounded-2xl bg-rose-50 p-3 text-xs text-rose-600 dark:bg-rose-950/25">
              对方已共享：{peerCycle.isPeriodActive ? '当前处于需要关怀的时间' : `预计下次：${peerCycle.nextPeriodAt ? new Date(peerCycle.nextPeriodAt).toLocaleDateString() : '--'}`}
            </p>
          )}
          <button disabled={busy} onClick={() => run(() => api('PATCH', '/api/couples/cycle', cycle), '生理期设置已保存')} className="w-full rounded-2xl bg-violet-500 py-3 text-sm font-semibold text-white disabled:opacity-50">保存隐私设置</button>
        </div>
      )}

      {tab === 'contract' && (
        <div className="space-y-3">
          <input value={contract.title} onChange={e => setContract({ ...contract, title: e.target.value })} placeholder="契约标题" className="w-full rounded-2xl bg-gray-100 px-3 py-2.5 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />
          <textarea value={contract.content} onChange={e => setContract({ ...contract, content: e.target.value })} placeholder="约定内容" className="min-h-20 w-full rounded-2xl bg-gray-100 px-3 py-2.5 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />
          <input type="date" value={contract.deadline} onChange={e => setContract({ ...contract, deadline: e.target.value })} className="w-full rounded-2xl bg-gray-100 px-3 py-2.5 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />
          <input value={contract.penalty} onChange={e => setContract({ ...contract, penalty: e.target.value })} placeholder="违约惩罚，可选" className="w-full rounded-2xl bg-gray-100 px-3 py-2.5 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />
          <button disabled={busy || !contract.title.trim()} onClick={() => run(async () => { await api('POST', '/api/couples/contracts', contract); setContract({ title: '', content: '', deadline: '', penalty: '' }); }, '爱情契约已创建')} className="w-full rounded-2xl bg-violet-500 py-3 text-sm font-semibold text-white disabled:opacity-40">创建契约</button>
          <div className="space-y-2">
            {contracts.map(item => (
              <div key={item.id} className="rounded-2xl bg-gray-50 p-3 dark:bg-gray-800/70">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{item.title}</p>
                <p className="mt-1 text-xs text-gray-500">{item.content}</p>
                {item.penalty && <p className="mt-1 text-xs text-amber-500">违约惩罚：{item.penalty}</p>}
                <div className="mt-2 flex gap-3">
                  <button disabled={item.status === 'completed'} onClick={() => run(() => api('PATCH', `/api/couples/contracts/${item.id}`, { status: 'completed' }), '契约已标记完成')} className="flex items-center gap-1 text-xs text-emerald-500">
                    <CheckCircle2 size={13} />{item.status === 'completed' ? '已完成' : '标记完成'}
                  </button>
                  <button onClick={() => run(() => api('PATCH', `/api/couples/contracts/${item.id}`, { status: 'archived' }), '契约已归档')} className="text-xs text-gray-400">归档</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'event' && (
        <div className="space-y-3">
          {config.events.map(event => (
            <div key={event.key} className="rounded-2xl bg-amber-50 p-3 dark:bg-amber-950/20">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">{event.title}</p>
              <p className="mt-1 text-xs text-gray-500">{event.description}</p>
              <p className="mt-1 text-[11px] text-gray-400">截止：{new Date(event.endsAt).toLocaleDateString()}</p>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1 text-xs font-semibold text-gray-500"><Shirt size={14} />宠物装扮</div>
          <div className="grid grid-cols-2 gap-2">
            {config.skins.map(skin => (
              <button key={skin.key} disabled={busy || !skin.unlocked} onClick={() => run(() => api('PATCH', '/api/couples/pet-skin', { skin: skin.key }), '宠物装扮已切换')} className={`rounded-2xl border px-3 py-3 text-left text-xs disabled:opacity-50 ${currentSkin === skin.key ? 'border-violet-500 bg-violet-50 text-violet-600 dark:bg-violet-950/25' : 'border-gray-100 text-gray-500 dark:border-gray-800'}`}>
                {skin.name}{skin.limited && <span className="ml-1 text-amber-500">限定</span>}
                <span className="mt-1 block text-[10px] text-gray-400">{skin.unlocked ? '已解锁' : skin.requirement}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
