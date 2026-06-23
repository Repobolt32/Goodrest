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
    
    const result = await loginRider(phone, password);
    
    if (result.success) {
      localStorage.setItem('rider_session', JSON.stringify({ ...result.rider, token: result.token }));
      router.push('/rider/dashboard');
    } else {
      setError(result.error || 'Login failed');
    }
    setLoading(false);
  };

  const inputType = showPassword ? 'text' : 'password';

  return (
    <div className="min-h-screen bg-[#1C1C1C] flex items-center justify-center p-6">
      <motion.div
        initial={{ y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#252525] border border-[#363636] rounded-2xl w-full max-w-md p-8 relative overflow-hidden"
      >
        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Rider Access</h1>
        <p className="text-[#9C9C9C] text-sm mb-8 font-normal">Log in to your dashboard to start deliveries.</p>

        {error && (
          <div className="mb-6 p-4 bg-[#E23744]/10 border border-[#E23744]/20 rounded-xl text-[#E23744] text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6 relative z-10">
          <div>
            <label className="block text-xs font-medium text-[#9C9C9C] mb-2">Phone Number</label>
            <input 
              type="text" 
              placeholder="Phone Number" 
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-3.5 bg-[#2C2C2C] border border-[#363636] rounded-xl text-white font-medium outline-none focus:ring-1 focus:ring-[#E23744]/50 transition-all placeholder:text-[#696969] disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#9C9C9C] mb-2">Password</label>
            <div className="relative">
              <input 
                type={inputType} 
                placeholder="Password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full pl-4 pr-12 py-3.5 bg-[#2C2C2C] border border-[#363636] rounded-xl text-white font-medium outline-none focus:ring-1 focus:ring-[#E23744]/50 transition-all placeholder:text-[#696969] disabled:opacity-50"
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
            className="w-full py-4 bg-[#E23744] hover:bg-[#CB202D] text-white rounded-xl font-semibold uppercase tracking-wider text-xs hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-[#E23744]/10 disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
