'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { Search } from 'lucide-react';

function SearchInput() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Local state for search input to ensure zero-lag typing
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');

  // 1. Sync local state when URL changes externally (e.g. clicking navigation link)
  useEffect(() => {
    const q = searchParams.get('q') || '';
    if (q !== searchQuery) {
      setSearchQuery(q);
    }
  }, [searchParams]);

  // 2. Debounced search update to URL
  useEffect(() => {
    // If query matches current URL, don't trigger another navigation
    const currentQ = searchParams.get('q') || '';
    if (searchQuery === currentQ) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (searchQuery) {
        params.set('q', searchQuery);
      } else {
        params.delete('q');
      }
      // Use replace instead of push to avoid cluttering history
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, pathname, router, searchParams]);

  return (
    <div className="relative w-full max-w-md hidden md:block">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
      <input 
        type="text" 
        placeholder="Search phone number or customer..." 
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full pl-12 pr-4 py-2.5 bg-slate-50/50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-primary/10 focus:border-primary/30 transition-all outline-none text-sm font-medium"
      />
    </div>
  );
}

export default function AdminSearchBar() {
  return (
    <Suspense fallback={
      <div className="relative w-full max-w-md hidden md:block animate-pulse">
        <div className="w-full h-10 bg-slate-100 rounded-xl" />
      </div>
    }>
      <SearchInput />
    </Suspense>
  );
}
