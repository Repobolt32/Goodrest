'use client';

import { useEffect, useState } from 'react';
import { Bike, Check, Clock, AlertCircle } from 'lucide-react';
import { getWeeklyRiderPayouts } from '@/app/actions/ownerActions';
import { settleWeeklyPayout } from '@/app/actions/settlementActions';
import { getCurrentWeekRange } from '@/lib/weekRange';

interface RiderPayout {
  riderId: string;
  riderName: string;
  riderPhone: string;
  weekDeliveries: number;
  weekDeliveryFees: number;
  weekPickupPay: number;
  weekBonus: number;
  weekTotalDue: number;
  isSettled?: boolean;
  settledAmount?: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(amount);
}

export default function RiderPayoutsPanel() {
  const [payouts, setPayouts] = useState<RiderPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { weekStart, weekEnd } = getCurrentWeekRange();

  useEffect(() => {
    getWeeklyRiderPayouts().then(async (res) => {
      if (res && res.success && res.data) {
        setPayouts(res.data);
      } else {
        setPayouts([]);
      }
      setLoading(false);
    });
  }, [weekStart]);

  const handleSettle = async (payout: RiderPayout) => {
    if (!confirm(`Settle ${payout.riderName} for ${formatCurrency(payout.weekTotalDue)}?`)) return;

    setSettlingId(payout.riderId);
    setError(null);

    const result = await settleWeeklyPayout({
      riderId: payout.riderId,
      weekStart,
      weekEnd,
      notes: notes[payout.riderId] || undefined,
    });

    if (!result.success) {
      setError(result.error || 'Failed to settle');
    } else {
      setPayouts(prev => prev.map(p =>
        p.riderId === payout.riderId ? { ...p, isSettled: true } : p
      ));
    }
    setSettlingId(null);
  };

  if (loading) {
    return (
      <div className="glass-card p-6 animate-pulse">
        <div className="h-5 w-48 bg-slate-200 rounded mb-4" />
        <div className="h-32 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  if (payouts.length === 0) {
    return (
      <section className="glass-card p-12 text-center">
        <Bike size={32} className="mx-auto text-slate-300 mb-3" />
        <p className="text-sm font-bold text-slate-400">No rider payouts this week</p>
        <p className="text-xs text-slate-300 mt-1">Riders with deliveries will appear here</p>
      </section>
    );
  }

  const totals = payouts.reduce(
    (acc, p) => ({
      deliveries: acc.deliveries + p.weekDeliveries,
      deliveryFees: acc.deliveryFees + p.weekDeliveryFees,
      pickupPay: acc.pickupPay + p.weekPickupPay,
      bonus: acc.bonus + p.weekBonus,
      total: acc.total + p.weekTotalDue,
    }),
    { deliveries: 0, deliveryFees: 0, pickupPay: 0, bonus: 0, total: 0 }
  );

  return (
    <section className="glass-card overflow-hidden">
      <div className="p-6 border-b border-slate-100">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
          <Bike size={16} /> Rider Payouts (This Week)
        </h3>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-xs font-bold">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Rider</th>
              <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Orders</th>
              <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Delivery</th>
              <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Pickup</th>
              <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Bonus</th>
              <th className="text-right px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Total Due</th>
              <th className="text-center px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Action</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((p, idx) => {
              const isSettled = p.isSettled || false;
              return (
                <tr key={p.riderId} className={`border-b border-slate-50 last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                  <td className="px-6 py-3">
                    <p className="text-sm font-bold text-slate-800">{p.riderName}</p>
                    <p className="text-[10px] text-slate-400 font-bold">{p.riderPhone}</p>
                  </td>
                  <td className="text-right px-4 py-3 text-sm font-bold text-slate-600">{p.weekDeliveries}</td>
                  <td className="text-right px-4 py-3 text-sm font-bold text-slate-600">{formatCurrency(p.weekDeliveryFees)}</td>
                  <td className="text-right px-4 py-3 text-sm font-bold text-slate-600">{formatCurrency(p.weekPickupPay)}</td>
                  <td className="text-right px-4 py-3 text-sm font-bold text-emerald-600">{formatCurrency(p.weekBonus)}</td>
                  <td className="text-right px-6 py-3 text-sm font-black text-slate-900">{formatCurrency(p.weekTotalDue)}</td>
                  <td className="text-center px-4 py-3">
                    {isSettled ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
                        <Check size={12} /> Settled
                      </span>
                    ) : (
                      <div className="flex items-center gap-2 justify-center">
                        <input
                          type="text"
                          placeholder="Note"
                          value={notes[p.riderId] || ''}
                          onChange={(e) => setNotes({ ...notes, [p.riderId]: e.target.value })}
                          className="w-20 sm:w-28 text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:border-primary"
                        />
                        <button
                          onClick={() => handleSettle(p)}
                          disabled={settlingId === p.riderId}
                          className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-white bg-primary hover:bg-primary/90 px-3 py-1.5 rounded-full disabled:opacity-50 transition-colors"
                        >
                          {settlingId === p.riderId ? (
                            <Clock size={12} className="animate-spin" />
                          ) : (
                            <Check size={12} />
                          )}
                          Settle
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t-2 border-slate-200">
              <td className="px-6 py-3 text-xs font-black text-slate-600 uppercase">Total</td>
              <td className="text-right px-4 py-3 text-xs font-black text-slate-600">{totals.deliveries}</td>
              <td className="text-right px-4 py-3 text-xs font-black text-slate-600">{formatCurrency(totals.deliveryFees)}</td>
              <td className="text-right px-4 py-3 text-xs font-black text-slate-600">{formatCurrency(totals.pickupPay)}</td>
              <td className="text-right px-4 py-3 text-xs font-black text-emerald-600">{formatCurrency(totals.bonus)}</td>
              <td className="text-right px-6 py-3 text-sm font-black text-slate-900">{formatCurrency(totals.total)}</td>
              <td className="px-4 py-3" />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
