'use client';

import { motion } from 'framer-motion';

interface OnlineToggleProps {
  online: boolean;
  loading: boolean;
  onChange: (online: boolean) => void;
}

export default function OnlineToggle({ online, loading, onChange }: OnlineToggleProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl">
      <div className="hidden sm:block text-right">
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none mb-0.5">Status</p>
        <p className={`text-[11px] font-bold leading-none ${online ? 'text-green-600' : 'text-red-500'}`}>
          {online ? 'ONLINE' : 'OFFLINE'}
        </p>
      </div>
      <button
        onClick={() => onChange(!online)}
        disabled={loading}
        className={`relative w-12 h-6 rounded-full transition-colors ${online ? 'bg-green-500' : 'bg-red-500'}`}
      >
        <motion.div
          animate={{ x: online ? 26 : 2 }}
          className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
        />
      </button>
    </div>
  );
}
