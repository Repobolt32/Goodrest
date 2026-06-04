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

  // Bar color states: Zomato green (maxed) → Zomato gold (tier2)
  const barColor = maxed
    ? 'bg-[#3AB757] shadow-[#3AB757]/40'
    : tier2
      ? 'bg-[#F3C117] shadow-[#F3C117]/40'
      : 'bg-[#F3C117]/80 shadow-[#F3C117]/20';

  const trackColor = 'bg-[#1C1C1C]';
  const target = maxed ? 10 : nextMilestone!;
  const filled = maxed
    ? 10
    : nextMilestone === 10
      ? 6 + (todayDeliveries - 6)
      : todayDeliveries;
  const displayProgress = Math.min(progress, 1);

  return (
    <div className="bg-[#252525] border border-[#363636] rounded-2xl p-4 mb-8">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-[#9C9C9C] normal-case tracking-wide">
          🏆 Nightly Bonus
        </span>
        <span className="text-xs font-medium text-[#9C9C9C]">
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
      <p className={`text-xs font-medium mt-2 ${maxed ? 'text-[#3AB757]' : 'text-[#9C9C9C]'}`}>
        {label}
      </p>

      {/* Show earned badge if tier 2+ */}
      {currentBonus > 0 && (
        <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#3AB757]/10 border border-[#3AB757]/20">
          <span className="text-xs font-medium text-[#3AB757] normal-case tracking-wide">
            ₹{currentBonus} earned
          </span>
        </div>
      )}
    </div>
  );
}