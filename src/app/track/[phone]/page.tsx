"use client";

import React, { useEffect, useState } from 'react';
import { getOrdersByPhone } from '@/app/actions/trackActions';
import type { OrderSummary } from '@/types/orders';
import Header from '@/components/Header';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { ChevronRight, Clock, Package, Utensils } from 'lucide-react';

export default function OrderListPage({ params }: { params: Promise<{ phone: string }> }) {
  const unwrappedParams = React.use(params);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrders() {
      const data = await getOrdersByPhone(unwrappedParams.phone);
      setOrders(data);
      setLoading(false);
    }
    fetchOrders();
  }, [unwrappedParams.phone]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'preparing': return 'text-orange-500 bg-orange-50 border-orange-100';
      case 'ready': return 'text-blue-500 bg-blue-50 border-blue-100';
      case 'out_for_delivery': return 'text-purple-500 bg-purple-50 border-purple-100';
      case 'delivered': return 'text-green-500 bg-green-50 border-green-100';
      default: return 'text-gray-500 bg-gray-50 border-gray-100';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      
      <main className="flex-1 p-6 max-w-2xl mx-auto w-full">
        <h2 className="text-2xl font-black text-gray-900 mb-8 px-2 flex items-center gap-3">
          <Package size={24} className="text-primary" />
          Recent Orders
        </h2>

        {loading ? (
          <div className="space-y-6">
            {[1, 2].map(i => (
              <div key={i} className="h-40 bg-white rounded-bento animate-pulse shadow-sm" />
            ))}
          </div>
        ) : orders.length > 0 ? (
          <div className="space-y-6">
            <AnimatePresence>
              {orders.map((order, index) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link href={`/track/order/${order.id}`}>
                    <div className="group bg-white p-6 rounded-bento shadow-xl shadow-gray-200 border border-gray-100 hover:border-primary/20 hover:shadow-2xl hover:shadow-primary/5 transition-all relative overflow-hidden">
                      {/* Active indicator */}
                      {['preparing', 'ready', 'out_for_delivery'].includes(order.order_status || 'placed') && (
                        <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                      )}

                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xl font-black text-gray-900 tracking-tight">{order.friendly_id}</span>
                            <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border ${getStatusColor(order.order_status || 'placed')}`}>
                              {(order.order_status || 'placed').replace(/_/g, ' ')}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm font-medium text-gray-400">
                            <span className="flex items-center gap-1.5">
                              <Clock size={14} />
                              {new Date(order.created_at || '').toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Utensils size={14} />
                              {order.items?.length || 0} Items
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <span className="block text-xs font-bold text-gray-300 uppercase tracking-widest mb-1">Payable</span>
                            <span className="text-2xl font-black text-primary">₹{order.total_amount}</span>
                          </div>
                          <ChevronRight className="text-gray-200 group-hover:text-primary group-hover:translate-x-1 transition-all" size={24} />
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-bento shadow-sm border border-gray-100">
            <Package size={48} className="mx-auto text-gray-100 mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Orders Found</h3>
            <p className="text-gray-400 font-medium">We couldn&apos;t find any orders for this number.</p>
            <Link href="/" className="inline-block mt-8 text-primary font-bold border-b-2 border-primary/20 pb-0.5 hover:border-primary transition-all">
              Go back to menu
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
