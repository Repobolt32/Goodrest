'use client';

import { useEffect, useState } from 'react';
import { History, Search, Inbox } from 'lucide-react';
import { getSettlementHistory } from '@/app/actions/settlementActions';

interface Settlement {
  id: string;
  rider_id: string;
  week_start: string;
  week_end: string;
  total_deliveries: number;
  total_earnings: number;
  total_bonus: number;
  total_amount: number;
  settled_at: string;
  notes: string | null;
  riders: { name: string; phone: string } | null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function formatWeek(weekStart: string, weekEnd: string): string {
  const fmt = { day: 'numeric', month: 'short' } as const;
  const start = new Date(weekStart).toLocaleDateString('en-IN', fmt);
  const end = new Date(weekEnd).toLocaleDateString('en-IN', fmt);
  return `${start} – ${end}`;
}

export default function SettlementHistory() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    getSettlementHistory().then((res) => {
      if (res.success && res.data) {
        setSettlements(res.data as unknown as Settlement[]);
      }
      setLoading(false);
    });
  }, []);

  const filtered = settlements.filter((s) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    const name = s.riders?.name?.toLowerCase() || '';
    const phone = s.riders?.phone || '';
    return name.includes(q) || phone.includes(q);
  });

  if (loading) {
    return (
      <div className="glass-card p-6 animate-pulse">
        <div className="h-5 w-48 bg-slate-200 rounded mb-4" />
        <div className="h-64 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  return (
    <section className="glass-card overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
          <History size={16} /> Settlement History
        </h3>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search rider..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8 pr-4 py-2 text-xs font-bold border border-slate-200 rounded-lg focus:outline-none focus:border-primary w-48"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-12 text-center">
          <Inbox size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-bold text-slate-400">
            {filter ? 'No matches found' : 'No settlements yet'}
          </p>
          <p className="text-xs text-slate-300 mt-1">
            {filter ? 'Try a different search' : 'Settled weeks will appear here'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Rider</th>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Week</th>
                <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Orders</th>
                <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Earnings</th>
                <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Bonus</th>
                <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Total Paid</th>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Settled On</th>
                <th className="text-left px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, idx) => (
                <tr key={s.id} className={`border-b border-slate-50 last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                  <td className="px-6 py-3">
                    <p className="text-sm font-bold text-slate-800">{s.riders?.name || 'Unknown'}</p>
                    <p className="text-[10px] text-slate-400 font-bold">{s.riders?.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-xs font-bold text-slate-600">{formatWeek(s.week_start, s.week_end)}</td>
                  <td className="text-right px-4 py-3 text-sm font-bold text-slate-600">{s.total_deliveries}</td>
                  <td className="text-right px-4 py-3 text-sm font-bold text-slate-600">{formatCurrency(s.total_earnings)}</td>
                  <td className="text-right px-4 py-3 text-sm font-bold text-emerald-600">{formatCurrency(s.total_bonus)}</td>
                  <td className="text-right px-6 py-3 text-sm font-black text-slate-900">{formatCurrency(s.total_amount)}</td>
                  <td className="px-4 py-3 text-xs font-bold text-slate-500">{formatDate(s.settled_at)}</td>
                  <td className="px-6 py-3 text-xs text-slate-400">{s.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
