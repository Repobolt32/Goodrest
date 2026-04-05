"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { motion } from 'framer-motion';
import { Smartphone, ArrowRight } from 'lucide-react';

export default function TrackEntryPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const router = useRouter();

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneNumber.length >= 10) {
      router.push(`/track/${phoneNumber}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      
      <main className="flex-1 flex flex-col items-center justify-center p-6 -mt-20">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-bento p-8 shadow-xl shadow-gray-200 border border-gray-100"
        >
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
            <Smartphone className="text-primary" size={32} />
          </div>

          <h2 className="text-2xl font-black text-gray-900 mb-2">Track Your Meal</h2>
          <p className="text-gray-500 font-medium mb-8">Enter your phone number to see your recent orders and live status.</p>

          <form onSubmit={handleTrack} className="space-y-4">
            <div className="relative">
              <input
                type="tel"
                placeholder="Phone Number (e.g., 9876543210)"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold text-gray-900 focus:border-primary focus:outline-none transition-all placeholder:text-gray-300"
                required
              />
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="w-full py-4 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-primary/20"
            >
              Continue to Tracking
              <ArrowRight size={20} />
            </motion.button>
          </form>

          <p className="mt-8 text-center text-xs font-bold text-gray-300 uppercase tracking-widest leading-relaxed">
            Quick Lookup • Real-time Updates 
          </p>
        </motion.div>
      </main>
    </div>
  );
}
