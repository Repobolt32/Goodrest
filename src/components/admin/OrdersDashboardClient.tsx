'use client';

import { useEffect, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { updateOrderStatus, deleteOrder } from '@/app/actions/adminActions';
import { motion, AnimatePresence } from 'framer-motion';
import type { OrderItem, OrderRecord as Order, OrderRow } from '@/types/orders';
import { toOrderRecord } from '@/types/orders';
import {
  Trash2,
  CheckCircle2,
  Clock,
  Truck,
} from 'lucide-react';

export type { OrderItem, Order };

const getStatusColor = (status: string | null) => {
  const s = status || 'created';
  switch (s) {
    case 'created': return 'bg-blue-50 text-blue-600 border-blue-100';
    case 'preparing': return 'bg-yellow-50 text-yellow-600 border-yellow-100';
    case 'ready': return 'bg-amber-50 text-amber-600 border-amber-100';
    case 'out_for_delivery': return 'bg-orange-50 text-orange-600 border-orange-100';
    case 'delivered': return 'bg-green-50 text-green-600 border-green-100';
    default: return 'bg-gray-50 text-gray-600 border-gray-100';
  }
};

function OrderRow({
  order,
  updating,
  onUpdateStatus,
  onDelete
}: {
  order: Order,
  updating: boolean,
  onUpdateStatus: (id: string, status: string) => void,
  onDelete: (id: string) => void
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`glass-card p-6 group overflow-hidden relative ${
        updating ? 'opacity-70 grayscale-[0.5] pointer-events-none' : ''
      }`}
    >
      <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">

        {/* Basic Info */}
        <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center flex-1 min-w-0">
          <div className="flex items-center gap-4">
            <span className="text-primary/60 font-mono font-bold text-xs bg-primary/5 px-2 py-1 rounded-lg">
              {order.friendly_id || `#${order.id.slice(0, 8)}`}
            </span>
            <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusColor(order.order_status)}`}>
              {order.order_status?.replace(/_/g, ' ')}
            </div>
          </div>

          <div className="min-w-0">
            <p className="text-sm font-black text-slate-800 truncate">{order.customer_name}</p>
            <p className="text-[10px] font-bold text-slate-400 tracking-wide">{order.customer_phone}</p>
          </div>

          <div className="hidden xl:block max-w-xs">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest line-clamp-1">
                {order.delivery_address}
             </p>
          </div>
        </div>

        {/* Status specific actions */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
          <div className="flex gap-2 w-full sm:w-auto">
            {order.order_status === 'placed' && (
              <button
                onClick={() => onUpdateStatus(order.id, 'preparing')}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-yellow-50 text-yellow-600 rounded-xl border border-yellow-100 hover:bg-yellow-600 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all"
              >
                <Clock size={14} /> Start Cooking
              </button>
            )}
            {order.order_status === 'preparing' && (
              <button
                onClick={() => onUpdateStatus(order.id, 'ready')}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 hover:bg-emerald-600 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all"
              >
                <CheckCircle2 size={14} /> Mark Ready
              </button>
            )}
            {order.order_status === 'ready' && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 text-[10px] font-black uppercase tracking-widest">
                <Truck size={14} /> Waiting for rider assignment...
              </div>
            )}
            {order.order_status === 'out_for_delivery' && (
              <>
                <div className="flex items-center gap-2 px-4 py-2.5 bg-orange-50 text-orange-600 rounded-xl border border-orange-100 text-[10px] font-black uppercase tracking-widest">
                  Rider assigned
                </div>
                <button
                  onClick={() => onUpdateStatus(order.id, 'delivered')}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 hover:bg-emerald-600 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  <CheckCircle2 size={14} /> Delivered
                </button>
              </>
            )}
          </div>

          <button
            onClick={() => onDelete(order.id)}
            className="p-2.5 text-slate-300 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50"
          >
            <Trash2 size={16} />
          </button>
        </div>

      </div>

      {/* Visual Decorator */}
      <div className="absolute top-0 right-0 w-24 h-full bg-gradient-to-l from-primary/[0.02] to-transparent pointer-events-none" />
    </motion.div>
  );
}

export default function OrdersDashboardClient({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  useEffect(() => {
    const playNotificationSound = () => {
      try {
        const AudioContextClass = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext) as typeof AudioContext;
        const audioCtx = new AudioContextClass();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(880.00, audioCtx.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3);
      } catch (e) {
        console.warn('Audio feedback failed (browser policy?):', e);
      }
    };

    const fetchFullOrder = async (orderId: string, maxRetries = 5): Promise<Order | null> => {
      for (let i = 0; i < maxRetries; i++) {
        const { data } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();

        if (data) {
          if (!data.friendly_id && i < maxRetries - 1) {
            const delay = Math.pow(2, i) * 500;
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          return toOrderRecord(data);
        }

        if (i < maxRetries - 1) {
          const delay = Math.pow(2, i) * 500;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      return null;
    };

    const channel = supabase
      .channel(`realtime_orders_${Math.random().toString(36).slice(2, 7)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        async (payload: RealtimePostgresChangesPayload<OrderRow>) => {
          if (payload.eventType === 'INSERT') {
            const fullOrder = await fetchFullOrder(payload.new.id);
            if (fullOrder) {
              setOrders((prev) => {
                if (prev.some(o => o.id === fullOrder.id)) return prev;
                return [fullOrder, ...prev];
              });
              const s = fullOrder.order_status || 'created';
              if (s === 'placed' || s === 'preparing' || s === 'ready') {
                playNotificationSound();
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            const fullOrder = await fetchFullOrder(payload.new.id);
            if (fullOrder) {
              setOrders((prev) => {
                const exists = prev.some(o => o.id === fullOrder.id);
                if (exists) {
                   return prev.map((o) => (o.id === fullOrder.id ? fullOrder : o));
                }
                const s = fullOrder.order_status || 'created';
                if (s === 'placed' || s === 'preparing' || s === 'ready') {
                  playNotificationSound();
                  return [fullOrder, ...prev];
                }
                return prev;
              });
            }
          } else if (payload.eventType === 'DELETE') {
            setOrders((prev) => prev.filter((o) => o.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleStatusUpdate = async (id: string, status: string) => {
    setUpdating(id);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, order_status: status } : o));
    const result = await updateOrderStatus(id, status);
    if (!result.success) alert('Failed to update: ' + result.error);
    setUpdating(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this order?')) return;
    setUpdating(id);
    await deleteOrder(id);
    setUpdating(null);
  };

  const activeOrders = orders.filter(o => o.order_status === 'placed' || o.order_status === 'preparing' || o.order_status === 'ready');
  const dispatchedOrders = orders.filter(o => o.order_status === 'out_for_delivery');

  return (
    <div className="space-y-12 pb-32 relative">
      <section>
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3 font-mono">
          <Clock size={16} className="text-primary animate-pulse" /> Active Kitchen Feed
        </h3>
        <div className="flex flex-col gap-4">
          <AnimatePresence mode="popLayout">
            {activeOrders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                updating={updating === order.id}
                onUpdateStatus={handleStatusUpdate}
                onDelete={handleDelete}
              />
            ))}
          </AnimatePresence>
        </div>
        {activeOrders.length === 0 && (
          <div className="text-center py-20 bg-slate-50/50 rounded-[2.5rem] border border-dashed border-slate-200">
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No orders in kitchen</p>
          </div>
        )}
      </section>

      {dispatchedOrders.length > 0 && (
        <section>
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
            <Truck size={16} /> Dispatched Today
          </h3>
          <div className="flex flex-col gap-4 opacity-70 hover:opacity-100 transition-opacity">
            <AnimatePresence mode="popLayout">
              {dispatchedOrders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  updating={updating === order.id}
                  onUpdateStatus={handleStatusUpdate}
                  onDelete={handleDelete}
                />
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}
    </div>
  );
}
