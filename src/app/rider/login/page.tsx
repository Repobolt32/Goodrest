'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { loginRider } from '@/app/actions/riderActions';
import { Eye, EyeOff } from 'lucide-react';

export default function RiderLoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // REST endpoint — reliable through Cloudflare tunnel
      const res = await fetch('/api/rider/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      const result = await res.json();

      if (result.success) {
        localStorage.setItem('rider_session', JSON.stringify(result.rider));
        router.push('/rider/dashboard');
      } else {
        setError(result.error || 'Login failed');
      }
    } catch {
      // Fallback: server action (works in local dev without tunnel)
      try {
        const result = await loginRider(phone, password);
        if (result.success) {
          localStorage.setItem('rider_session', JSON.stringify(result.rider));
          router.push('/rider/dashboard');
        } else {
          setError(result.error || 'Login failed');
        }
      } catch {
        setError('Connection failed. Check your network.');
      }
    }
    setLoading(false);
  };

  const inputType = showPassword ? 'text' : 'password';

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <motion.div
        initial={{ y: 20 }}
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
            <div className="relative">
              <input 
                type={inputType} 
                placeholder="Password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full pl-4 pr-12 py-3.5 bg-slate-900/50 border border-slate-800 rounded-xl text-white font-bold outline-none focus:ring-1 ring-red-500/50 transition-all placeholder:text-slate-700 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors cursor-pointer disabled:opacity-50 focus:outline-none z-10"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
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
