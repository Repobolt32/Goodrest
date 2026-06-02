'use client';

interface BonusProgressProps {
  todayDeliveries: number;
  currentBonus: number;
  nextMilestone: number | null;
  deliveriesUntilNext: number;
  progress: number;
  label: string;
}

export default function BonusProgress({
  todayDeliveries,
  currentBonus,
  nextMilestone,
  progress,
  label,
}: BonusProgressProps) {
  const maxed = nextMilestone === null;
  const tier2 = currentBonus >= 100 && !maxed;

  // Bar color states: amber (tier1) → gold (tier2) → emerald (maxed)
  const barColor = maxed
    ? 'bg-emerald-500 shadow-emerald-500/40'
    : tier2
      ? 'bg-amber-400 shadow-amber-400/40'
      : 'bg-amber-500/80 shadow-amber-500/20';

  const trackColor = 'bg-slate-800';
  const target = maxed ? 10 : nextMilestone!;
  const filled = maxed
    ? 10
    : nextMilestone === 10
      ? 6 + (todayDeliveries - 6)
      : todayDeliveries;
  const displayProgress = Math.min(progress, 1);

  return (
    <div className="glass-card p-4 border-slate-800/50 mb-8">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
          🏆 Nightly Bonus
        </span>
        <span className="text-[10px] font-black text-slate-400">
          {filled}/{target} deliveries
        </span>
      </div>

      {/* Progress Bar */}
      <div className={`w-full h-3 rounded-full ${trackColor} overflow-hidden`}>
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor} ${maxed ? 'shadow-lg animate-pulse' : 'shadow-md'}`}
          style={{ width: `${displayProgress * 100}%` }}
        />
      </div>

      {/* Label */}
      <p className={`text-xs font-bold mt-2 ${maxed ? 'text-emerald-400' : 'text-slate-400'}`}>
        {label}
      </p>

      {/* Show earned badge if tier 2+ */}
      {currentBonus > 0 && (
        <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
            ₹{currentBonus} earned
          </span>
        </div>
      )}
    </div>
  );
}