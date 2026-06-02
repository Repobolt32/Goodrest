'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, Truck, MapPin } from 'lucide-react';
import type { OrderRecord } from '@/types/orders';
import PrepTimer from './PrepTimer';
import RiderPanel from './RiderPanel';

interface OrderCardProps {
  order: OrderRecord;
  updating: boolean;
  onAccept: (id: string) => void;
  onFoodReady: (id: string) => void;
  onDispatch: (id: string) => void;
}

const statusBadge = (status: string | null) => {
  const colors: Record<string, string> = {
    confirmed: 'bg-red-50 text-red-600 border-red-200',
    preparing: 'bg-yellow-50 text-yellow-600 border-yellow-100',
    ready: 'bg-amber-50 text-amber-600 border-amber-100',
    out_for_delivery: 'bg-orange-50 text-orange-600 border-orange-100',
    delivered: 'bg-green-50 text-green-600 border-green-100',
    cancelled: 'bg-gray-50 text-gray-500 border-gray-200',
  };
  return `px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${colors[status || 'confirmed'] || colors.confirmed}`;
};

export default function OrderCard({ order, updating, onAccept, onFoodReady, onDispatch }: OrderCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`glass-card p-6 ${updating ? 'opacity-70 pointer-events-none' : ''}`}
    >
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="text-primary/60 font-mono font-bold text-xs bg-primary/5 px-2 py-1 rounded-lg">
              {order.friendly_id || `#${order.id.slice(0, 8)}`}
            </span>
            <span className={statusBadge(order.order_status)}>
              {order.order_status?.replace(/_/g, ' ')}
            </span>
            {order.prep_deadline && order.order_status === 'preparing' && (
              <PrepTimer prepDeadline={order.prep_deadline} />
            )}
          </div>
          <p className="text-sm font-black text-slate-800">{order.customer_name}</p>
          <p className="text-[10px] font-bold text-slate-400">{order.customer_phone}</p>
        </div>

        {/* Items */}
        <div className="flex flex-wrap gap-1">
          {order.items.map((item, i) => (
            <span key={i} className="text-[9px] bg-slate-50 px-2 py-0.5 rounded-md text-slate-600 font-bold">
              {item.quantity}x {item.name}
            </span>
          ))}
        </div>

        {/* Delivery */}
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <MapPin size={12} />
          <span className="line-clamp-1">{order.delivery_address}</span>
          {order.total_amount && (
            <span className="font-black text-slate-800 ml-auto">INR {order.total_amount}</span>
          )}
        </div>

        {/* Rider Panel */}
        <RiderPanel
          orderId={order.id}
          orderStatus={order.order_status || 'confirmed'}
          riderId={order.rider_id}
          riderPhone={order.rider_phone}
        />

        {/* Action Buttons */}
        <div className="flex gap-2">
          {order.order_status === 'confirmed' && (
            <button
              onClick={() => onAccept(order.id)}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
            >
              <CheckCircle2 size={14} /> Accept (5 min)
            </button>
          )}
          {order.order_status === 'preparing' && (
            <button
              onClick={() => onFoodReady(order.id)}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 hover:bg-emerald-600 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all"
            >
              <CheckCircle2 size={14} /> Food Ready
            </button>
          )}
          {order.order_status === 'ready' && order.rider_id && (
            <button
              onClick={() => onDispatch(order.id)}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
            >
              <Truck size={14} /> Dispatch Rider
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
