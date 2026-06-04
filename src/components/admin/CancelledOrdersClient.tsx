'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, 
  Clock, 
  Phone, 
  MapPin, 
  MessageSquare, 
  Undo, 
  CheckCircle2, 
  User,
  ShoppingBag
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toOrderRecord } from '@/types/orders';
import type { OrderRecord, OrderRow } from '@/types/orders';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { updateRefundStatus } from '@/app/actions/orderActions';

interface CancelledOrdersClientProps {
  initialOrders: OrderRecord[];
}

export default function CancelledOrdersClient({ initialOrders }: CancelledOrdersClientProps) {
  const [orders, setOrders] = useState<OrderRecord[]>(initialOrders);
  const [activeTab, setActiveTab] = useState<'pending' | 'refunded'>('pending');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Sync initialOrders prop if changed
  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  // Realtime subscription
  useEffect(() => {
    const uniqueId = Math.random().toString(36).substring(2, 10);
    const channel = supabase
      .channel(`cancelled_orders_realtime_${uniqueId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload: RealtimePostgresChangesPayload<OrderRow>) => {
          if (payload.eventType === 'INSERT') {
            const newOrder = toOrderRecord(payload.new as OrderRow);
            if (newOrder.order_status === 'cancelled') {
              setOrders((prev) => {
                if (prev.some((o) => o.id === newOrder.id)) return prev;
                return [newOrder, ...prev];
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = toOrderRecord(payload.new as OrderRow);
            if (updated.order_status === 'cancelled') {
              setOrders((prev) => {
                const exists = prev.some((o) => o.id === updated.id);
                if (exists) {
                  return prev.map((o) => (o.id === updated.id ? updated : o));
                }
                return [updated, ...prev];
              });
            } else {
              // If status changed away from cancelled, remove it from this list
              setOrders((prev) => prev.filter((o) => o.id !== updated.id));
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

  // Filter orders based on refund_status column (defaulting null or undefined to 'pending' if order is cancelled)
  const pendingOrders = orders.filter(
    (o) => !o.refund_status || o.refund_status === 'pending'
  );
  const refundedOrders = orders.filter(
    (o) => o.refund_status === 'refunded'
  );

  const activeOrdersList = activeTab === 'pending' ? pendingOrders : refundedOrders;

  const handleToggleRefund = async (orderId: string, currentStatus: string | null) => {
    setUpdatingId(orderId);
    const nextStatus: 'pending' | 'refunded' = 
      !currentStatus || currentStatus === 'pending' ? 'refunded' : 'pending';

    const result = await updateRefundStatus(orderId, nextStatus);
    
    if (result.success && result.data) {
      setOrders((prev) => 
        prev.map((o) => 
          o.id === orderId ? { ...o, refund_status: result.data!.refund_status } : o
        )
      );
    } else {
      alert('Failed to update refund status: ' + (result.error || 'Unknown error'));
    }
    setUpdatingId(null);
  };

  const getCancelledByLabel = (cancelledBy: string | null) => {
    if (cancelledBy === 'customer') return 'Customer Cancelled';
    if (cancelledBy === 'owner') return 'Restaurant Rejected';
    if (cancelledBy === 'auto') return 'Auto-Cancelled (Timeout)';
    return 'Cancelled';
  };

  const getCancelledByBadgeColor = (cancelledBy: string | null) => {
    if (cancelledBy === 'customer') return 'bg-rose-50 text-rose-600 border-rose-100';
    if (cancelledBy === 'owner') return 'bg-amber-50 text-amber-600 border-amber-100';
    return 'bg-slate-50 text-slate-500 border-slate-100';
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Title Header */}
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
          <AlertTriangle className="text-primary" size={32} /> Cancelled Orders
        </h1>
        <p className="text-slate-500 font-medium tracking-wide">
          Track and process refunds for customer-cancelled and auto-rejected orders
        </p>
      </div>

      {/* Tabs Filter Bar */}
      <div className="flex gap-4 border-b border-slate-200 pb-px">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 pb-4 font-black text-xs uppercase tracking-widest border-b-2 transition-all relative ${
            activeTab === 'pending'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Pending Refunds
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
            activeTab === 'pending' ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'
          }`}>
            {pendingOrders.length}
          </span>
          {activeTab === 'pending' && (
            <motion.div 
              layoutId="activeTabUnderline" 
              className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" 
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab('refunded')}
          className={`flex items-center gap-2 pb-4 font-black text-xs uppercase tracking-widest border-b-2 transition-all relative ${
            activeTab === 'refunded'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Completed Refunds
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
            activeTab === 'refunded' ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'
          }`}>
            {refundedOrders.length}
          </span>
          {activeTab === 'refunded' && (
            <motion.div 
              layoutId="activeTabUnderline" 
              className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" 
            />
          )}
        </button>
      </div>

      {/* Empty State */}
      <AnimatePresence mode="wait">
        {activeOrdersList.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200 flex flex-col items-center gap-3"
          >
            <CheckCircle2 size={48} className="text-slate-300" strokeWidth={1.5} />
            <div className="space-y-1">
              <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs">
                No orders in this queue
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                {activeTab === 'pending' 
                  ? 'All cancelled orders have been refunded!' 
                  : 'No completed refunds to display.'}
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            layout 
            className="grid grid-cols-1 xl:grid-cols-2 gap-6"
          >
            {activeOrdersList.map((order) => {
              const formattedDate = order.created_at
                ? new Date(order.created_at).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  })
                : '';

              const isOnlinePay = order.payment_method === 'online';
              const isPaid = order.payment_status === 'paid';

              return (
                <motion.div
                  key={order.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className={`bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all hover:shadow-md ${
                    updatingId === order.id ? 'opacity-70 pointer-events-none' : ''
                  }`}
                  data-testid="cancelled-order-card"
                  data-order-id={order.id}
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span 
                            data-testid="order-friendly-id"
                            className="text-primary font-mono font-black text-xs bg-primary/5 px-2.5 py-1 rounded-xl border border-primary/10"
                          >
                            {order.friendly_id || `#${order.id.slice(0, 8)}`}
                          </span>
                          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${getCancelledByBadgeColor(order.cancelled_by)}`}>
                            {getCancelledByLabel(order.cancelled_by)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
                          <Clock size={11} /> {formattedDate}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-black text-slate-900">₹{order.total_amount}</span>
                        <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                          Total Amount
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-slate-100" />

                    {/* Customer Info */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                        <div className="flex items-center gap-2 font-bold text-slate-800">
                          <User size={14} className="text-slate-400" />
                          {order.customer_name}
                        </div>
                        <a
                          href={`tel:${order.customer_phone}`}
                          className="inline-flex items-center gap-1 text-[10px] font-black text-primary uppercase tracking-widest hover:underline px-2.5 py-1 bg-primary/5 rounded-xl border border-primary/10 transition-colors"
                        >
                          <Phone size={11} /> {order.customer_phone}
                        </a>
                      </div>

                      <div className="flex items-start gap-2 text-xs text-slate-500 leading-normal">
                        <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                        <span className="font-semibold">{order.delivery_address}</span>
                      </div>
                    </div>

                    <div className="h-px bg-slate-100" />

                    {/* Items Breakdown */}
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-2">
                        <ShoppingBag size={11} /> Order Items ({order.items.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                        {order.items.map((item, index) => (
                          <div
                            key={index}
                            className="inline-flex items-center gap-1.5 text-[10px] bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-xl text-slate-700 font-bold"
                          >
                            <span className="text-primary font-black">{item.quantity}x</span>
                            <span>{item.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="h-px bg-slate-100" />

                    {/* Payment & Cancel Info */}
                    <div className="grid grid-cols-2 gap-4 text-[11px] font-mono">
                      <div>
                        <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                          Payment Status
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                            isOnlinePay && isPaid ? 'bg-green-500' : 'bg-amber-500'
                          }`} />
                          <span className="font-bold text-slate-800 uppercase">
                            {order.payment_method} · {order.payment_status}
                          </span>
                        </div>
                      </div>
                      <div>
                        <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                          Refund Action Required?
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isOnlinePay && isPaid ? (
                            <span className="font-black text-rose-500 uppercase tracking-tight">
                              ⚠️ YES (Online Refund)
                            </span>
                          ) : (
                            <span className="font-bold text-slate-500 uppercase tracking-tight">
                              No (COD or Unpaid)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Cancel Reason & Help Message */}
                    {(order.cancel_reason || order.customer_help_message) && (
                      <div className="space-y-2.5 bg-slate-50/70 border border-slate-100 p-3.5 rounded-2xl">
                        {order.cancel_reason && (
                          <div className="text-[11px] leading-relaxed">
                            <span className="font-black text-slate-500 uppercase tracking-wider mr-1.5">
                              Reason:
                            </span>
                            <span className="text-slate-700 font-medium font-sans">
                              &ldquo;{order.cancel_reason}&rdquo;
                            </span>
                          </div>
                        )}
                        {order.customer_help_message && (
                          <div className="border-t border-slate-100/80 pt-2 flex flex-col gap-1 text-[11px] leading-relaxed">
                            <span className="font-black text-primary uppercase tracking-widest flex items-center gap-1 text-[9px]">
                              <MessageSquare size={10} /> Help Request:
                            </span>
                            <p className="text-slate-600 font-sans leading-relaxed font-semibold break-words">
                              &ldquo;{order.customer_help_message}&rdquo;
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer Action */}
                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                        Refund Status
                      </span>
                      <span 
                        data-testid="refund-status-label"
                        className={`text-[10px] font-black uppercase tracking-wider ${
                          order.refund_status === 'refunded' ? 'text-green-600' : 'text-amber-500'
                        }`}
                      >
                        {order.refund_status === 'refunded' ? '✓ Refunded' : '⏳ Pending'}
                      </span>
                    </div>

                    <div>
                      {order.refund_status === 'refunded' ? (
                        <button
                          data-testid="toggle-refund-btn"
                          onClick={() => handleToggleRefund(order.id, order.refund_status)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 transition-all cursor-pointer"
                        >
                          <Undo size={12} /> Undo
                        </button>
                      ) : (
                        <button
                          data-testid="toggle-refund-btn"
                          onClick={() => handleToggleRefund(order.id, order.refund_status)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-sm shadow-green-500/10"
                        >
                          <CheckCircle2 size={12} /> Mark Refunded
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
