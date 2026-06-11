import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, RotateCw, Save, Trash2 } from 'lucide-react';
import { getFurnitureCatalog, getMyFurniture, type FurnitureCatalogItem, type UserFurnitureInventory } from '../../api/furniture';
import { getLeisureHome, saveLeisureLayout, type PlacedFurniture } from '../../api/leisureHome';
import FurnitureGrid from '../../components/leisure/FurnitureGrid';
import RoomCanvas from '../../components/leisure/RoomCanvas';
import { useToast } from '../../contexts/ToastContext';

export default function HomeDecoratePage() {
  const nav = useNavigate();
  const toast = useToast();
  const [catalog, setCatalog] = useState<FurnitureCatalogItem[]>([]);
  const [inventory, setInventory] = useState<UserFurnitureInventory[]>([]);
  const [items, setItems] = useState<PlacedFurniture[]>([]);
  const [limit, setLimit] = useState(12);
  const [selected, setSelected] = useState(-1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getLeisureHome(), getFurnitureCatalog(), getMyFurniture()])
      .then(([home, all, owned]) => {
        setItems(home.placed || []);
        setLimit(home.placementLimit);
        setCatalog(all);
        setInventory(owned);
      })
      .catch(() => toast('加载装修数据失败', 'error'));
  }, []);

  const catalogMap = useMemo(() => new Map(catalog.map(item => [item.id, item])), [catalog]);

  const addItem = (item: FurnitureCatalogItem) => {
    if (items.length >= limit) {
      toast(`当前最多摆放 ${limit} 件家具`, 'info');
      return;
    }
    setItems(prev => [...prev, { furnitureId: item.id, x: 0, y: 0, rotation: 0, layer: prev.length + 1 }]);
    setSelected(items.length);
  };

  const moveSelected = (dx: number, dy: number) => {
    if (selected < 0) return;
    setItems(prev => prev.map((item, idx) => {
      if (idx !== selected) return item;
      const meta = catalogMap.get(item.furnitureId);
      const w = Math.max(1, Number(meta?.width || 1));
      const h = Math.max(1, Number(meta?.height || 1));
      return { ...item, x: Math.max(0, Math.min(12 - w, item.x + dx)), y: Math.max(0, Math.min(8 - h, item.y + dy)) };
    }));
  };

  const rotate = () => {
    if (selected < 0) return;
    setItems(prev => prev.map((item, idx) => idx === selected ? { ...item, rotation: (item.rotation + 90) % 360 } : item));
  };

  const remove = () => {
    if (selected < 0) return;
    setItems(prev => prev.filter((_, idx) => idx !== selected));
    setSelected(-1);
  };

  const save = async () => {
    setSaving(true);
    try {
      const next = await saveLeisureLayout(items);
      setItems(next.placed || []);
      toast('布局已保存', 'success');
      nav('/couple/leisure-home');
    } catch (e) {
      toast(e instanceof Error ? e.message : '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#f6f5fb] px-4 pb-8 pt-[calc(env(safe-area-inset-top,0px)+14px)] dark:bg-gray-950">
      <header className="flex items-center justify-between">
        <button onClick={() => nav('/couple/leisure-home')} className="rounded-2xl bg-white p-3 text-gray-700 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:text-gray-100"><ChevronLeft size={20} /></button>
        <h1 className="text-xl font-black text-gray-950 dark:text-gray-50">装修小屋</h1>
        <button disabled={saving} onClick={save} className="rounded-2xl bg-gray-950 p-3 text-white disabled:opacity-50"><Save size={20} /></button>
      </header>

      <section className="mt-4">
        <RoomCanvas items={items} catalog={catalog} editable selectedIndex={selected} onSelect={setSelected} />
      </section>

      <section className="mt-3 rounded-[24px] bg-white p-3 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-bold text-gray-950 dark:text-gray-50">已摆放 {items.length}/{limit}</span>
          <div className="flex gap-2">
            <button onClick={rotate} className="rounded-full bg-gray-100 p-2 text-gray-700 dark:bg-gray-800 dark:text-gray-100"><RotateCw size={16} /></button>
            <button onClick={remove} className="rounded-full bg-rose-50 p-2 text-rose-500"><Trash2 size={16} /></button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <MoveButton label="上" onClick={() => moveSelected(0, -1)} />
          <MoveButton label="下" onClick={() => moveSelected(0, 1)} />
          <MoveButton label="左" onClick={() => moveSelected(-1, 0)} />
          <MoveButton label="右" onClick={() => moveSelected(1, 0)} />
        </div>
      </section>

      <h2 className="mb-3 mt-5 text-sm font-black text-gray-950 dark:text-gray-50">我的家具</h2>
      <FurnitureGrid catalog={catalog} inventory={inventory} onPick={addItem} />
    </div>
  );
}

function MoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button onClick={onClick} className="rounded-2xl bg-gray-100 py-2 text-sm font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-100">{label}</button>;
}
