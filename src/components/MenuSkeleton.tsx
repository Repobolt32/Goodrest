"use client";

import { motion } from 'framer-motion';

export default function MenuSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div 
          key={i} 
          className="relative bg-white rounded-[2rem] border-2 border-slate-100 p-4 h-[380px] overflow-hidden flex flex-col shadow-sm"
        >
          {/* Image Skeleton */}
          <div className="w-full h-48 bg-slate-100 rounded-2xl relative overflow-hidden">
            <motion.div
              animate={{
                x: ['-100%', '100%'],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "linear",
              }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-20deg]"
            />
          </div>

          <div className="mt-6 space-y-4 px-2">
            {/* Title Skeleton */}
            <div className="h-6 bg-slate-100 rounded-full w-3/4 relative overflow-hidden">
              <motion.div
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              />
            </div>

            {/* Description Skeleton */}
            <div className="space-y-2">
              <div className="h-3 bg-slate-50 rounded-full w-full relative overflow-hidden">
                <motion.div
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear", delay: 0.1 }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                />
              </div>
              <div className="h-3 bg-slate-50 rounded-full w-5/6 relative overflow-hidden">
                <motion.div
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear", delay: 0.2 }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                />
              </div>
            </div>

            {/* Price & Button Skeleton */}
            <div className="pt-6 flex items-center justify-between">
              <div className="h-8 bg-slate-100 rounded-full w-24 relative overflow-hidden">
                <motion.div
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                />
              </div>
              <div className="h-12 bg-slate-100 rounded-2xl w-28 relative overflow-hidden">
                <motion.div
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                />
              </div>
            </div>
          </div>

          {/* Branded Watermark (Faint) */}
          <div className="absolute top-4 right-4 opacity-[0.03] rotate-12 pointer-events-none">
            <span className="font-black text-4xl uppercase tracking-tighter">GOODREST</span>
          </div>
        </div>
      ))}
    </div>
  );
}
