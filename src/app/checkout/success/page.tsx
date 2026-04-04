"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { 
  CheckCircle2, 
  Utensils, 
  Package, 
  Receipt, 
  User, 
  MapPin, 
  CreditCard, 
  Banknote,
  Loader2,
  Calendar
} from 'lucide-react';
import { getOrderById } from '@/app/actions/orderActions';

function OrderDetails() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderId) {
      getOrderById(orderId).then(res => {
        if (res.success) setOrder(res.data);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <Loader2 className="animate-spin text-primary mb-4" size={32} />
        <p className="text-gray-400 font-bold animate-pulse">GENERATING BILL...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center p-12">
        <p className="text-gray-400">Order details not found.</p>
        <Link href="/" className="text-primary font-bold hover:underline">Back to Menu</Link>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl mx-auto space-y-6"
    >
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-bento border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Receipt size={16} className="text-primary" />
            <span className="text-xs font-black text-gray-400 uppercase tracking-widest leading-none">ORDER ID</span>
          </div>
          <h2 className="text-lg font-black text-gray-900">#{order.id.slice(-8).toUpperCase()}</h2>
        </div>
        <div className="text-left sm:text-right">
          <div className="flex items-center sm:justify-end gap-2 mb-1">
            <Calendar size={16} className="text-primary" />
            <span className="text-xs font-black text-gray-400 uppercase tracking-widest leading-none">DATE</span>
          </div>
          <p className="font-bold text-gray-600">{new Date(order.created_at).toLocaleDateString()} • {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      </div>

      {/* Bill Items */}
      <div className="bg-white rounded-bento border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center gap-2">
          <Package size={18} className="text-primary" />
          <h3 className="font-black text-gray-900 uppercase tracking-tight">Order Summary</h3>
        </div>
        
        <div className="p-6 space-y-4">
          {order.items.map((item: any, idx: number) => (
            <div key={idx} className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 flex items-center justify-center bg-gray-50 rounded-md text-xs font-black text-primary">
                  {item.quantity}
                </span>
                <span className="font-bold text-gray-700">{item.name}</span>
              </div>
              <span className="font-black text-gray-900">₹{item.price * item.quantity}</span>
            </div>
          ))}
        </div>

        <div className="bg-gray-50 p-6 space-y-2">
          <div className="flex justify-between items-center text-sm text-gray-500 font-bold uppercase tracking-widest">
            <span>Subtotal</span>
            <span>₹{order.total_amount}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-gray-100">
            <span className="text-lg font-black text-gray-900">Total Amount</span>
            <span className="text-2xl font-black text-primary">₹{order.total_amount}</span>
          </div>
        </div>
      </div>

      {/* Logistics & Payment */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Customer & Address */}
        <div className="bg-white p-6 rounded-bento border border-gray-100 shadow-sm space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <User size={14} className="text-gray-400" />
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest">CUSTOMER</span>
            </div>
            <p className="font-bold text-gray-800">{order.customer_name}</p>
            <p className="text-sm text-gray-500">{order.customer_phone}</p>
          </div>
          <div className="space-y-1 pt-2 border-t border-gray-50">
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-gray-400" />
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest">DELIVERY TO</span>
            </div>
            <p className="text-sm font-bold text-gray-600 line-clamp-2">{order.delivery_address}</p>
          </div>
        </div>

        {/* Payment Stats */}
        <div className="bg-white p-6 rounded-bento border border-gray-100 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CreditCard size={14} className="text-gray-400" />
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest">PAYMENT</span>
            </div>
            <div className="flex items-center gap-2">
              {order.payment_method === 'online' ? (
                <CreditCard size={18} className="text-primary" />
              ) : (
                <Banknote size={18} className="text-green-500" />
              )}
              <p className="font-black text-gray-800 uppercase text-sm tracking-tight">
                {order.payment_method === 'online' ? 'Online Payment' : 'Cash on Delivery'}
              </p>
            </div>
          </div>
          
          <div className={`mt-2 py-2 px-4 rounded-xl text-center text-xs font-black uppercase tracking-widest border ${
            order.payment_status === 'paid' 
            ? 'bg-green-50 text-green-600 border-green-100' 
            : 'bg-orange-50 text-orange-600 border-orange-100'
          }`}>
            {order.payment_status === 'paid' ? 'Paid & Verified' : 'Payment Pending'}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function SuccessPage() {
  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col items-center py-12 px-6">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 shadow-xl shadow-green-500/10 border border-green-50"
      >
        <CheckCircle2 size={40} className="text-green-500" />
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-center mb-10"
      >
        <h1 className="text-4xl font-black text-gray-900 mb-3 tracking-tight">Order Placed!</h1>
        <p className="text-gray-500 font-medium max-w-md mx-auto">
          Your chef-curated meal is in the works. Here is your digital receipt.
        </p>
      </motion.div>

      <Suspense fallback={<div className="p-12"><Loader2 className="animate-spin text-primary" /></div>}>
        <OrderDetails />
      </Suspense>

      <div className="mt-12 space-y-6 text-center">
        <Link href="/">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full sm:w-80 py-4 bg-gray-900 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-2xl shadow-gray-900/20"
          >
            <Utensils size={20} />
            BACK TO MENU
          </motion.button>
        </Link>
        
        <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">
          Thank you for choosing Goodrest
        </p>
      </div>

      {/* Decorative Branding */}
      <div className="fixed bottom-10 right-10 opacity-[0.03] pointer-events-none select-none">
        <Utensils size={200} />
      </div>
    </div>
  );
}
