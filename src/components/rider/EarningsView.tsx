'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';
import { getRiderEarningHistory } from '@/app/actions/riderActions';
import { getRiderWeekSettlementStatus } from '@/app/actions/settlementActions';
import { getCurrentWeekRange } from '@/lib/weekRange';
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
  const [settlement, setSettlement] = useState<{ settled_at: string; total_amount: number; notes: string | null } | null>(null);

  useEffect(() => {
    getRiderEarningHistory(riderId).then(async (result) => {
      setWeekly(result.weekly);
      setWeekTotal(result.weekTotal);
      setLoading(false);

      const { weekStart } = getCurrentWeekRange();
      const status = await getRiderWeekSettlementStatus(riderId, weekStart);
      if (status.success && status.data) {
        setSettlement(status.data);
      }
    });
  }, [riderId]);

  return (
    <div className="space-y-6">
      {/* Today Summary Card */}
      <div className="bg-[#252525] border border-[#363636] rounded-2xl p-5 border-l-4 border-l-[#3AB757]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-[#3AB757]/10 rounded-xl flex items-center justify-center">
            <TrendingUp size={20} className="text-[#3AB757]" />
          </div>
          <span className="text-xs font-medium text-[#9C9C9C] normal-case tracking-wide">Today&apos;s Earnings</span>
        </div>
        <p className="text-3xl font-bold text-white">{formatCurrency(todayEarnings)}</p>
        <p className="text-xs text-[#9C9C9C] font-medium mt-1">
          {todayDeliveries} deliveries · {todayDistanceKm} km · Bonus: {formatCurrency(todayBonus)}
        </p>
        <p className="text-xs text-[#9C9C9C] font-medium mt-1">
          Delivery: {formatCurrency(todayDeliveryFees)} + Pickup Pay: {formatCurrency(todayPickupPay)}
        </p>
      </div>

      {/* Weekly Chart */}
      {loading ? (
        <div className="bg-[#252525] border border-[#363636] rounded-2xl p-5 animate-pulse">
          <div className="h-4 w-24 bg-[#2C2C2C] rounded mb-4" />
          <div className="h-40 bg-[#2C2C2C]/50 rounded-xl" />
        </div>
      ) : (
        <WeeklyChart data={weekly.map(d => ({ date: d.date, deliveries: d.deliveries, total: d.total, bonus: d.bonus }))} />
      )}

      {/* Daily Breakdown Accordion */}
      {!loading && (
        <div className="bg-[#252525] border border-[#363636] rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#363636]">
            <h3 className="text-sm font-semibold text-[#9C9C9C] normal-case tracking-wide">
              Daily Breakdown
            </h3>
          </div>

          {weekly.filter(d => d.deliveries > 0).reverse().map((day) => (
            <div key={day.date} className="border-b border-[#363636]/30 last:border-0">
              <button
                onClick={() => setExpandedDay(expandedDay === day.date ? null : day.date)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[#2C2C2C]/30 transition-colors"
              >
                <span className="text-xs font-medium text-white">&#128197; {formatDate(day.date)}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-[#9C9C9C]">{day.deliveries} orders</span>
                  <span className="text-xs font-bold text-white">{formatCurrency(day.total)}</span>
                  <ChevronDown
                    size={14}
                    className={`text-[#9C9C9C] transition-transform duration-200 ${expandedDay === day.date ? 'rotate-180' : ''}`}
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
                    <div className="px-5 pb-4 space-y-1.5 bg-[#2C2C2C]/10">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-[#9C9C9C]">Delivery Pay</span>
                        <span className="text-white">{formatCurrency(day.deliveryFees)}</span>
                      </div>
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-[#9C9C9C]">Pickup Pay</span>
                        <span className="text-white">{formatCurrency(day.pickupPay)}</span>
                      </div>
                      {day.bonus > 0 && (
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-[#3AB757]">Nightly Bonus</span>
                          <span className="text-[#3AB757]">{formatCurrency(day.bonus)}</span>
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
              <p className="text-xs text-[#9C9C9C] font-medium">No deliveries this week yet</p>
            </div>
          )}
        </div>
      )}

      {/* Week Settled Badge */}
      {!loading && settlement && (
        (() => {
          const isPartial = settlement.total_amount < weekTotal.total - 0.01;
          if (isPartial) {
            return (
              <div className="bg-[#252525] border border-[#E2B93B] border-l-4 border-l-[#E2B93B] rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-[#E2B93B]/10 rounded-xl flex items-center justify-center">
                  <AlertCircle size={20} className="text-[#E2B93B]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">Partial Settlement Done</p>
                  <p className="text-xs text-[#9C9C9C] font-medium mt-0.5">
                    Paid {formatCurrency(settlement.total_amount)} of {formatCurrency(weekTotal.total)}. Remaining amount will be settled soon.
                  </p>
                  {settlement.notes && (
                    <p className="text-[10px] text-[#696969] font-medium mt-1 italic">&ldquo;{settlement.notes}&rdquo;</p>
                  )}
                </div>
              </div>
            );
          }
          return (
            <div className="bg-[#252525] border border-[#3AB757] border-l-4 border-l-[#3AB757] rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-[#3AB757]/10 rounded-xl flex items-center justify-center">
                <CheckCircle size={20} className="text-[#3AB757]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">This Week is Settled</p>
                <p className="text-xs text-[#9C9C9C] font-medium mt-0.5">
                  Paid {formatCurrency(settlement.total_amount)} on{' '}
                  {new Date(settlement.settled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </p>
                {settlement.notes && (
                  <p className="text-[10px] text-[#696969] font-medium mt-1 italic">&ldquo;{settlement.notes}&rdquo;</p>
                )}
              </div>
            </div>
          );
        })()
      )}

      {/* Week Total Footer */}
      {!loading && weekTotal.total > 0 && (
        <div className="bg-[#252525] border border-[#363636] rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#9C9C9C] normal-case tracking-wide">This Week</span>
            <span className="text-lg font-bold text-[#3AB757]">{formatCurrency(weekTotal.total)}</span>
          </div>
          <p className="text-xs text-[#9C9C9C] font-medium mt-1">
            {weekTotal.deliveries} deliveries · Bonus: {formatCurrency(weekTotal.bonus)}
          </p>
        </div>
      )}
    </div>
  );
}