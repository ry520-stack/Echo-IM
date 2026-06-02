import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, FileHeart, Gift, PieChart } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';

interface Contract {
  id: string; title: string; content: string; deadline?: string; penalty: string; status: string;
}
interface Report {
  activeDays: number; messageCount: number; photoCount: number; callMinutes: number;
  pet?: { name: string; level: number; experience: number; intimacy: number; coins: number; skin: string } | null;
}
interface Config {
  events: Array<{ key: string; title: string; description: string; endsAt: string }>;
  skins: Array<{ key: string; name: string; limited: boolean }>;
}
interface Cycle {
  periodStart?: string; cycleLength?: number; periodLength?: number; shareWithPartner?: boolean;
  isPeriodActive?: boolean; nextPeriodAt?: string;
}

export default function RelationshipCarePanel({ myCycle, peerCycle, currentSkin, onRefresh }: {
  myCycle?: Cycle | null; peerCycle?: Cycle | null; currentSkin?: string; onRefresh: () => void;
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
    setReport(nextReport); setContracts(nextContracts); setConfig(nextConfig);
  }, []);
  useEffect(() => { load().catch(() => {}); }, [load]);
  useEffect(() => {
    setCycle({
      periodStart: myCycle?.periodStart ? new Date(myCycle.periodStart).toISOString().slice(0, 10) : '',
      cycleLength: myCycle?.cycleLength || 28,
      periodLength: myCycle?.periodLength || 5,
      shareWithPartner: !!myCycle?.shareWithPartner,
    });
  }, [myCycle]);

  const run = async (request: () => Promise<any>, message: string) => {
    setBusy(true);
    try { await request(); await load(); onRefresh(); toast(message, 'success'); }
    catch (error: any) { toast(error.message || '操作失败', 'error'); }
    finally { setBusy(false); }
  };

  return <section className="rounded-2xl bg-white/70 p-3 shadow-sm backdrop-blur dark:bg-gray-900/70">
    <div className="flex gap-2 overflow-x-auto pb-3">
      {[
        ['report', '每周报告', PieChart], ['cycle', '生理期关怀', CalendarDays], ['contract', '爱情契约', FileHeart], ['event', '限定活动', Gift],
      ].map(([key, label, Icon]: any) => <button key={key} onClick={() => setTab(key)} className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-xs ${tab === key ? 'bg-violet-500 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}><Icon size={13} />{label}</button>)}
    </div>

    {tab === 'report' && <div className="grid grid-cols-2 gap-2">
      {[['互动天数', `${report?.activeDays || 0} 天`], ['聊天消息', `${report?.messageCount || 0} 条`], ['通话时长', `${report?.callMinutes || 0} 分钟`], ['聊天图片', `${report?.photoCount || 0} 张`]].map(([label, value]) => <div key={label} className="rounded-xl bg-violet-50 p-3 dark:bg-violet-950/25"><p className="text-xs text-gray-400">{label}</p><p className="mt-1 text-sm font-bold text-violet-600">{value}</p></div>)}
      <p className="col-span-2 mt-1 text-xs text-gray-500">{report?.pet ? `宠物摘要：${report.pet.name} · Lv.${report.pet.level} · 亲密度 ${report.pet.intimacy} · ${report.pet.coins} 金币` : '尚未领养共同宠物'}</p>
    </div>}

    {tab === 'cycle' && <div className="space-y-3">
      <p className="text-xs leading-5 text-gray-400">默认仅本人可见。开启共享后，对方只看到关怀摘要。</p>
      <input type="date" value={cycle.periodStart} onChange={e => setCycle({ ...cycle, periodStart: e.target.value })} className="w-full rounded-xl bg-gray-100 px-3 py-2 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />
      <div className="grid grid-cols-2 gap-2">
        <input type="number" value={cycle.cycleLength} onChange={e => setCycle({ ...cycle, cycleLength: Number(e.target.value) })} placeholder="周期天数" className="rounded-xl bg-gray-100 px-3 py-2 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />
        <input type="number" value={cycle.periodLength} onChange={e => setCycle({ ...cycle, periodLength: Number(e.target.value) })} placeholder="经期天数" className="rounded-xl bg-gray-100 px-3 py-2 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"><input type="checkbox" checked={cycle.shareWithPartner} onChange={e => setCycle({ ...cycle, shareWithPartner: e.target.checked })} />主动共享关怀摘要给情侣</label>
      <button disabled={busy} onClick={() => run(() => api('PATCH', '/api/couples/cycle', cycle), '生理期设置已保存')} className="w-full rounded-xl bg-violet-500 py-2.5 text-sm font-semibold text-white">保存隐私设置</button>
      {peerCycle && <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-600 dark:bg-rose-950/25">对方已共享：{peerCycle.isPeriodActive ? '当前处于需要关怀的时间' : `预计下次：${peerCycle.nextPeriodAt ? new Date(peerCycle.nextPeriodAt).toLocaleDateString() : '--'}`}</p>}
    </div>}

    {tab === 'contract' && <div className="space-y-3">
      <input value={contract.title} onChange={e => setContract({ ...contract, title: e.target.value })} placeholder="契约标题" className="w-full rounded-xl bg-gray-100 px-3 py-2 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />
      <textarea value={contract.content} onChange={e => setContract({ ...contract, content: e.target.value })} placeholder="约定内容" className="min-h-16 w-full rounded-xl bg-gray-100 px-3 py-2 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />
      <input type="date" value={contract.deadline} onChange={e => setContract({ ...contract, deadline: e.target.value })} className="w-full rounded-xl bg-gray-100 px-3 py-2 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />
      <input value={contract.penalty} onChange={e => setContract({ ...contract, penalty: e.target.value })} placeholder="违约惩罚，可选" className="w-full rounded-xl bg-gray-100 px-3 py-2 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />
      <button disabled={busy || !contract.title.trim()} onClick={() => run(async () => { await api('POST', '/api/couples/contracts', contract); setContract({ title: '', content: '', deadline: '', penalty: '' }); }, '爱情契约已创建')} className="w-full rounded-xl bg-violet-500 py-2.5 text-sm font-semibold text-white disabled:opacity-40">创建契约</button>
      {contracts.map(item => <div key={item.id} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/70"><p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{item.title}</p><p className="mt-1 text-xs text-gray-500">{item.content}</p>{item.penalty && <p className="mt-1 text-xs text-amber-500">违约惩罚：{item.penalty}</p>}<div className="mt-2 flex gap-2"><button disabled={item.status === 'completed'} onClick={() => run(() => api('PATCH', `/api/couples/contracts/${item.id}`, { status: 'completed' }), '契约已标记完成')} className="text-xs text-emerald-500">{item.status === 'completed' ? '已完成' : '标记完成'}</button><button onClick={() => run(() => api('PATCH', `/api/couples/contracts/${item.id}`, { status: 'archived' }), '契约已归档')} className="text-xs text-gray-400">归档</button></div></div>)}
    </div>}

    {tab === 'event' && <div className="space-y-3">
      {config.events.map(event => <div key={event.key} className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/20"><p className="text-sm font-semibold text-amber-700 dark:text-amber-300">{event.title}</p><p className="mt-1 text-xs text-gray-500">{event.description}</p><p className="mt-1 text-[11px] text-gray-400">截止：{new Date(event.endsAt).toLocaleDateString()}</p></div>)}
      <p className="pt-1 text-xs font-semibold text-gray-500">宠物装扮</p>
      <div className="grid grid-cols-2 gap-2">{config.skins.map(skin => <button key={skin.key} disabled={busy} onClick={() => run(() => api('PATCH', '/api/couples/pet-skin', { skin: skin.key }), '宠物装扮已切换')} className={`rounded-xl border px-3 py-3 text-left text-xs ${currentSkin === skin.key ? 'border-violet-500 bg-violet-50 text-violet-600 dark:bg-violet-950/25' : 'border-gray-100 text-gray-500 dark:border-gray-800'}`}>{skin.name}{skin.limited && <span className="ml-1 text-amber-500">限定</span>}</button>)}</div>
    </div>}
  </section>;
}
