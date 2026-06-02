'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/app/actions/authActions';
import { motion } from 'framer-motion';
import { Lock, Loader2, ArrowRight, Pizza } from 'lucide-react';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(password);
    if (result.success) {
      router.push('/admin/orders');
    } else {
      setError(result.error || 'Login failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-6 selection:bg-primary/30">
      {/* Dynamic Background Effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md z-10"
      >
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="w-20 h-20 bg-primary/10 border border-primary/20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-primary/20"
          >
            <Pizza className="text-primary" size={40} strokeWidth={1.5} />
          </motion.div>
          <h1 className="text-4xl font-black text-white tracking-tighter mb-2">
            Resto<span className="text-primary italic">Admin</span>
          </h1>
          <p className="text-gray-500 font-medium tracking-wide">Enter the secret key to access the terminal.</p>
        </div>

        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 p-8 rounded-[2.5rem] shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">
                Security Password
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" size={20} />
                <input
                  autoFocus
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-4 bg-white/[0.02] border border-white/5 rounded-2xl text-white placeholder:text-gray-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-mono"
                  required
                />
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-red-500 text-sm font-bold bg-red-500/10 p-3 rounded-xl border border-red-500/20"
              >
                {error}
              </motion.p>
            )}

            <motion.button
              whileTap={{ scale: 0.98 }}
              disabled={loading}
              type="submit"
              className="w-full py-4 bg-primary text-white rounded-2xl font-black text-lg shadow-xl shadow-primary/20 flex items-center justify-center gap-3 disabled:opacity-50 transition-all hover:brightness-110 active:brightness-90"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={24} />
              ) : (
                <>
                  Unlock Dashboard
                  <ArrowRight size={20} />
                </>
              )}
            </motion.button>
          </form>
        </div>
        
        <p className="text-center mt-12 text-gray-600 text-xs font-bold tracking-widest uppercase opacity-40">
          Goodrest Secure Protocol v2.5
        </p>
      </motion.div>
    </div>
  );
}
