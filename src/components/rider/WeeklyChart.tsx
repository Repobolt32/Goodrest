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
    <div className="bg-[#252525] border border-[#363636] rounded-2xl p-5 mb-6">
      <h3 className="text-sm font-semibold text-[#9C9C9C] normal-case tracking-wide mb-4">
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
                  fill={day.total > 0 ? (isToday ? 'url(#barGradientToday)' : 'url(#barGradient)') : '#2C2C2C'}
                  className="transition-all duration-300"
                  opacity={isActive ? 1 : 0.85}
                />

                {/* Day label */}
                <text
                  x={x + barWidth / 2}
                  y={svgHeight - 4}
                  textAnchor="middle"
                  className="fill-[#9C9C9C] text-xs font-medium"
                >
                  {DAY_LABELS[i]}
                </text>

                {/* Amount on top */}
                {day.total > 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={y - 6}
                    textAnchor="middle"
                    className={`text-xs font-medium ${isActive ? 'fill-white' : 'fill-[#9C9C9C]'}`}
                  >
                    ₹{day.total}
                  </text>
                )}

                {/* Tooltip on hover */}
                {isActive && day.total > 0 && (
                  <foreignObject x={x - 40} y={y - 58} width={110} height={48}>
                    <div className="bg-[#2C2C2C] border border-[#363636] rounded-xl px-2 py-1 text-center shadow-xl">
                      <p className="text-xs text-white font-medium">{formatCurrency(day.total)} · {day.deliveries} orders</p>
                      {day.bonus > 0 && (
                        <p className="text-xs text-[#3AB757] font-medium">+₹{day.bonus} bonus</p>
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
              <stop offset="0%" stopColor="#3AB757" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#2b9241" stopOpacity={0.7} />
            </linearGradient>
            <linearGradient id="barGradientToday" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4edb6c" />
              <stop offset="100%" stopColor="#3AB757" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}