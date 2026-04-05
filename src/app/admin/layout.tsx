'use client';

import { useRouter, usePathname } from 'next/navigation';
import { logout } from '@/app/actions/authActions';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingBag, 
  LogOut, 
  Search, 
  Bell, 
  ChefHat,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  const isLoginPage = pathname === '/admin/login';
  if (isLoginPage) return <>{children}</>;

  const handleLogout = async () => {
    await logout();
    router.push('/admin/login');
  };

  const menuItems = [
    { name: 'Orders', icon: ShoppingBag, href: '/admin/orders' },
    { name: 'Menu Editor', icon: ChefHat, href: '/admin/menu' },
  ];

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-slate-800">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-100 flex flex-col p-6 sticky top-0 h-screen z-40 shadow-sm transition-all duration-300">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 shadow-md shadow-primary/5">
            <ShoppingBag className="text-primary" size={20} strokeWidth={2.5} />
          </div>
          <span className="font-black text-xl tracking-tight">Good<span className="text-primary italic">rest</span></span>
        </div>

        <nav className="flex-1 space-y-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.name} 
                href={item.href}
                className={`flex items-center group gap-3 px-4 py-3.5 rounded-2xl font-bold transition-all relative ${
                  isActive 
                  ? 'bg-primary text-white shadow-xl shadow-primary/20' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 group'
                }`}
              >
                <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span className="flex-1 tracking-wide">{item.name}</span>
                {isActive && (
                  <motion.div layoutId="activeDot" className="w-1.5 h-1.5 rounded-full bg-white shadow-md" />
                )}
                {!isActive && (
                  <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 translate-x-[-4px] group-hover:translate-x-0 transition-all text-slate-300" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="pt-6 border-t border-slate-100 mt-6 space-y-4">
          <div className="px-4 py-3 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Authenticated As</p>
            <p className="text-sm font-bold text-slate-800">Resto Administrator</p>
          </div>
          
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-red-500 hover:bg-red-50 transition-all border border-transparent hover:border-red-100"
          >
            <LogOut size={20} strokeWidth={2.5} />
            <span className="tracking-wide">Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative">
        {/* Header Bar */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 px-10 flex items-center justify-between sticky top-0 z-30">
          <div className="relative w-96 hidden md:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search orders, customers..." 
              className="w-full pl-12 pr-4 py-2.5 bg-slate-50/50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-primary/10 focus:border-primary/30 transition-all outline-none text-sm font-medium"
            />
          </div>
          
          <div className="flex items-center gap-4">
            <button className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/5 transition-all relative">
              <Bell size={20} />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-primary rounded-full border-2 border-white shadow-sm" />
            </button>
            <div className="h-10 w-[1px] bg-slate-100 mx-2" />
            <div className="flex items-center gap-3 pl-2">
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-0.5">Manager</p>
                <p className="text-sm font-bold text-slate-900 leading-none">Admin Panel</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-hover shadow-lg flex items-center justify-center text-white font-black">
                A
              </div>
            </div>
          </div>
        </header>

        <section className="p-10 flex-1 overflow-auto max-w-7xl mx-auto w-full">
           <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </section>
      </main>
    </div>
  );
}
