'use client';

import { useState } from 'react';
import { toggleItemAvailability, updateItemPrice } from '@/app/actions/adminActions';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, 
  X, 
  Save, 
  RotateCcw, 
  Tag, 
  ChefHat, 
  Eye, 
  EyeOff,
  TrendingUp
} from 'lucide-react';

type MenuItem = any; 

export default function MenuManagementClient({ initialItems }: { initialItems: MenuItem[] }) {
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');
  const [loading, setLoading] = useState<string | null>(null);

  const handleToggleAvailability = async (id: string, currentStatus: boolean) => {
    setLoading(id);
    // Optimistic Update
    setItems((prev) => prev.map(item => item.id === id ? { ...item, is_available: !currentStatus } : item));
    
    const result = await toggleItemAvailability(id, !currentStatus);
    if (!result.success) {
      alert('Failed to update availability: ' + result.error);
      // Rollback
      setItems((prev) => prev.map(item => item.id === id ? { ...item, is_available: currentStatus } : item));
    }
    setLoading(null);
  };

  const handlePriceSave = async (id: string) => {
    const newPrice = parseFloat(editPrice);
    if (isNaN(newPrice)) return;

    setLoading(id);
    const result = await updateItemPrice(id, newPrice);
    if (result.success) {
      setItems((prev) => prev.map(item => item.id === id ? { ...item, price: newPrice } : item));
      setEditingId(null);
    } else {
      alert('Failed to update price: ' + result.error);
    }
    setLoading(null);
  };

  // Group items by category
  const categories = Array.from(new Set(items.map(i => i.category)));

  return (
    <div className="space-y-12 pb-32">
      {categories.map((category) => (
        <section key={category} className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="p-2 bg-primary/10 rounded-xl">
              <ChefHat className="text-primary" size={20} />
            </div>
            <h2 className="text-xl font-black tracking-tight text-slate-800 uppercase tracking-widest">{category}</h2>
            <div className="flex-1 h-[1px] bg-slate-100" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <AnimatePresence>
              {items
                .filter(i => i.category === category)
                .map((item) => (
                  <motion.div
                    layout
                    key={item.id}
                    className={`bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group relative overflow-hidden ${
                      !item.is_available ? 'grayscale opacity-75' : ''
                    }`}
                  >
                    <div className="flex items-start gap-6 relative z-10">
                      {/* Image Preview */}
                      <div className="w-20 h-20 rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden flex-shrink-0">
                        <img 
                          src={item.image_url} 
                          alt={item.name} 
                          className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                        />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-black text-slate-900 leading-tight">{item.name}</h3>
                          <button 
                            onClick={() => handleToggleAvailability(item.id, item.is_available)}
                            disabled={loading === item.id}
                            className={`p-2 rounded-xl transition-all ${
                              item.is_available 
                              ? 'bg-green-50 text-green-600 hover:bg-green-100' 
                              : 'bg-red-50 text-red-600 hover:bg-red-100'
                            }`}
                          >
                            {item.is_available ? <Eye size={18} /> : <EyeOff size={18} />}
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-2 mb-4">
                           <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${
                             item.is_available ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                           }`}>
                             {item.is_available ? 'In Stock' : 'Hidden'}
                           </span>
                        </div>

                        {/* Price Controls */}
                        <div className="flex items-center gap-3">
                          {editingId === item.id ? (
                            <div className="flex items-center gap-2 flex-1 animate-in slide-in-from-left-2 transition-all">
                              <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                                <input 
                                  autoFocus
                                  type="number"
                                  value={editPrice}
                                  onChange={(e) => setEditPrice(e.target.value)}
                                  className="w-full pl-6 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                />
                              </div>
                              <button 
                                onClick={() => handlePriceSave(item.id)}
                                className="p-2 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
                                disabled={loading === item.id}
                              >
                                <Save size={18} />
                              </button>
                              <button 
                                onClick={() => setEditingId(null)}
                                className="p-2 bg-slate-100 text-slate-400 rounded-xl hover:bg-slate-200 transition-colors"
                              >
                                <X size={18} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between flex-1">
                              <span className="text-xl font-black text-slate-900 tracking-tight">₹{item.price}</span>
                              <button 
                                onClick={() => {
                                  setEditingId(item.id);
                                  setEditPrice(item.price.toString());
                                }}
                                className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary hover:bg-primary/5 px-3 py-2 rounded-xl transition-all border border-transparent hover:border-primary/10"
                              >
                                <Tag size={14} /> Update Price
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Background Visual Decoration */}
                    <div className="absolute -bottom-6 -right-6 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                      <TrendingUp size={120} strokeWidth={1} />
                    </div>
                  </motion.div>
                ))}
            </AnimatePresence>
          </div>
        </section>
      ))}
    </div>
  );
}
