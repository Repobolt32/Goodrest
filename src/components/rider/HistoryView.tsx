'use client';

import { motion } from 'framer-motion';
import { Clock, User, MapPin, Route, Calendar } from 'lucide-react';

interface HistoryOrder {
  id: string;
  friendly_id: string | null;
  customer_name: string;
  delivery_address: string;
  distance_km: number | null;
  rider_earning: number | null;
  delivered_at: string | null;
}

interface HistoryViewProps {
  orders: HistoryOrder[];
  loading: boolean;
}

function formatDeliveredTime(deliveredAtStr: string | null): string {
  if (!deliveredAtStr) return 'Unknown';
  try {
    const deliveredAt = new Date(deliveredAtStr);
    const now = new Date();
    const diffMs = now.getTime() - deliveredAt.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 0) {
      return '0m ago';
    }
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    }

    // Format as HH:MM AM/PM in 12-hour format
    let hours = deliveredAt.getHours();
    const minutes = String(deliveredAt.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    const hoursStr = String(hours).padStart(2, '0');
    return `${hoursStr}:${minutes} ${ampm}`;
  } catch {
    return 'Unknown';
  }
}

export default function HistoryView({ orders, loading }: HistoryViewProps) {
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-5 w-40 bg-[#252525] rounded mb-2" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-[#252525] border border-[#363636] rounded-2xl p-5 space-y-3" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title & Count */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-white tracking-wide">Last 24 Hours</h2>
          <p className="text-xs text-[#9C9C9C] font-medium tracking-wide mt-0.5">
            Your recent completed deliveries
          </p>
        </div>
        <span className="text-xs bg-[#252525] border border-[#363636] text-[#9C9C9C] font-bold px-3 py-1.5 rounded-full">
          {orders.length} {orders.length === 1 ? 'delivery' : 'deliveries'}
        </span>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {orders.map((order) => {
          const orderNum = order.friendly_id || order.id.slice(0, 8);
          const customer = order.customer_name || 'Guest';
          const address = order.delivery_address || 'No address';
          const distance = order.distance_km != null ? `${order.distance_km} km` : '—';
          const earning = order.rider_earning != null ? `₹${order.rider_earning}` : '₹0';
          const timeLabel = formatDeliveredTime(order.delivered_at);

          return (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#252525] border border-[#363636] rounded-2xl p-5 hover:border-[#3AB757]/30 transition-all shadow-md"
            >
              {/* Card Header */}
              <div className="flex justify-between items-center border-b border-[#363636]/40 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white bg-[#1C1C1C] px-2.5 py-1 rounded-lg border border-[#363636]">
                    #{orderNum}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[#9C9C9C] font-semibold">
                  <Clock size={13} className="text-[#9C9C9C]" />
                  <span>{timeLabel}</span>
                </div>
              </div>

              {/* Card Details */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-white font-bold">
                  <User size={13} className="text-[#9C9C9C]" />
                  <span>{customer}</span>
                </div>
                <div className="flex items-start gap-2 text-[#9C9C9C] font-medium leading-normal">
                  <MapPin size={13} className="text-[#9C9C9C] shrink-0 mt-0.5" />
                  <span>{address}</span>
                </div>
                
                <div className="flex justify-between items-center pt-2 mt-2 border-t border-[#363636]/30">
                  <div className="flex items-center gap-1.5 text-xs text-[#9C9C9C] font-medium">
                    <Route size={13} className="text-[#696969]" />
                    <span>Distance: <strong className="text-white">{distance}</strong></span>
                  </div>
                  <div className="flex items-center gap-0.5 text-[#3AB757] font-black text-sm">
                    <span>{earning}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* Empty State */}
        {orders.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-12 px-4 bg-[#252525] border border-[#363636] rounded-2xl"
          >
            <div className="w-12 h-12 bg-[#363636]/40 rounded-full flex items-center justify-center text-[#696969] mb-4">
              <Calendar size={24} />
            </div>
            <p className="text-xs text-[#9C9C9C] font-bold text-center">
              No deliveries in the last 24 hours
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
