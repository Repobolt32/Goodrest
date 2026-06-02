'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { loginRider } from '@/app/actions/riderActions';

export default function RiderLoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const result = await loginRider(phone, password);
    
    if (result.success) {
      // In a real app, the server action would set the cookie
      localStorage.setItem('rider_session', JSON.stringify(result.rider));
      router.push('/rider/dashboard');
    } else {
      setError(result.error || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card w-full max-w-md p-8 relative overflow-hidden"
      >
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-red-500/10 blur-[100px] rounded-full" />
        
        <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Rider Access</h1>
        <p className="text-slate-400 text-sm mb-8 font-medium">Log in to your dashboard to start deliveries.</p>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6 relative z-10">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Phone Number</label>
            <input 
              type="text" 
              placeholder="Phone Number" 
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-3.5 bg-slate-900/50 border border-slate-800 rounded-xl text-white font-bold outline-none focus:ring-1 ring-red-500/50 transition-all placeholder:text-slate-700 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Password</label>
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-3.5 bg-slate-900/50 border border-slate-800 rounded-xl text-white font-bold outline-none focus:ring-1 ring-red-500/50 transition-all placeholder:text-slate-700 disabled:opacity-50"
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-white text-slate-950 rounded-xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-white/5 disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
