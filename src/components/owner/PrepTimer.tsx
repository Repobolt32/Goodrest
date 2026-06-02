'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

export default function PrepTimer({ prepDeadline }: { prepDeadline: string }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const deadline = new Date(prepDeadline).getTime();
      const diff = deadline - now;

      if (diff <= 0) {
        setRemaining('00:00');
        return;
      }

      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRemaining(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [prepDeadline]);

  const isUrgent = remaining && parseInt(remaining) < 5;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest border ${isUrgent ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
      <Clock size={14} />
      {remaining || '--:--'}
    </div>
  );
}
