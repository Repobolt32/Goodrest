'use client';

import { useEffect, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { updateOrderStatus, deleteOrder } from '@/app/actions/adminActions';
import { motion, AnimatePresence } from 'framer-motion';
import type { OrderItem, OrderRecord as Order, OrderRow } from '@/types/orders';
import { toOrderRecord } from '@/types/orders';
import { 
  MapPin, 
  Phone, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Truck, 
  CreditCard
} from 'lucide-react';

export type { OrderItem, Order };

// Status color helper moved outside
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

/**
 * Extracted OrderCard Component
 * Prevents unnecessary re-renders when the parent (Dashboard) updates state.
 */
function OrderCard({ 
  order, 
  isDispatched, 
  updating, 
  onUpdateStatus, 
  onDelete 
}: { 
  order: Order, 
  isDispatched: boolean,
  updating: boolean,
  onUpdateStatus: (id: string, status: string) => void,
  onDelete: (id: string) => void
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      // Increased pb-10 to prevent button clipping on mobile
      className={`glass-card p-5 md:p-8 pb-10 group overflow-hidden relative ${
        updating ? 'opacity-70 grayscale-[0.5] pointer-events-none' : ''
      }`}
    >
      {/* Glow Decorator */}
      {!isDispatched && <div className="status-glow bg-primary/40 -top-1 -right-1" />}
      
      {/* Status Header */}
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div className="flex items-center gap-3">
          <div className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(order.order_status)}`}>
            {order.order_status?.replace(/_/g, ' ')}
          </div>
          <span className="text-primary/60 font-mono font-bold text-[10px] md:text-xs bg-primary/5 px-2 py-1 rounded-lg">
            {order.friendly_id || `#${order.id.slice(0, 8)}`}
          </span>
        </div>
        <button 
          onClick={() => onDelete(order.id)}
          aria-label={`Delete order ${order.friendly_id}`}
          className="text-slate-300 hover:text-red-500 transition-colors p-2 rounded-xl hover:bg-red-50 focus:outline-none"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        {/* Items List */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Order Items</h4>
          <div className="space-y-2 md:space-y-3">
            {order.items.map((item, idx) => (
              <div key={`${order.id}-item-${idx}`} className="flex items-center justify-between group/item p-3 md:p-4 bg-slate-50/50 rounded-2xl border border-slate-100 shadow-sm transition-all hover:bg-white hover:border-primary/20">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="bg-primary text-white w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shadow-md shadow-primary/20">
                    {item.quantity}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-800 truncate">{item.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{item.category || 'Food'}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-400 whitespace-nowrap">Rs {(item.price || 0) * item.quantity}</span>
              </div>
            ))}
          </div>
          <div className="pt-4 border-t border-dashed border-slate-200/50 flex justify-between items-center">
            <span className="text-sm font-black text-slate-800 uppercase tracking-widest font-mono text-[10px] md:text-sm">Total</span>
            <span className="text-xl md:text-2xl font-black text-primary drop-shadow-sm font-mono">Rs {order.total_amount}</span>
          </div>
        </div>

        {/* Customer & Delivery */}
        <div className="space-y-6">
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Customer Details</h4>
            
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 shadow-sm flex-shrink-0">
                <Phone size={18} className="text-slate-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-800 truncate">{order.customer_name}</p>
                <p className="text-sm font-bold text-slate-400 tracking-wide">{order.customer_phone}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 shadow-sm flex-shrink-0">
                <MapPin size={18} className="text-slate-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] md:text-xs font-bold text-slate-500 leading-relaxed uppercase tracking-widest line-clamp-2 md:line-clamp-none">
                  {order.delivery_address}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-4">
              <div className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600 overflow-hidden">
                <CreditCard size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest truncate">Online</span>
                <span className={`text-[9px] md:text-[10px] px-2 py-0.5 rounded-full font-black ${order.payment_status === 'paid' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  {order.payment_status}
                </span>
              </div>
            </div>
          </div>

          {/* Management Actions */}
          <div className="pt-6 border-t border-slate-100">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Set Status</h4>
            <div className="flex flex-wrap gap-2">
              {!isDispatched ? (
                <>
                  {order.order_status === 'placed' && (
                    <button 
                      onClick={() => onUpdateStatus(order.id, 'preparing')}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-yellow-50 text-yellow-600 rounded-xl transition-all border border-yellow-100 hover:bg-yellow-600 hover:text-white text-[10px] font-black uppercase tracking-widest shadow-sm shadow-yellow-100 focus:outline-none"
                    >
                      <Clock size={16} /> <span className="hidden xs:inline">Start Cooking</span><span className="xs:hidden">Cook</span>
                    </button>
                  )}
                  {order.order_status === 'preparing' && (
                    <button 
                      onClick={() => onUpdateStatus(order.id, 'ready')}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-emerald-50 text-emerald-600 rounded-xl transition-all border border-emerald-100 hover:bg-emerald-600 hover:text-white text-[10px] font-black uppercase tracking-widest shadow-sm shadow-emerald-100 focus:outline-none"
                    >
                      <CheckCircle2 size={16} /> <span className="hidden xs:inline">Order Ready</span><span className="xs:hidden">Ready</span>
                    </button>
                  )}
                  {order.order_status === 'ready' && (
                    <button 
                      onClick={() => onUpdateStatus(order.id, 'out_for_delivery')}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl transition-all border border-primary/20 hover:scale-105 active:scale-95 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/40 focus:outline-none"
                    >
                      <Truck size={16} /> <span className="hidden xs:inline">Dispatch Order</span><span className="xs:hidden">Dispatch</span>
                    </button>
                  )}
                </>
              ) : (
                order.order_status === 'out_for_delivery' && (
                  <button 
                    onClick={() => onUpdateStatus(order.id, 'delivered')}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-emerald-50 rounded-xl transition-all border border-emerald-100 hover:bg-emerald-600 hover:text-white text-[10px] font-black uppercase tracking-widest text-emerald-600 shadow-sm shadow-emerald-100 focus:outline-none"
                  >
                    <CheckCircle2 size={16} /> <span className="hidden xs:inline">Mark Delivered</span><span className="xs:hidden">Deliver</span>
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Visual Flair: Shadow Gradient */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[60px] pointer-events-none group-hover:bg-primary/10 transition-colors" />
    </motion.div>
  );
}

export default function OrdersDashboardClient({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [updating, setUpdating] = useState<string | null>(null);

  // Sync initialOrders from server (fixes search results not showing up immediately)
  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  useEffect(() => {
    // Helper function to play a subtle "New Order" chime using Web Audio API
      const playNotificationSound = () => {
      try {
        const AudioContextClass = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext) as typeof AudioContext;
        const audioCtx = new AudioContextClass();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        oscillator.frequency.exponentialRampToValueAtTime(880.00, audioCtx.currentTime + 0.1); // A5

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

    // Helper to fetch full order with exponential backoff
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

    // Subscribe to real-time changes
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
  const dispatchedOrders = orders.filter(o => o.order_status === 'out_for_delivery' || o.order_status === 'delivered');

  return (
    <div className="space-y-12 pb-32">
      <section>
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3 font-mono">
          <Clock size={16} className="text-primary animate-pulse" /> Active Kitchen Feed
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <AnimatePresence mode="popLayout">
            {activeOrders.map((order) => (
              <OrderCard 
                key={order.id} 
                order={order} 
                isDispatched={false} 
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 opacity-60 hover:opacity-100 transition-opacity">
            <AnimatePresence mode="popLayout">
              {dispatchedOrders.map((order) => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  isDispatched={true} 
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
