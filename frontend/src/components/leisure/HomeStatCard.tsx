import type { ReactNode } from 'react';

export default function HomeStatCard({ label, value, icon }: { label: string; value: ReactNode; icon?: ReactNode }) {
  return (
    <section className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
      <div className="mb-3 text-rose-500">{icon}</div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-gray-950 dark:text-gray-50">{value}</p>
    </section>
  );
}
