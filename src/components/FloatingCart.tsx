"use client";

import { motion } from 'framer-motion';
import { ShoppingCart, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface FloatingCartProps {
  totalItems: number;
  totalPrice: number;
}

export default function FloatingCart({ totalItems, totalPrice }: FloatingCartProps) {
  return (
    <div className="fixed bottom-6 left-0 right-0 z-50 px-4">
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: totalItems > 0 ? 1 : 0 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="max-w-md mx-auto bg-primary rounded-2xl shadow-2xl overflow-hidden shadow-primary/40 border border-white/20 backdrop-blur-lg"
      >
        <Link href="/checkout" className="flex items-center justify-between p-4 px-4 sm:px-6 text-white active:scale-x-95 transition-transform duration-150">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="relative p-2 bg-white/20 rounded-xl">
              <ShoppingCart size={24} />
              <span className="absolute -top-2 -right-2 bg-accent text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ring-2 ring-primary mb-1">
                {totalItems}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold tracking-widest text-white/70">Cart Total</span>
              <span className="text-xl font-black">Rs {totalPrice}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 font-bold uppercase tracking-wider text-xs sm:text-sm bg-white/20 px-3 sm:px-4 py-2 rounded-xl">
            Checkout
            <ArrowRight size={16} />
          </div>
        </Link>
      </motion.div>
    </div>
  );
}
