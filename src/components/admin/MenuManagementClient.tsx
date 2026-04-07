'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { 
  X, 
  Save, 
  Tag, 
  ChefHat, 
  Eye, 
  EyeOff,
  TrendingUp,
  Plus,
  Trash2,
  Edit2,
  Loader2,
  Image as ImageIcon
} from 'lucide-react';
import { 
  addMenuItem, 
  updateMenuItem, 
  deleteMenuItem, 
  toggleItemAvailability, 
  updateItemPrice,
  uploadDishImage 
} from '@/app/actions/adminActions';
import { MenuItem, Category, CategoryData } from '@/types/menu';
import { useRef } from 'react';

const isGalleryUrl = (url: string) => {
  if (!url) return false;
  const galleryPatterns = [
    'pexels.com/photo',
    'unsplash.com/photos',
    'pixabay.com/images',
    'shutterstock.com/image'
  ];
  return galleryPatterns.some(pattern => url.toLowerCase().includes(pattern)) && 
         !/\.(jpg|jpeg|png|webp|avif|gif)/i.test(url.split('?')[0]);
};

const isValidPreviewUrl = (url: string) => {
  if (!url) return false;
  // Next.js Image with unoptimized=true still requires a valid-looking URL or relative path
  try {
    if (url.startsWith('/') || url.startsWith('http')) {
      if (url.startsWith('http')) {
        new URL(url); // This will throw if invalid
      }
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
};

export default function MenuManagementClient({ 
  initialItems,
  categories 
}: { 
  initialItems: MenuItem[];
  categories: CategoryData[];
}) {
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');
  const [loading, setLoading] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    category: '' as Category | '',
    category_id: '',
    image_url: '',
    is_available: true
  });
  
  const [uploadLoading, setUploadLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setFormData({
      name: '',
      price: '',
      category: '',
      category_id: '',
      image_url: '',
      is_available: true
    });
    setSelectedItem(null);
  };

  const handleOpenAddModal = () => {
    setModalMode('add');
    resetForm();
    setIsModalOpen(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const result = await uploadDishImage(formData);
      if (result.success && result.url) {
        setFormData(prev => ({ ...prev, image_url: result.url as string }));
      } else {
        alert('Upload failed: ' + result.error);
      }
    } catch (err) {
      const error = err as Error;
      alert('Upload error: ' + error.message);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleOpenEditModal = (item: MenuItem) => {
    setModalMode('edit');
    setSelectedItem(item);
    setFormData({
      name: item.name,
      price: item.price.toString(),
      category: item.category,
      category_id: item.category_id || '',
      image_url: item.image_url || '',
      is_available: item.is_available
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading('modal');

    const data = {
      ...formData,
      price: parseFloat(formData.price),
      category: formData.category as Category,
      tags: selectedItem?.tags || []
    };

    let result;
    if (modalMode === 'add') {
      result = await addMenuItem(data);
    } else if (selectedItem) {
      result = await updateMenuItem(selectedItem.id, data);
    }

    if (result?.success) {
      if (modalMode === 'add' && result.data) {
        setItems(prev => [result.data as MenuItem, ...prev]);
      } else if (selectedItem) {
        setItems(prev => prev.map(i => i.id === selectedItem.id ? { ...i, ...data } : i));
      }
      setIsModalOpen(false);
      resetForm();
    } else {
      alert('Error: ' + result?.error);
    }
    setLoading(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to hide this item from the menu?')) return;
    
    setLoading(id);
    const result = await deleteMenuItem(id);
    if (result.success) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, is_available: false } : i));
    } else {
      alert('Error: ' + result.error);
    }
    setLoading(null);
  };

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

  // Group items by category (using the prop list to ensure order and completeness)
  const displayCategories = categories.length > 0 
    ? categories 
    : Array.from(new Set(items.map(i => i.category || 'Uncategorized'))).map(name => ({ id: name, name } as CategoryData));

  return (
    <div className="space-y-12 pb-32">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
        <div className="relative z-10">
          <p className="text-slate-500 font-medium tracking-wide">Control your dishes, prices, and availability</p>
        </div>
        <button 
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20"
        >
          <Plus size={20} /> Add New Dish
        </button>
      </div>

      {displayCategories.map((cat) => (
        <section key={cat.id} className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="p-2 bg-primary/10 rounded-xl">
              <ChefHat className="text-primary" size={20} />
            </div>
            <h2 className="text-xl font-black tracking-tight text-slate-800 uppercase tracking-widest">{cat.name}</h2>
            <div className="flex-1 h-[1px] bg-slate-100" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <AnimatePresence>
              {items
                .filter(i => (i.category_id === cat.id) || (i.category === cat.name))
                .map((item) => (
                  <motion.div
                    layout
                    key={item.id}
                    data-testid="menu-item-card"
                    className={`bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group relative overflow-hidden ${
                      !item.is_available ? 'grayscale opacity-75' : ''
                    }`}
                  >
                    <div className="flex items-start gap-6 relative z-10">
                      {/* Image Preview */}
                      <div className="w-20 h-20 rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden flex-shrink-0 relative group">
                        <Image 
                          src={item.image_url || ''} 
                          alt={item.name} 
                          width={80}
                          height={80}
                          unoptimized
                          className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                        />
                        <button 
                          onClick={() => handleOpenEditModal(item)}
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                        >
                          <Edit2 size={16} />
                        </button>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-black text-slate-900 leading-tight">{item.name}</h3>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => handleOpenEditModal(item)}
                              className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                              aria-label={`Edit ${item.name}`}
                              title="Edit"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button 
                              onClick={() => handleToggleAvailability(item.id, item.is_available)}
                              disabled={loading === item.id}
                              className={`p-2 rounded-xl transition-all ${
                                item.is_available 
                                ? 'bg-green-50 text-green-600 hover:bg-green-100' 
                                : 'bg-red-50 text-red-600 hover:bg-red-100'
                              }`}
                              aria-label={item.is_available ? "Hide from menu" : "Show on menu"}
                              title={item.is_available ? "Hide" : "Show"}
                            >
                              {item.is_available ? <Eye size={18} /> : <EyeOff size={18} />}
                            </button>
                            <button 
                              onClick={() => handleDelete(item.id)}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                              aria-label={`Delete ${item.name}`}
                              title="Delete"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
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
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">Rs </span>
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
                              <span className="text-xl font-black text-slate-900 tracking-tight">Rs {item.price}</span>
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
      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">
                      {modalMode === 'add' ? 'Add New Dish' : 'Edit Dish'}
                    </h2>
                    <p className="text-slate-500 text-sm">Fill in the details below</p>
                  </div>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="dishName" className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Dish Name</label>
                    <input
                      id="dishName"
                      type="text"
                      placeholder="e.g. Garlic Naan"
                      className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-orange-500 transition-all outline-none"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="dishPrice" className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Price (Rs)</label>
                      <input
                        id="dishPrice"
                        type="number"
                        placeholder="0.00"
                        className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-orange-500 transition-all outline-none"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        required
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label htmlFor="dishCategory" className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Category</label>
                      <select
                        id="dishCategory"
                        className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-slate-900 focus:ring-2 focus:ring-orange-500 transition-all outline-none appearance-none cursor-pointer"
                        value={formData.category_id}
                        onChange={(e) => {
                          const catId = e.target.value;
                          const selectedCat = categories.find(c => c.id === catId);
                          setFormData({ 
                            ...formData, 
                            category_id: catId,
                            category: (selectedCat?.name || '') as Category
                          });
                        }}
                        required
                      >
                        <option value="" disabled>Select category</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="imageUrl" className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">
                      {formData.image_url ? 'Validated Image URL' : 'Image (Upload or URL)'}
                    </label>
                    
                    {/* Visual Preview */}
                    {formData.image_url && isValidPreviewUrl(formData.image_url) && (
                      <div className="mb-4 relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-50 border-2 border-slate-100 group">
                        <Image 
                          src={formData.image_url} 
                          alt="Preview" 
                          fill 
                          className="object-cover" 
                          unoptimized
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                           <p className="text-white text-xs font-bold uppercase tracking-widest">Live Preview</p>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <div className="relative flex-1 group/input">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/input:text-orange-500 transition-colors">
                          <ImageIcon size={20} />
                        </div>
                        <input
                          id="imageUrl"
                          type="url"
                          placeholder="Paste URL or use upload..."
                          className="w-full bg-slate-50 border-0 rounded-2xl py-4 pl-12 pr-4 text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-orange-500 transition-all outline-none text-sm"
                          value={formData.image_url}
                          onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                          required
                        />
                        {isGalleryUrl(formData.image_url) && (
                          <motion.p 
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mt-2 px-1"
                          >
                            ⚠️ Warning: This looks like a gallery page, not a direct image. Next.js may not render it.
                          </motion.p>
                        )}
                      </div>
                      
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        className="hidden" 
                        accept="image/*"
                        onChange={handleFileChange}
                      />
                      
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadLoading}
                        className="flex items-center justify-center aspect-square h-[56px] bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50"
                        title="Upload from computer"
                      >
                        {uploadLoading ? <Loader2 className="animate-spin" size={20} /> : <Plus size={24} />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 py-4 px-6 bg-slate-50 text-slate-500 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-100 transition-all border border-slate-100"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={loading === 'modal'}
                      className="flex-[2] py-4 px-6 bg-primary text-white rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/30 flex items-center justify-center gap-2"
                    >
                      {loading === 'modal' ? (
                        <Loader2 className="animate-spin" size={20} />
                      ) : (
                        modalMode === 'add' ? 'Create Dish' : 'Save Changes'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
