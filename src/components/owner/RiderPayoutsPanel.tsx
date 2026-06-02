'use client';

import { useEffect, useState } from 'react';
import { Bike } from 'lucide-react';
import { getWeeklyRiderPayouts } from '@/app/actions/ownerActions';

interface RiderPayout {
  riderId: string;
  riderName: string;
  riderPhone: string;
  weekDeliveries: number;
  weekDeliveryFees: number;
  weekPickupPay: number;
  weekBonus: number;
  weekTotalDue: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(amount);
}

export default function RiderPayoutsPanel() {
  const [payouts, setPayouts] = useState<RiderPayout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getWeeklyRiderPayouts().then((res) => {
      if (res && res.success && res.data) {
        setPayouts(res.data);
      } else {
        setPayouts([]);
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="glass-card p-6 animate-pulse">
        <div className="h-5 w-48 bg-slate-200 rounded mb-4" />
        <div className="h-32 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  if (payouts.length === 0) return null;

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
            </tr>
          </thead>
          <tbody>
            {payouts.map((p, idx) => (
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
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t-2 border-slate-200">
              <td className="px-6 py-3 text-xs font-black text-slate-600 uppercase">Total</td>
              <td className="text-right px-4 py-3 text-xs font-black text-slate-600">{totals.deliveries}</td>
              <td className="text-right px-4 py-3 text-xs font-black text-slate-600">{formatCurrency(totals.deliveryFees)}</td>
              <td className="text-right px-4 py-3 text-xs font-black text-slate-600">{formatCurrency(totals.pickupPay)}</td>
              <td className="text-right px-4 py-3 text-xs font-black text-emerald-600">{formatCurrency(totals.bonus)}</td>
              <td className="text-right px-6 py-3 text-sm font-black text-slate-900">{formatCurrency(totals.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}