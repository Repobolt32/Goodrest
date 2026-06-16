import SettlementHistory from '@/components/owner/SettlementHistory';

export const metadata = {
  title: 'Settlements | Goodrest Admin',
};

export const dynamic = 'force-dynamic';

export default function SettlementsPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Rider Settlements</h1>
        <p className="text-sm text-slate-400 font-bold mt-1">Weekly payout history for all riders</p>
      </div>
      <SettlementHistory />
    </div>
  );
}
