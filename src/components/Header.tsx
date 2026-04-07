"use client";

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Search } from 'lucide-react';

export default function Header() {
  return (
    <header className="absolute top-0 left-0 right-0 z-50 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-6 px-6 md:px-12 flex items-center justify-between pointer-events-auto">
      <div>
        <Link href="/">
          <div className="text-2xl md:text-4xl font-black tracking-tight mb-2">
            <span className="text-white">Good</span><span className="text-[#EF4444]">rest</span>
          </div>
        </Link>
      </div>

      <Link href="/track">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center justify-center bg-white text-gray-900 rounded-full transition-colors shadow-lg px-4 py-2 md:px-6 md:py-3"
          style={{ letterSpacing: "0.2px" }}
          aria-label="Track Order"
        >
          <Search size={18} className="text-gray-900" aria-hidden="true" />
          <span className="text-[14px] md:text-[15px] font-bold ml-2">Track Order</span>
        </motion.button>
      </Link>
    </header>
  );
}
