"use client";

import { MenuItem } from '@/types/menu';
import { Plus, Minus, Star } from 'lucide-react';
import Image from 'next/image';
import { motion } from 'framer-motion';

interface MenuItemCardProps {
  item: MenuItem;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
}

export default function MenuItemCard({ item, quantity, onAdd, onRemove }: MenuItemCardProps) {
  const isRecommended = item.tags.includes('Recommended') || item.tags.includes('Most Ordered');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bento-card relative bg-white rounded-bento overflow-hidden border border-gray-100 flex flex-col h-full"
    >
      {item.image_url && (
        <div className="relative aspect-video w-full">
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            className="object-cover"
          />
          {isRecommended && (
            <div className="absolute top-3 left-3 bg-accent text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-lg backdrop-blur-sm bg-opacity-90">
              <Star size={10} fill="white" />
              Featured
            </div>
          )}
        </div>
      )}

      <div className="p-4 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-1">
          <h3 className="font-bold text-lg leading-tight text-gray-900">{item.name}</h3>
        </div>
        <p className="text-gray-500 text-sm mb-4 line-clamp-2">{item.category}</p>

        <div className="mt-auto flex items-center justify-between">
          <span className="text-xl font-black text-primary">₹{item.price}</span>
          
          <div className="flex items-center bg-gray-50 rounded-full p-1 border border-gray-100 shadow-inner">
            {quantity > 0 ? (
              <>
                <button
                  onClick={onRemove}
                  className="p-2 hover:bg-white rounded-full text-gray-500 transition-colors shadow-sm"
                >
                  <Minus size={16} />
                </button>
                <span className="w-8 text-center font-bold text-gray-900">{quantity}</span>
                <button
                  onClick={onAdd}
                  className="p-2 bg-primary text-white rounded-full shadow-md hover:bg-primary-dark transition-colors"
                >
                  <Plus size={16} />
                </button>
              </>
            ) : (
              <button
                onClick={onAdd}
                className="px-6 py-2 bg-primary text-white rounded-full text-sm font-bold shadow-md hover:bg-primary-dark transition-all active:scale-95"
              >
                Add
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
