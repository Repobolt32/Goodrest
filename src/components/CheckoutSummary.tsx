"use client";

import { useCart } from '@/hooks/useCart';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, X } from 'lucide-react';
import Image from 'next/image';

export default function CheckoutSummary() {
  const { items, totalPrice, removeFromCart, mounted } = useCart();

  if (!mounted) return (
    <div className="bg-white p-8 rounded-bento border border-gray-100 flex items-center justify-center">
      <div className="animate-pulse flex space-x-4">
        <div className="rounded-full bg-gray-200 h-10 w-10"></div>
        <div className="flex-1 space-y-6 py-1">
          <div className="h-2 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  );

  if (items.length === 0) {
    return (
      <div className="bg-white p-8 rounded-bento border border-gray-100 text-center">
        <div className="inline-flex p-3 bg-gray-50 rounded-full mb-4">
          <ShoppingBag className="text-gray-300" size={32} />
        </div>
        <p className="text-gray-400 font-bold">Your cart is empty.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-bento border border-gray-100 shadow-sm overflow-hidden">
      <ul className="divide-y divide-gray-50">
        <AnimatePresence mode="popLayout">
          {items.map((item) => (
            <motion.li
              key={item.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-4 flex items-center gap-4 group"
            >
              {item.image_url ? (
                <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                  <Image
                    src={item.image_url}
                    alt={item.name}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 bg-gray-50 rounded-xl flex items-center justify-center text-gray-300 font-black text-xl">
                  {item.name[0]}
                </div>
              )}
              
              <div className="flex-grow">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-gray-900 group-hover:text-primary transition-colors">{item.name}</h3>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="p-1 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-full transition-all opacity-0 group-hover:opacity-100"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <p className="text-sm font-medium text-gray-500">
                    <span className="text-primary font-black">₹{item.price}</span> × {item.quantity}
                  </p>
                  <p className="font-black text-gray-900">₹{item.price * item.quantity}</p>
                </div>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      
      <div className="bg-gray-50 p-6 flex justify-between items-center border-t border-gray-100">
        <span className="font-bold uppercase tracking-widest text-xs text-gray-400">Total Payable</span>
        <span className="text-2xl font-black text-primary">₹{totalPrice}</span>
      </div>
    </div>
  );
}
