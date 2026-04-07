"use client";

import { useState } from 'react';
import { MenuItem } from '@/types/menu';
import { Plus, Minus, Star, ImageOff } from 'lucide-react';
import Image from 'next/image';
import { motion } from 'framer-motion';

interface MenuItemCardProps {
  item: MenuItem;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
}

export default function MenuItemCard({ item, quantity, onAdd, onRemove }: MenuItemCardProps) {
  // Logic derivations based on feedback (UI only, no DB change)
  const isBestseller = item.tags.includes('Recommended') || item.tags.includes('Most Ordered');
  const isChicken = item.name.toLowerCase().includes('chicken');
  const showOrderCount = isChicken; // Example: only show for chicken items as per feedback

  const [imgError, setImgError] = useState(false);
  
  // Simple Veg/Non-Veg logic
  const isVeg = item.category.toLowerCase().includes('veg') || 
                ['paneer', 'gobi', 'veg', 'naan', 'soda'].some(term => item.name.toLowerCase().includes(term));

  return (
    <motion.div
      layout
      whileHover={{ 
        scale: 1.04, 
        boxShadow: "0 25px 40px -10px rgba(0,0,0,0.15)",
        filter: "brightness(1.05)"
      }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="bento-card relative bg-white rounded-bento overflow-hidden border-2 border-gray-100 flex flex-col h-full group"
    >
      {/* Image Container */}
      {item.image_url && (
        <div className="relative aspect-[4/3] w-full bg-gray-50 overflow-hidden">
          {!imgError ? (
            <Image
              src={item.image_url}
              alt={item.name}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-110"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              unoptimized={true}
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 text-slate-300">
               <ImageOff size={40} strokeWidth={1} />
               <span className="text-[10px] uppercase tracking-widest font-black mt-2">Image Not Available</span>
            </div>
          )}
          
          {/* Rating Badge (Top Left) - No transparency/Solid background */}
          <div className="absolute top-4 left-4 flex flex-col gap-2">
            <div className="bg-white text-gray-900 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-xl border-2 border-slate-100">
              <Star size={12} className="text-yellow-500 fill-yellow-500" aria-hidden="true" />
              4.1
            </div>
            
            {/* Bestseller Tag (Replacing Featured) */}
            {isBestseller && (
              <div className="bg-primary text-white px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.1em] flex items-center gap-1.5 shadow-xl">
                <span role="img" aria-label="Bestseller Logo">🔥</span>
                Bestseller
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="p-5 flex flex-col flex-grow">
        <div className="flex items-start gap-2 mb-1">
          {/* Veg/Non-Veg Indicator */}
          <div className={`mt-1.5 w-3 h-3 rounded-sm border-[1px] ${isVeg ? 'border-green-600' : 'border-red-600'} flex items-center justify-center`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isVeg ? 'bg-green-600' : 'bg-red-600'}`} />
          </div>
          
          <div className="flex flex-col">
            <h3 className="font-semibold text-lg leading-tight text-gray-900 tracking-tight" style={{ textWrap: 'balance' }}>
              {item.name}
            </h3>
            {/* Social Proof / Order Count (Selective) */}
            {showOrderCount && (
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-1">
                120+ orders this week
              </p>
            )}
            <p className="text-gray-400 text-[10px] font-medium mt-1 uppercase tracking-wider">{item.category}</p>
          </div>
        </div>

        {/* Action Row */}
        <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-50">
          <span className="text-2xl font-bold text-gray-900 tracking-tighter">
            Rs {item.price}
          </span>
          
          <div className="flex items-center min-w-[100px] justify-end">
            {quantity > 0 ? (
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center bg-gray-50 rounded-2xl p-1 border-2 border-gray-200 shadow-inner overflow-hidden"
              >
                <button
                  onClick={onRemove}
                  aria-label={`Remove one ${item.name}`}
                  className="p-2 hover:bg-white rounded-xl text-gray-900 transition-colors shadow-sm"
                >
                  <Minus size={18} strokeWidth={3} aria-hidden="true" />
                </button>
                <span className="w-10 text-center font-bold text-lg text-gray-900" aria-label={`Quantity: ${quantity}`}>{quantity}</span>
                <button
                  onClick={onAdd}
                  aria-label={`Add one more ${item.name}`}
                  className="p-2 bg-primary text-white rounded-xl shadow-lg hover:shadow-primary/30 transition-all hover:scale-105"
                >
                  <Plus size={18} strokeWidth={3} aria-hidden="true" />
                </button>
              </motion.div>
            ) : (
              <button
                onClick={onAdd}
                aria-label={`Add ${item.name} to cart`}
                className="btn-strong px-8 py-3 bg-primary text-white rounded-2xl text-[15px] font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                style={{ letterSpacing: "0.5px" }}
              >
                Add <Plus size={16} strokeWidth={3} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
