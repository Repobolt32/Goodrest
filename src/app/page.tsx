"use client";

import { useState } from 'react';
import { useMenu } from '@/hooks/useMenu';
import { useCart } from '@/hooks/useCart';
import { Category } from '@/types/menu';
import CategoryTabs from '@/components/CategoryTabs';
import MenuItemCard from '@/components/MenuItemCard';
import FloatingCart from '@/components/FloatingCart';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '@/components/Header';

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All');
  const { menuItems, categories, loading } = useMenu(activeCategory);
  const { items, addToCart, removeFromCart, totalItems, totalPrice } = useCart();

  const getQuantity = (id: string) => {
    return items.find((i) => i.id === id)?.quantity || 0;
  };

  return (
    <div className="min-h-screen pb-32">
      <Header />

      {/* Categories */}
      <div className="mx-6">
        <CategoryTabs 
          categories={categories}
          activeCategory={activeCategory} 
          onSelect={setActiveCategory} 
        />
      </div>

      {/* Menu Grid */}
      <main className="px-6 py-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-bento h-64 animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : (
          <motion.div
            layout
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <AnimatePresence mode="popLayout">
              {menuItems.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  quantity={getQuantity(item.id)}
                  onAdd={() => addToCart(item)}
                  onRemove={() => removeFromCart(item.id)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {!loading && menuItems.length === 0 && (
          <div className="text-center py-20 px-8">
            <p className="text-xl font-bold text-gray-400">No dishes found in this category.</p>
          </div>
        )}
      </main>

      {/* Floating Cart */}
      <FloatingCart totalItems={totalItems} totalPrice={totalPrice} />
    </div>
  );
}
