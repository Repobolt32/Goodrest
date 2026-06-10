'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Plus,
  Tag,
  Percent,
  Truck,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  Loader2,
  Clock,
  Zap,
} from 'lucide-react';
import {
  createOffer,
  updateOffer,
  toggleOffer,
  deleteOffer,
} from '@/app/actions/offerActions';
import { Database } from '@/types/database.types';
import { Json } from '@/types/database.types';

type Offer = Database['public']['Tables']['offers']['Row'];

interface OfferFormData {
  type: 'discount_percent' | 'free_delivery';
  label: string;
  active: boolean;
  start_time: string;
  end_time: string;
  // discount_percent config
  percent: string;
  max_amount: string;
  // free_delivery config
  threshold: string;
}

const initialFormData: OfferFormData = {
  type: 'discount_percent',
  label: '',
  active: true,
  start_time: '',
  end_time: '',
  percent: '',
  max_amount: '',
  threshold: '',
};

function formatConfigSummary(offer: Offer): string {
  if (offer.type === 'discount_percent') {
    const config = offer.config as Record<string, unknown>;
    const percent = config.percent ?? 0;
    const maxAmount = config.max_amount;
    return maxAmount ? `${percent}% off (capped at ₹${maxAmount})` : `${percent}% off`;
  }
  if (offer.type === 'free_delivery') {
    const config = offer.config as Record<string, unknown>;
    const threshold = config.threshold ?? 0;
    return `Free delivery on ₹${threshold}+`;
  }
  return offer.label || 'Custom offer';
}

function isExpired(offer: Offer): boolean {
  if (offer.end_time && new Date(offer.end_time) < new Date()) return true;
  if (offer.start_time && new Date(offer.start_time) > new Date()) return true;
  return false;
}

function formatTimeWindow(start: string | null, end: string | null): string {
  if (!start && !end) return 'Always active';
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  return `Until ${fmt(end!)}`;
}

