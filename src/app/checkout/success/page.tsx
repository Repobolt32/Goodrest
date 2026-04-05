"use client";

import { motion } from 'framer-motion';
import Link from 'next/link';
import { CheckCircle2, Utensils } from 'lucide-react';

export default function SuccessPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mb-8"
      >
        <CheckCircle2 size={48} className="text-green-500" />
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <h1 className="text-3xl font-black text-gray-900 mb-2">Order Placed!</h1>
        <p className="text-gray-500 font-medium mb-12 max-w-sm mx-auto">
          Thank you for your order. Your delicious meal is now being prepared. We&apos;ll update you soon!
        </p>

        <div className="space-y-4">
          <Link href="/track">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full sm:w-64 py-4 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-primary/20"
            >
              <Utensils size={18} />
              Track Your Order
            </motion.button>
          </Link>

          <Link href="/">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full sm:w-64 py-4 bg-gray-50 text-gray-900 rounded-2xl font-bold flex items-center justify-center gap-2 border-2 border-gray-100 transition-colors"
            >
              Back to Menu
            </motion.button>
          </Link>
          
          <p className="text-xs font-bold text-gray-300 uppercase tracking-widest pt-4">
            Order Processed Successfully
          </p>
        </div>
      </motion.div>

      {/* Decorative Elements */}
      <motion.div 
        animate={{ 
          scale: [1, 1.1, 1],
          rotate: [0, 5, -5, 0]
        }}
        transition={{ duration: 10, repeat: Infinity }}
        className="absolute top-10 right-10 opacity-5 pointer-events-none"
      >
        <Utensils size={120} />
      </motion.div>
    </div>
  );
}
