'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Clock, X } from 'lucide-react';
import type { OrderRecord } from '@/types/orders';

interface BellNotificationProps {
  orders: OrderRecord[];
  onAccept: (orderId: string) => void;
}

export default function BellNotification({ orders, onAccept }: BellNotificationProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const hasConfirmedOrders = orders.some(o => o.order_status === 'confirmed' && !dismissed.has(o.id));

  // Audio loop: play bell sound continuously while confirmed orders exist
  useEffect(() => {
    // If running in Electron, the bell popup plays the beep sound, so the main window doesn't need to beep to prevent duplicate audio!
    const isElectron = typeof window !== 'undefined' && !!(window as unknown as { electronAPI?: unknown }).electronAPI;
    if (isElectron) return;

    if (hasConfirmedOrders) {
      const audio = new Audio('/audio/goodrest-bill.mp3');
      audio.loop = true;
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn('Playback prevented by browser policy:', error);
        });
      }

      return () => {
        audio.pause();
        audio.currentTime = 0;
      };
    }
  }, [hasConfirmedOrders]);

  if (!hasConfirmedOrders) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className="fixed top-4 right-4 z-50 max-w-sm w-full space-y-3"
      >
        {orders
          .filter(o => o.order_status === 'confirmed' && !dismissed.has(o.id))
          .map((order) => (
            <motion.div
              key={order.id}
              layout
              data-testid="new-order-popup"
              className="bg-white border border-red-200 rounded-2xl shadow-2xl shadow-red-500/10 p-5"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Bell size={16} className="text-red-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-red-500">
                    New Order #{order.friendly_id || order.id.slice(0, 8)}
                  </span>
                </div>
                <button
                  data-testid="close-new-order-popup"
                  onClick={() => setDismissed(prev => new Set(prev).add(order.id))}
                  className="p-1 text-slate-300 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-2 mb-4">
                <p className="text-sm font-black text-slate-800">{order.customer_name}</p>
                <p className="text-[10px] font-bold text-slate-400">{order.customer_phone}</p>
                <div className="flex flex-wrap gap-1">
                  {order.items.map((item, i) => (
                    <span key={i} className="text-[9px] bg-slate-50 px-2 py-0.5 rounded-md text-slate-600 font-bold">
                      {item.quantity}x {item.name}
                    </span>
                  ))}
                </div>
                <p className="text-lg font-black text-slate-900">INR {order.total_amount}</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                  <Clock size={12} />
                  Auto-reject in 5 min
                </div>
                <button
                  onClick={() => onAccept(order.id)}
                  className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
                >
                  Accept Order
                </button>
              </div>
            </motion.div>
          ))}
      </motion.div>
    </AnimatePresence>
  );
}
