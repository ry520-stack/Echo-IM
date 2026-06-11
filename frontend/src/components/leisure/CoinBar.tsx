import { Coins } from 'lucide-react';

export default function CoinBar({ balance }: { balance: number }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-bold text-amber-700 ring-1 ring-amber-100">
      <Coins size={16} />
      {balance}
    </div>
  );
}
