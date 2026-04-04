'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { updateOrderStatus, updatePaymentStatus, deleteOrder } from '@/app/actions/adminActions';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package, 
  MapPin, 
  Phone, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Truck, 
  CreditCard, 
  Banknote,
  AlertCircle
} from 'lucide-react';

type Order = any; // We'll refine this with real DB types in practice

export default function OrdersDashboardClient({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    // 1. Subscribe to real-time changes
    const channel = supabase
      .channel('realtime_orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setOrders((prev) => [payload.new, ...prev]);
            // Play notification sound if possible? (Simulated for UX)
          } else if (payload.eventType === 'UPDATE') {
            setOrders((prev) => prev.map((o) => (o.id === payload.new.id ? payload.new : o)));
          } else if (payload.eventType === 'DELETE') {
            setOrders((prev) => prev.filter((o) => o.id === payload.old.id));
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
    const result = await updateOrderStatus(id, status);
    if (!result.success) {
      alert('Failed to update status: ' + result.error);
    }
    setUpdating(null);
  };

  const handlePaymentUpdate = async (id: string, status: string) => {
    setUpdating(id);
    const result = await updatePaymentStatus(id, status);
    if (!result.success) {
      alert('Failed to update payment: ' + result.error);
    }
    setUpdating(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this order?')) return;
    setUpdating(id);
    await deleteOrder(id);
    setUpdating(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'created': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'preparing': return 'bg-yellow-50 text-yellow-600 border-yellow-100';
      case 'ready': return 'bg-purple-50 text-purple-600 border-purple-100';
      case 'delivered': return 'bg-green-50 text-green-600 border-green-100';
      default: return 'bg-gray-50 text-gray-600 border-gray-100';
    }
  };

  if (orders.length === 0) {
    return (
      <div className="text-center py-32 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm">
        <Package className="mx-auto text-slate-200 mb-6" size={64} strokeWidth={1} />
        <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest">No Active Orders</h3>
        <p className="text-slate-400 mt-2 font-medium">New orders will appear here automatically.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-32">
      <AnimatePresence mode="popLayout">
        {orders.map((order) => (
          <motion.div
            layout
            key={order.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group overflow-hidden relative ${
              updating === order.id ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            {/* Status Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border ${getStatusColor(order.order_status)}`}>
                  {order.order_status}
                </div>
                <span className="text-slate-400 font-bold text-xs">#{order.id.slice(0, 8)}</span>
              </div>
              <button 
                onClick={() => handleDelete(order.id)}
                className="text-slate-300 hover:text-red-500 transition-colors p-2 rounded-xl hover:bg-red-50"
              >
                <Trash2 size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Items List */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Order Items</h4>
                <div className="space-y-3">
                  {(order.items as any[]).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between group/item p-4 bg-slate-50/50 rounded-2xl border border-slate-100 shadow-sm transition-all hover:bg-white hover:border-primary/20">
                      <div className="flex items-center gap-4">
                        <div className="bg-primary text-white w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shadow-md shadow-primary/20">
                          {item.quantity}
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-800">{item.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{item.category}</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-slate-400">₹{item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-4 border-t border-dashed border-slate-100 flex justify-between items-center">
                  <span className="text-sm font-black text-slate-800 uppercase tracking-widest">Total Value</span>
                  <span className="text-2xl font-black text-primary">₹{order.total_amount}</span>
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
                    <div>
                      <p className="text-sm font-black text-slate-800">{order.customer_name}</p>
                      <p className="text-sm font-bold text-slate-400 tracking-wide">{order.customer_phone}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 shadow-sm flex-shrink-0">
                      <MapPin size={18} className="text-slate-400" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 leading-relaxed uppercase tracking-widest">{order.delivery_address}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pt-4">
                    {order.payment_method === 'online' ? (
                      <div className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600">
                        <CreditCard size={18} />
                        <span className="text-xs font-black uppercase tracking-widest">Online</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${order.payment_status === 'paid' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                          {order.payment_status}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600">
                        <Banknote size={18} />
                        <span className="text-xs font-black uppercase tracking-widest">Cash on Delivery</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Management Actions */}
                <div className="pt-6 border-t border-slate-100">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Set Status</h4>
                  <div className="flex flex-wrap gap-2">
                    <button 
                      onClick={() => handleStatusUpdate(order.id, 'preparing')}
                      className={`flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl transition-all border border-slate-100 hover:border-yellow-200 hover:bg-yellow-50 hover:text-yellow-600 text-xs font-bold ${order.order_status === 'preparing' ? 'bg-yellow-50 border-yellow-200 text-yellow-600 ring-2 ring-yellow-200 ring-offset-2' : ''}`}
                    >
                      <Clock size={16} /> Preparing
                    </button>
                    <button 
                      onClick={() => handleStatusUpdate(order.id, 'ready')}
                      className={`flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl transition-all border border-slate-100 hover:border-purple-200 hover:bg-purple-50 hover:text-purple-600 text-xs font-bold ${order.order_status === 'ready' ? 'bg-purple-50 border-purple-200 text-purple-600 ring-2 ring-purple-200 ring-offset-2' : ''}`}
                    >
                      <CheckCircle2 size={16} /> Ready
                    </button>
                    <button 
                      onClick={() => handleStatusUpdate(order.id, 'delivered')}
                      className={`flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl transition-all border border-slate-100 hover:border-green-200 hover:bg-green-50 hover:text-green-600 text-xs font-bold ${order.order_status === 'delivered' ? 'bg-green-50 border-green-200 text-green-600 ring-2 ring-green-200 ring-offset-2' : ''}`}
                    >
                      <Truck size={16} /> Delivered
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Flair: Shadow Gradient */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[60px] pointer-events-none group-hover:bg-primary/10 transition-colors" />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
