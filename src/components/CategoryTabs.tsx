"use client";

import { Category } from '@/types/menu';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CATEGORIES: (Category | 'All')[] = ['All', 'Starters', 'Main Course', 'Breads', 'Rice', 'Beverages', 'Desserts'];

interface CategoryTabsProps {
  activeCategory: Category | 'All';
  onSelect: (category: Category | 'All') => void;
}

export default function CategoryTabs({ activeCategory, onSelect }: CategoryTabsProps) {
  return (
    <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md py-4 px-4 -mx-4 overflow-x-auto hide-scrollbar flex gap-3 shadow-sm border-b">
      {CATEGORIES.map((category) => (
        <button
          key={category}
          onClick={() => onSelect(category)}
          className={cn(
            "px-6 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200",
            activeCategory === category
              ? "bg-primary text-white shadow-lg shadow-primary/30"
              : "bg-surface-muted text-gray-600 hover:bg-gray-100"
          )}
        >
          {category}
        </button>
      ))}
    </div>
  );
}
