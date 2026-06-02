'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, TrendingUp } from 'lucide-react';
import { getRiderEarningHistory } from '@/app/actions/riderActions';
import WeeklyChart from './WeeklyChart';

interface DayEntry {
  date: string;
  deliveries: number;
  deliveryFees: number;
  pickupPay: number;
  bonus: number;
  total: number;
}

interface WeekTotal {
  deliveries: number;
  earnings: number;
  bonus: number;
  total: number;
}

interface EarningsViewProps {
  riderId: string;
  todayEarnings: number;
  todayDeliveries: number;
  todayDistanceKm: number;
  todayBonus: number;
  todayDeliveryFees: number;
  todayPickupPay: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function EarningsView({
  riderId, todayEarnings, todayDeliveries, todayDistanceKm, todayBonus, todayDeliveryFees, todayPickupPay,
}: EarningsViewProps) {
  const [weekly, setWeekly] = useState<DayEntry[]>([]);
  const [weekTotal, setWeekTotal] = useState<WeekTotal>({ deliveries: 0, earnings: 0, bonus: 0, total: 0 });
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRiderEarningHistory(riderId).then((result) => {
      setWeekly(result.weekly);
      setWeekTotal(result.weekTotal);
      setLoading(false);
    });
  }, [riderId]);

  return (
    <div className="space-y-6">
      {/* Today Summary Card */}
      <div className="glass-card p-5 border-slate-800/50 border-l-4 border-l-emerald-500">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
            <TrendingUp size={20} className="text-emerald-500" />
          </div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Today&apos;s Earnings</span>
        </div>
        <p className="text-3xl font-black text-white">{formatCurrency(todayEarnings)}</p>
        <p className="text-xs text-slate-400 font-bold mt-1">
          {todayDeliveries} deliveries · {todayDistanceKm} km · Bonus: {formatCurrency(todayBonus)}
        </p>
        <p className="text-[10px] text-slate-500 font-bold mt-1">
          Delivery: {formatCurrency(todayDeliveryFees)} + Pickup Pay: {formatCurrency(todayPickupPay)}
        </p>
      </div>

      {/* Weekly Chart */}
      {loading ? (
        <div className="glass-card p-5 border-slate-800/50 animate-pulse">
          <div className="h-4 w-24 bg-slate-800 rounded mb-4" />
          <div className="h-40 bg-slate-800/50 rounded-xl" />
        </div>
      ) : (
        <WeeklyChart data={weekly.map(d => ({ date: d.date, deliveries: d.deliveries, total: d.total, bonus: d.bonus }))} />
      )}

      {/* Daily Breakdown Accordion */}
      {!loading && (
        <div className="glass-card border-slate-800/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800/50">
            <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
              Daily Breakdown
            </h3>
          </div>

          {weekly.filter(d => d.deliveries > 0).reverse().map((day) => (
            <div key={day.date} className="border-b border-slate-800/30 last:border-0">
              <button
                onClick={() => setExpandedDay(expandedDay === day.date ? null : day.date)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/30 transition-colors"
              >
                <span className="text-xs font-bold text-slate-300">&#128197; {formatDate(day.date)}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-slate-500">{day.deliveries} orders</span>
                  <span className="text-xs font-black text-white">{formatCurrency(day.total)}</span>
                  <ChevronDown
                    size={14}
                    className={`text-slate-500 transition-transform duration-200 ${expandedDay === day.date ? 'rotate-180' : ''}`}
                  />
                </div>
              </button>

              <AnimatePresence>
                {expandedDay === day.date && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-4 space-y-1.5 bg-slate-800/10">
                      <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-slate-500">Delivery Pay</span>
                        <span className="text-slate-300">{formatCurrency(day.deliveryFees)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-slate-500">Pickup Pay</span>
                        <span className="text-slate-300">{formatCurrency(day.pickupPay)}</span>
                      </div>
                      {day.bonus > 0 && (
                        <div className="flex justify-between text-[10px] font-bold">
                          <span className="text-emerald-500">Nightly Bonus</span>
                          <span className="text-emerald-400">{formatCurrency(day.bonus)}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}

          {weekly.every(d => d.deliveries === 0) && (
            <div className="px-5 py-8 text-center">
              <p className="text-xs text-slate-500 font-bold">No deliveries this week yet</p>
            </div>
          )}
        </div>
      )}

      {/* Week Total Footer */}
      {!loading && weekTotal.total > 0 && (
        <div className="glass-card p-4 border-slate-800/50 bg-emerald-500/5 border-emerald-500/20">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">This Week</span>
            <span className="text-lg font-black text-emerald-400">{formatCurrency(weekTotal.total)}</span>
          </div>
          <p className="text-[10px] text-slate-400 font-bold mt-1">
            {weekTotal.deliveries} deliveries · Bonus: {formatCurrency(weekTotal.bonus)}
          </p>
        </div>
      )}
    </div>
  );
}