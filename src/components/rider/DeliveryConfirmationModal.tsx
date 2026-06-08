'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';

interface ActiveOrder {
  id: string;
  friendly_id: string | null;
  customer_name: string;
  delivery_address: string;
  distance_km: number | null;
  rider_earning: number | null;
}

interface DeliveryConfirmationModalProps {
  order: ActiveOrder;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<{ success: boolean; error?: string }>;
}

export default function DeliveryConfirmationModal({
  order,
  isOpen,
  onClose,
  onConfirm,
}: DeliveryConfirmationModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (loading) return; // Only first tap counts
    setLoading(true);
    setError(null);
    try {
      const res = await onConfirm();
      if (res.success) {
        onClose();
      } else {
        setError(res.error || 'Failed to complete delivery. Please try again.');
      }
    } catch {
      setError('A network or server error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const orderNum = order.friendly_id || order.id.slice(0, 8);

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {/* Glow Effect Background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-[#3AB757]/10 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="bg-[#252525] border border-[#363636] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative z-10"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#363636]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#3AB757]/10 rounded-lg flex items-center justify-center text-[#3AB757]">
              <ShieldCheck size={18} />
            </div>
            <h3 className="text-base font-bold text-white tracking-wide">Confirm Delivery</h3>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1 text-[#696969] hover:text-white transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-[#9C9C9C] text-xs font-medium leading-relaxed">
            Please verify the order details below before marking it as delivered. Once confirmed, you will lose access to this order.
          </p>

          {/* Details Table */}
          <div className="bg-[#1C1C1C] border border-[#363636] rounded-2xl p-4 space-y-3.5">
            <div className="flex justify-between items-center text-xs border-b border-[#363636]/40 pb-2">
              <span className="text-[#9C9C9C] font-medium">Order Number</span>
              <span className="text-white font-bold">#{orderNum}</span>
            </div>
            <div className="flex justify-between items-center text-xs border-b border-[#363636]/40 pb-2">
              <span className="text-[#9C9C9C] font-medium">Customer Name</span>
              <span className="text-white font-bold">{order.customer_name || 'Guest'}</span>
            </div>
            <div className="flex justify-between items-start text-xs border-b border-[#363636]/40 pb-2 gap-4">
              <span className="text-[#9C9C9C] font-medium shrink-0">Address</span>
              <span className="text-white font-bold text-right leading-normal">{order.delivery_address || 'No address'}</span>
            </div>
            <div className="flex justify-between items-center text-xs border-b border-[#363636]/40 pb-2">
              <span className="text-[#9C9C9C] font-medium">Distance</span>
              <span className="text-white font-bold">{order.distance_km != null ? `${order.distance_km} km` : '—'}</span>
            </div>
            <div className="flex justify-between items-center text-xs pt-1">
              <span className="text-[#9C9C9C] font-medium">Rider Earning</span>
              <span className="text-[#3AB757] text-sm font-black">₹{order.rider_earning ?? 0}</span>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2.5 text-xs text-red-400 font-bold leading-normal">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-[#363636] flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3.5 bg-[#252525] border border-[#363636] text-[#9C9C9C] hover:text-white transition-colors rounded-xl font-bold text-xs uppercase tracking-wider disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 py-3.5 bg-[#3AB757] hover:bg-[#2b9241] text-white transition-colors rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle size={16} /> Yes, Delivered
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
