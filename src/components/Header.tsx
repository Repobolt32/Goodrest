"use client";

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Search } from 'lucide-react';

export default function Header() {
  return (
    <header className="absolute top-0 left-0 right-0 z-50 pt-8 pb-6 px-6 md:px-12 flex items-center justify-between pointer-events-auto">
      <div>
        <Link href="/">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">
            <span className="text-white">Good</span><span className="text-[#EF4444]">rest</span>
          </h1>
        </Link>
      </div>

      <Link href="/track">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="btn-strong flex items-center gap-2 px-5 py-2.5 md:px-6 md:py-3 bg-white text-gray-900 font-bold rounded-full transition-colors shadow-lg"
          style={{ letterSpacing: "0.2px" }}
        >
          <Search size={18} className="text-gray-900" />
          <span className="text-[15px]">Track Order</span>
        </motion.button>
      </Link>
    </header>
  );
}
