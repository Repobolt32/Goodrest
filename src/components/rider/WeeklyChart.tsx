'use client';

import { useState } from 'react';

interface DayData {
  date: string;
  deliveries: number;
  total: number;
  bonus: number;
}

interface WeeklyChartProps {
  data: DayData[];
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function WeeklyChart({ data }: WeeklyChartProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const maxVal = Math.max(...data.map(d => d.total), 1);
  const chartHeight = 160;
  const barWidth = 28;
  const gap = 12;
  const totalWidth = data.length * (barWidth + gap) - gap;
  const paddingTop = 30;
  const paddingBottom = 24;
  const svgHeight = chartHeight + paddingTop + paddingBottom;

  return (
    <div className="glass-card p-5 border-slate-800/50 mb-6">
      <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4">
        📊 This Week
      </h3>

      <div className="flex justify-center overflow-x-auto">
        <svg
          width={totalWidth + 20}
          height={svgHeight}
          viewBox={`0 0 ${totalWidth + 20} ${svgHeight}`}
          className="mx-auto"
        >
          {data.map((day, i) => {
            const barHeight = maxVal > 0 ? (day.total / maxVal) * chartHeight : 0;
            const x = 10 + i * (barWidth + gap);
            const y = paddingTop + chartHeight - barHeight;
            const isActive = activeIdx === i;
            const isToday = i === data.length - 1 || (new Date().getDay() === 0 ? i === 6 : i === new Date().getDay() - 1);

            return (
              <g key={day.date} onPointerEnter={() => setActiveIdx(i)} onPointerLeave={() => setActiveIdx(null)}>
                {/* Bar */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(barHeight, 2)}
                  rx={6}
                  fill={day.total > 0 ? (isToday ? 'url(#barGradientToday)' : 'url(#barGradient)') : '#1e293b'}
                  className="transition-all duration-300"
                  opacity={isActive ? 1 : 0.85}
                />

                {/* Day label */}
                <text
                  x={x + barWidth / 2}
                  y={svgHeight - 4}
                  textAnchor="middle"
                  className="fill-slate-500 text-[10px] font-bold"
                >
                  {DAY_LABELS[i]}
                </text>

                {/* Amount on top */}
                {day.total > 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={y - 6}
                    textAnchor="middle"
                    className={`text-[9px] font-black ${isActive ? 'fill-white' : 'fill-slate-500'}`}
                  >
                    ₹{day.total}
                  </text>
                )}

                {/* Tooltip on hover */}
                {isActive && day.total > 0 && (
                  <foreignObject x={x - 40} y={y - 52} width={110} height={40}>
                    <div className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-center shadow-xl">
                      <p className="text-[9px] text-white font-bold">{formatCurrency(day.total)} · {day.deliveries} orders</p>
                      {day.bonus > 0 && (
                        <p className="text-[8px] text-emerald-400 font-bold">+₹{day.bonus} bonus</p>
                      )}
                    </div>
                  </foreignObject>
                )}
              </g>
            );
          })}

          {/* Gradients */}
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
            </linearGradient>
            <linearGradient id="barGradientToday" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6ee7b7" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}