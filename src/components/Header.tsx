"use client";

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Search } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-white pt-8 pb-6 px-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <Link href="/">
          <h1 className="text-4xl font-black tracking-tight text-gray-900 mb-2">
            Good<span className="text-primary italic">rest</span>
          </h1>
        </Link>
        <p className="text-gray-500 font-medium tracking-wide">Select from our chef-curated menu.</p>
      </div>

      <Link href="/track">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 px-6 py-3 bg-gray-50 hover:bg-gray-100 text-gray-900 font-bold rounded-2xl border-2 border-gray-100 transition-colors"
        >
          <Search size={18} className="text-primary" />
          Track Order
        </motion.button>
      </Link>
    </header>
  );
}
