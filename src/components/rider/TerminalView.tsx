'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  Power, TrendingUp, ShoppingBag, Route, Navigation, CheckCircle, AlertCircle, Sparkles,
} from 'lucide-react';
import OrderBroadcast from './OrderBroadcast';
import BonusProgress from './BonusProgress';
import { calculateEarningBreakdown } from '@/lib/pricing';

const RESTO_LAT = process.env.NEXT_PUBLIC_RESTO_LAT || '24.797471691999753';
const RESTO_LNG = process.env.NEXT_PUBLIC_RESTO_LNG || '85.0100327655486';


interface RiderStats {
  todayEarnings: number;
  todayDeliveries: number;
  todayDistanceKm: number;
  todayNightlyBonus: number;
  todayDeliveryFees: number;
  todayPickupPay: number;
  nextBonusMilestone: number | null;
  deliveriesUntilBonus: number;
  bonusProgress: number;
  bonusLabel: string;
}

interface ActiveOrder {
  id: string;
  friendly_id: string | null;
  order_status: string | null;
  customer_name: string;
  delivery_address: string;
  distance_km: number | null;
  rider_earning: number | null;
  lat: number | null;
  lng: number | null;
  manual_dispatch: boolean | null;
}


interface TerminalViewProps {
  riderId: string;
  isOnline: boolean;
  geoError: string | null;
  stats: RiderStats | null;
  activeOrder: ActiveOrder | null;
  actionLoading: boolean;
  onToggleOnline: () => void;
  onStartRiding: () => void;
  onDelivered: () => void;
  onAcceptBroadcast: () => void;
}

export default function TerminalView({
  riderId, isOnline, geoError, stats, activeOrder, actionLoading,
  onToggleOnline, onStartRiding, onDelivered, onAcceptBroadcast,
}: TerminalViewProps) {
  const todayEarnings = stats?.todayEarnings ?? 0;
  const todayOrders = stats?.todayDeliveries ?? 0;
  const todayDistance = stats?.todayDistanceKm ?? 0;
  const todayBonus = stats?.todayNightlyBonus ?? 0;

  // Earning breakdown for active order
  const orderBreakdown = activeOrder?.distance_km != null
    ? calculateEarningBreakdown(activeOrder.distance_km)
    : null;

  return (
    <>
      {/* Geolocation Error */}
      {geoError && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
          <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-400">{geoError}</p>
            <p className="text-xs text-red-400/60 mt-1">Enable GPS/location permissions to go online.</p>
          </div>
        </div>
      )}

      {/* Online Toggle */}
      <button
        onClick={onToggleOnline}
        className={`w-full py-4 rounded-2xl flex items-center justify-center gap-4 transition-all active:scale-95 shadow-xl mb-8 ${
          isOnline
            ? 'bg-red-500 text-white shadow-red-500/20'
            : 'bg-white text-slate-950 shadow-white/10'
        }`}
      >
        <Power size={22} className={isOnline ? 'animate-pulse' : ''} />
        <span className="text-sm font-black uppercase tracking-[0.2em]">
          {isOnline ? 'Go Offline' : 'Go Online'}
        </span>
      </button>

      {/* Stats Grid — 4 cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="glass-card p-4 border-slate-800/50">
          <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center mb-3">
            <TrendingUp size={16} className="text-emerald-500" />
          </div>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Earnings</p>
          <p className="text-xl font-black mt-0.5">₹{todayEarnings}</p>
        </div>
        <div className="glass-card p-4 border-slate-800/50">
          <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center mb-3">
            <ShoppingBag size={16} className="text-blue-500" />
          </div>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Orders</p>
          <p className="text-xl font-black mt-0.5">{todayOrders}</p>
        </div>
        <div className="glass-card p-4 border-slate-800/50">
          <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center mb-3">
            <Route size={16} className="text-amber-500" />
          </div>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Distance</p>
          <p className="text-xl font-black mt-0.5">{todayDistance} km</p>
        </div>
        <div className="glass-card p-4 border-slate-800/50">
          <div className="w-8 h-8 bg-yellow-500/10 rounded-lg flex items-center justify-center mb-3">
            <Sparkles size={16} className="text-yellow-400" />
          </div>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Bonus</p>
          <p className="text-xl font-black mt-0.5">₹{todayBonus}</p>
        </div>
      </div>

      {/* Bonus Progress */}
      <BonusProgress
        todayDeliveries={todayOrders}
        currentBonus={stats?.todayNightlyBonus ?? 0}
        nextMilestone={stats?.nextBonusMilestone ?? 6}
        deliveriesUntilNext={stats?.deliveriesUntilBonus ?? 6}
        progress={stats?.bonusProgress ?? 0}
        label={stats?.bonusLabel ?? '₹100 bonus in 6 more deliveries'}
      />

      {/* Active Order Card */}
      <AnimatePresence>
        {activeOrder && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="glass-card p-6 mb-8 border-emerald-500/20 bg-emerald-500/5"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                <ShoppingBag size={24} />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-widest text-white">Active Delivery</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                  Order #{activeOrder.friendly_id || activeOrder.id?.slice(0, 8)}
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-500 uppercase tracking-widest">Customer</span>
                <span className="text-white">{activeOrder.customer_name || 'Premium Guest'}</span>
              </div>
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-500 uppercase tracking-widest">Address</span>
                <span className="text-white text-right max-w-[200px]">{activeOrder.delivery_address || 'Loading...'}</span>
              </div>
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-500 uppercase tracking-widest">Distance</span>
                <span className="text-white">{activeOrder.distance_km ?? '?'} km</span>
              </div>
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-500 uppercase tracking-widest">You earn</span>
                <span className="text-emerald-400 font-black">₹{activeOrder.rider_earning ?? 0}</span>
              </div>
              {/* Earning breakdown */}
              {orderBreakdown && (
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-slate-600 uppercase tracking-widest">Breakdown</span>
                  <span className="text-slate-400">
                    Delivery ₹{orderBreakdown.deliveryFee} + Pickup ₹{orderBreakdown.pickupPay}
                  </span>
                </div>
              )}
            </div>

            {/* Status-based actions */}
            {(activeOrder.order_status === 'preparing' || activeOrder.order_status === 'ready') && (
              activeOrder.manual_dispatch ? (
                <button
                  onClick={onStartRiding}
                  disabled={actionLoading}
                  className="w-full py-4 bg-emerald-500 text-white rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all disabled:opacity-50"
                >
                  {actionLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <><Navigation size={16} /> Start Riding</>
                  )}
                </button>
              ) : (
                <div className="w-full py-4 bg-slate-900/50 text-slate-500 border border-slate-800/80 rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 cursor-not-allowed">
                  ⏳ Waiting for Restaurant Handover...
                </div>
              )
            )}


            {activeOrder.order_status === 'out_for_delivery' && (
              <div className="flex gap-3">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&origin=${RESTO_LAT},${RESTO_LNG}&destination=${activeOrder.lat},${activeOrder.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-4 bg-slate-900 text-white border border-slate-800 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
                >
                  <Navigation size={16} /> Navigate
                </a>
                <button
                  onClick={onDelivered}
                  disabled={actionLoading}
                  className="flex-1 py-4 bg-emerald-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all disabled:opacity-50"
                >
                  {actionLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <><CheckCircle size={16} /> Delivered</>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Order Broadcast */}
      <OrderBroadcast
        riderId={riderId}
        hasActiveOrder={!!activeOrder}
        onAccept={onAcceptBroadcast}
      />
    </>
  );
}