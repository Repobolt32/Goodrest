"use client";

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Search } from 'lucide-react';

export default function Header({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const isDark = variant === 'dark';
  
  return (
    <header className="absolute top-0 left-0 right-0 z-50 pt-[clamp(0.75rem,3vw,1.5rem)] pb-6 px-6 md:px-12 flex items-center justify-between pointer-events-auto">
      <div>
        <Link href="/">
          <div className="text-xl sm:text-2xl md:text-4xl font-black tracking-tight mb-2">
            <span className={isDark ? "text-white" : "text-gray-900"}>Good</span>
            <span className="text-[#EF4444]">rest</span>
          </div>
        </Link>
      </div>

      <Link href="/track">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`flex items-center justify-center rounded-full transition-colors shadow-lg px-3 py-1.5 sm:px-4 sm:py-2 md:px-6 md:py-3 ${
            isDark ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'
          }`}
          style={{ letterSpacing: "0.2px" }}
          aria-label="Track Order"
        >
          <Search size={18} className={isDark ? "text-gray-900" : "text-white"} aria-hidden="true" />
          <span className="text-[13px] sm:text-[14px] md:text-[15px] font-bold ml-2">Track Order</span>
        </motion.button>
      </Link>
    </header>
  );
}