export default function OfferManager({ initialOffers }: { initialOffers: Offer[] }) {
  const [offers, setOffers] = useState<Offer[]>(initialOffers);
  const [loading, setLoading] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [formData, setFormData] = useState<OfferFormData>(initialFormData);
  const [formLoading, setFormLoading] = useState(false);

  const resetForm = () => {
    setFormData(initialFormData);
    setSelectedOffer(null);
  };

  const handleOpenAddModal = () => {
    setModalMode('add');
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (offer: Offer) => {
    setModalMode('edit');
    setSelectedOffer(offer);
    const config = offer.config as Record<string, unknown>;
    setFormData({
      type: offer.type as 'discount_percent' | 'free_delivery',
      label: offer.label || '',
      active: offer.active,
      start_time: offer.start_time ? offer.start_time.slice(0, 16) : '',
      end_time: offer.end_time ? offer.end_time.slice(0, 16) : '',
      percent: config.percent?.toString() || '',
      max_amount: config.max_amount?.toString() || '',
      threshold: config.threshold?.toString() || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    let config: Json = {};
    if (formData.type === 'discount_percent') {
      config = { percent: parseFloat(formData.percent) || 0 };
      if (formData.max_amount) config.max_amount = parseFloat(formData.max_amount);
    } else {
      config = { threshold: parseFloat(formData.threshold) || 0 };
    }

    const input = {
      type: formData.type,
      label: formData.label || undefined,
      config,
      active: formData.active,
      start_time: formData.start_time || null,
      end_time: formData.end_time || null,
    };

    let result;
    if (modalMode === 'add') {
      result = await createOffer(input);
    } else if (selectedOffer) {
      result = await updateOffer(selectedOffer.id, input);
    }

    if (result?.success && result.data) {
      if (modalMode === 'add') {
        setOffers(prev => [result.data as Offer, ...prev]);
      } else if (selectedOffer) {
        setOffers(prev => prev.map(o => o.id === selectedOffer.id ? { ...o, ...result.data } as Offer : o));
      }
      setIsModalOpen(false);
      resetForm();
    } else {
      alert('Error: ' + result?.error);
    }
    setFormLoading(false);
  };

  const handleToggle = async (id: string, currentActive: boolean) => {
    setLoading(id);
    setOffers(prev => prev.map(o => o.id === id ? { ...o, active: !currentActive } : o));

    const result = await toggleOffer(id, !currentActive);
    if (!result.success) {
      setOffers(prev => prev.map(o => o.id === id ? { ...o, active: currentActive } : o));
      alert('Failed to toggle: ' + result.error);
    }
    setLoading(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this offer?')) return;

    setLoading(id);
    const result = await deleteOffer(id);
    if (result.success) {
      setOffers(prev => prev.filter(o => o.id !== id));
    } else {
      alert('Error: ' + result.error);
    }
    setLoading(null);
  };

  const discountOffers = offers.filter(o => o.type === 'discount_percent');
  const freeDeliveryOffers = offers.filter(o => o.type === 'free_delivery');

  return (
    <div className="space-y-12 pb-32">
      {/* Header */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-5 md:p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="relative z-10">
            <h1 className="text-2xl font-black text-slate-900 mb-1 uppercase tracking-tight">Offers &amp; Promotions</h1>
            <p className="text-slate-500 font-medium tracking-wide text-sm md:text-base">Manage discounts and free delivery offers</p>
          </div>
          <button
            onClick={handleOpenAddModal}
            className="flex items-center justify-center gap-2 bg-primary text-white px-6 py-4 md:py-3 rounded-2xl font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20"
          >
            <Plus size={20} /> Add Offer
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={16} className="text-primary" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total</span>
            </div>
            <p className="text-2xl font-black text-slate-900">{offers.length}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Eye size={16} className="text-green-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Active</span>
            </div>
            <p className="text-2xl font-black text-green-600">{offers.filter(o => o.active).length}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Percent size={16} className="text-blue-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Discounts</span>
            </div>
            <p className="text-2xl font-black text-blue-600">{discountOffers.length}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Truck size={16} className="text-emerald-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Free Delivery</span>
            </div>
            <p className="text-2xl font-black text-emerald-600">{freeDeliveryOffers.length}</p>
          </div>
        </div>
      </div>

      {/* Offers List */}
      {offers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-12 text-center">
          <Tag size={48} strokeWidth={1} className="text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-black text-slate-400 uppercase tracking-widest mb-2">No offers yet</h3>
          <p className="text-sm text-slate-400 mb-6">Create your first offer to attract customers</p>
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition-all"
          >
            <Plus size={18} /> Create Offer
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <AnimatePresence>
            {offers.map((offer) => (
              <motion.div
                key={offer.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                className={`bg-white rounded-3xl border shadow-sm p-5 md:p-6 relative overflow-hidden group transition-all ${isExpired(offer)
                    ? 'border-slate-200 opacity-60'
                    : offer.active
                      ? 'border-green-200 hover:shadow-lg hover:shadow-green-50'
                      : 'border-slate-100'
                  }`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${offer.type === 'discount_percent'
                      ? 'bg-blue-50 text-blue-500'
                      : 'bg-emerald-50 text-emerald-500'
                    }`}>
                    {offer.type === 'discount_percent' ? <Percent size={22} /> : <Truck size={22} />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-black text-slate-900 text-lg leading-tight">
                          {offer.label || formatConfigSummary(offer)}
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">{formatConfigSummary(offer)}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleToggle(offer.id, offer.active)}
                          disabled={loading === offer.id}
                          className={`p-2 rounded-xl transition-all ${offer.active
                              ? 'bg-green-50 text-green-600 hover:bg-green-100'
                              : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                            }`}
                          aria-label={offer.active ? 'Deactivate offer' : 'Activate offer'}
                          title={offer.active ? 'Active' : 'Inactive'}
                        >
                          {offer.active ? <Eye size={18} /> : <EyeOff size={18} />}
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(offer)}
                          className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                          aria-label="Edit offer"
                          title="Edit"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(offer.id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          aria-label="Delete offer"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${offer.active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-500'
                        }`}>
                        {offer.active ? 'Active' : 'Inactive'}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">
                        {offer.type === 'discount_percent' ? 'Discount' : 'Free Delivery'}
                      </span>
                      {isExpired(offer) && (
                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-red-100 text-red-600">
                          Expired
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                        <Clock size={10} /> {formatTimeWindow(offer.start_time, offer.end_time)}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4">
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
              className="bg-white w-full h-full md:h-auto md:max-w-lg md:rounded-[2.5rem] shadow-2xl relative z-10 overflow-auto md:overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">
                      {modalMode === 'add' ? 'Create Offer' : 'Edit Offer'}
                    </h2>
                    <p className="text-slate-500 text-sm">Configure your promotion</p>
                  </div>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Offer Type */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">
                      Offer Type
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, type: 'discount_percent' })}
                        className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${formData.type === 'discount_percent'
                            ? 'border-primary bg-primary/5'
                            : 'border-slate-100 hover:border-slate-200'
                          }`}
                      >
                        <Percent size={20} className={formData.type === 'discount_percent' ? 'text-primary' : 'text-slate-400'} />
                        <span className={`font-bold text-sm ${formData.type === 'discount_percent' ? 'text-primary' : 'text-slate-600'}`}>
                          Discount %
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, type: 'free_delivery' })}
                        className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${formData.type === 'free_delivery'
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-slate-100 hover:border-slate-200'
                          }`}
                      >
                        <Truck size={20} className={formData.type === 'free_delivery' ? 'text-emerald-500' : 'text-slate-400'} />
                        <span className={`font-bold text-sm ${formData.type === 'free_delivery' ? 'text-emerald-600' : 'text-slate-600'}`}>
                          Free Delivery
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Type-specific config */}
                  {formData.type === 'discount_percent' ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="discountPercent" className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">
                          Discount %
                        </label>
                        <div className="relative">
                          <input
                            id="discountPercent"
                            type="number"
                            min="1"
                            max="100"
                            placeholder="e.g. 10"
                            className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-primary transition-all outline-none"
                            value={formData.percent}
                            onChange={(e) => setFormData({ ...formData, percent: e.target.value })}
                            required
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                        </div>
                      </div>
                      <div>
                        <label htmlFor="maxAmount" className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">
                          Max Amount (₹)
                        </label>
                        <div className="relative">
                          <input
                            id="maxAmount"
                            type="number"
                            min="0"
                            placeholder="No cap"
                            className="w-full bg-slate-50 border-0 rounded-2xl p-4 pl-8 text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-primary transition-all outline-none"
                            value={formData.max_amount}
                            onChange={(e) => setFormData({ ...formData, max_amount: e.target.value })}
                          />
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="threshold" className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">
                        Minimum Order (₹)
                      </label>
                      <div className="relative">
                        <input
                          id="threshold"
                          type="number"
                          min="0"
                          placeholder="e.g. 200"
                          className="w-full bg-slate-50 border-0 rounded-2xl p-4 pl-8 text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-primary transition-all outline-none"
                          value={formData.threshold}
                          onChange={(e) => setFormData({ ...formData, threshold: e.target.value })}
                          required
                        />
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                      </div>
                    </div>
                  )}

                  {/* Label */}
                  <div>
                    <label htmlFor="offerLabel" className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">
                      Label (optional)
                    </label>
                    <input
                      id="offerLabel"
                      type="text"
                      placeholder="Auto-generated from config"
                      className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-primary transition-all outline-none"
                      value={formData.label}
                      onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    />
                  </div>

                  {/* Active Toggle */}
                  <div className="flex items-center justify-between bg-slate-50 rounded-2xl p-4">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">Active</p>
                      <p className="text-xs text-slate-500">Offer will be applied at checkout</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, active: !formData.active })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${formData.active ? 'bg-green-500' : 'bg-slate-300'}`}
                    >
                      <motion.div
                        animate={{ x: formData.active ? 26 : 2 }}
                        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                      />
                    </button>
                  </div>

                  {/* Time Window */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="startTime" className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">
                        Start Time
                      </label>
                      <input
                        id="startTime"
                        type="datetime-local"
                        className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-slate-900 focus:ring-2 focus:ring-primary transition-all outline-none text-sm"
                        value={formData.start_time}
                        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      />
                    </div>
                    <div>
                      <label htmlFor="endTime" className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">
                        End Time
                      </label>
                      <input
                        id="endTime"
                        type="datetime-local"
                        className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-slate-900 focus:ring-2 focus:ring-primary transition-all outline-none text-sm"
                        value={formData.end_time}
                        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 -mt-3 px-1">
                    Leave empty for no time restriction
                  </p>

                  {/* Submit */}
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
                      disabled={formLoading}
                      className="flex-[2] py-4 px-6 bg-primary text-white rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/30 flex items-center justify-center gap-2"
                    >
                      {formLoading ? (
                        <Loader2 className="animate-spin" size={20} />
                      ) : (
                        modalMode === 'add' ? 'Create Offer' : 'Save Changes'
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
