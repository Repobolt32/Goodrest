"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getOrderById } from '@/app/actions/trackActions';
import { supabase } from '@/lib/supabase';
import Header from '@/components/Header';
import OrderTracker from '@/components/OrderTracker';
import { motion } from 'framer-motion';
import { Package, Utensils, ReceiptText, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function SingleOrderPage() {
  const params = useParams();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrder() {
      if (params.id) {
        const data = await getOrderById(params.id as string);
        setOrder(data);
        setLoading(false);
      }
    }
    fetchOrder();

    // Sync status real-time for the header too
    const channel = supabase
      .channel(`order-sync-${params.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${params.id}`,
        },
        (payload) => {
          if (payload.new && payload.new.order_status) {
            setOrder((prev: any) => ({ ...prev, order_status: payload.new.order_status }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center pt-20">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="text-center pt-20">
          <h2 className="text-2xl font-black text-gray-900">Order Not Found</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-12">
      <Header />
      
      <main className="flex-1 p-6 max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: Real-time Tracker */}
        <section className="space-y-6">
          <Link href={`/track/${order.customer_phone}`} className="inline-flex items-center gap-2 text-gray-400 font-bold hover:text-primary transition-colors mb-2">
            <ChevronLeft size={18} />
            Back to List
          </Link>
          <div className="flex items-center justify-between">
            <h2 className="text-4xl font-black text-gray-900 tracking-tight">{order.friendly_id}</h2>
            <div className="text-right">
              <span className="block text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1">Status</span>
              <span className="text-sm font-black text-primary uppercase tracking-widest">{order.order_status.replace(/_/g, ' ')}</span>
            </div>
          </div>
          
          <OrderTracker orderId={order.id} initialStatus={order.order_status} />
        </section>

        {/* Right Column: Order Details */}
        <section className="space-y-6">
          <div className="bg-white p-8 rounded-bento shadow-xl shadow-gray-200 border border-gray-100">
            <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-3">
              <ReceiptText size={22} className="text-primary" />
              Order Summary
            </h3>

            <div className="space-y-4 mb-8">
              {order.items?.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-primary font-black">
                      {item.quantity}
                    </div>
                    <span className="font-bold text-gray-900">{item.name}</span>
                  </div>
                  <span className="font-black text-gray-900 ml-4">₹{(item.price_at_order || item.price || 0) * item.quantity}</span>
                </div>
              ))}
            </div>

            <div className="space-y-4 pt-4 border-t-2 border-dashed border-gray-100">
              <div className="flex justify-between items-center text-gray-400 font-bold">
                <span>Subtotal</span>
                <span>₹{order.total_amount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-900 font-black text-lg">Total Payable</span>
                <span className="text-primary font-black text-2xl tracking-tight">₹{order.total_amount}</span>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-50">
              <div className="flex items-center justify-between text-xs font-black text-gray-300 uppercase tracking-widest">
                <span>Payment</span>
                <span className="text-gray-900">{order.payment_method}</span>
              </div>
            </div>
          </div>

          {/* Delivery Note */}
          <div className="bg-primary/5 p-6 rounded-bento border border-primary/10">
            <h4 className="text-sm font-black text-primary uppercase tracking-widest mb-2">Delivery To</h4>
            <p className="text-gray-900 font-bold leading-relaxed">{order.delivery_address}</p>
          </div>
        </section>
      </main>
    </div>
  );
}
