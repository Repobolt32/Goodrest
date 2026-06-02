import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WeeklyChart from './WeeklyChart';

vi.mock('framer-motion', () => ({
  motion: { div: 'div', button: 'button', p: 'p', span: 'span', section: 'section' },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

const sevenDaysData = [
  { date: '2026-05-25', deliveries: 0, total: 0, bonus: 0 },
  { date: '2026-05-26', deliveries: 3, total: 150, bonus: 0 },
  { date: '2026-05-27', deliveries: 0, total: 0, bonus: 0 },
  { date: '2026-05-28', deliveries: 5, total: 300, bonus: 0 },
  { date: '2026-05-29', deliveries: 6, total: 450, bonus: 100 },
  { date: '2026-05-30', deliveries: 8, total: 700, bonus: 100 },
  { date: '2026-05-31', deliveries: 10, total: 950, bonus: 200 },
];

describe('WeeklyChart', () => {
  it('should render the chart with title', () => {
    render(<WeeklyChart data={sevenDaysData} />);
    expect(screen.getByText('📊 This Week')).toBeInTheDocument();
  });

  it('should render SVG with 7 bars', () => {
    const { container } = render(<WeeklyChart data={sevenDaysData} />);
    // Each day is a <rect> element
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBe(7);
  });

  it('should render day labels Mon-Sun', () => {
    render(<WeeklyChart data={sevenDaysData} />);
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(day => {
      expect(screen.getByText(day)).toBeInTheDocument();
    });
  });

  it('should render amounts above bars for days with total > 0', () => {
    render(<WeeklyChart data={sevenDaysData} />);
    expect(screen.getByText('₹150')).toBeInTheDocument();
    expect(screen.getByText('₹300')).toBeInTheDocument();
    expect(screen.getByText('₹450')).toBeInTheDocument();
    expect(screen.getByText('₹700')).toBeInTheDocument();
    expect(screen.getByText('₹950')).toBeInTheDocument();
  });

  it('should not render amount for zero-value days', () => {
    render(<WeeklyChart data={sevenDaysData} />);
    // Days 1 and 3 have 0 total, so no amount text above
    expect(screen.queryByText('₹0')).not.toBeInTheDocument();
  });

  it('should show tooltip on hover', () => {
    const { container } = render(<WeeklyChart data={sevenDaysData} />);

    // Hover over second bar (index 1, has data)
    const bars = container.querySelectorAll('g');
    fireEvent.pointerEnter(bars[1]);

    expect(screen.getByText(/3 orders/)).toBeInTheDocument();
  });

  it('should show bonus in tooltip when bonus > 0', () => {
    const { container } = render(<WeeklyChart data={sevenDaysData} />);

    const bars = container.querySelectorAll('g');
    fireEvent.pointerEnter(bars[5]);

    expect(screen.getByText(/8 orders/)).toBeInTheDocument();
    expect(screen.getByText(/\+₹100 bonus/)).toBeInTheDocument();
  });

  it('should hide tooltip on pointer leave', () => {
    const { container } = render(<WeeklyChart data={sevenDaysData} />);

    const bars = container.querySelectorAll('g');
    fireEvent.pointerEnter(bars[1]);
    expect(screen.getByText(/3 orders/)).toBeInTheDocument();

    fireEvent.pointerLeave(bars[1]);
    expect(screen.queryByText(/3 orders/)).not.toBeInTheDocument();
  });

  it('should handle empty data gracefully', () => {
    const { container } = render(<WeeklyChart data={[]} />);

    expect(screen.getByText('📊 This Week')).toBeInTheDocument();
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBe(0);
  });

  it('should handle single day data', () => {
    const { container } = render(
      <WeeklyChart data={[{ date: '2026-05-31', deliveries: 5, total: 300, bonus: 0 }]} />
    );

    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBe(1);
    expect(screen.getByText('₹300')).toBeInTheDocument();
  });

  it('should render SVG gradient definitions', () => {
    const { container } = render(<WeeklyChart data={sevenDaysData} />);

    const gradientToday = container.querySelector('#barGradientToday');
    const gradient = container.querySelector('#barGradient');
    expect(gradientToday).toBeTruthy();
    expect(gradient).toBeTruthy();
  });

  it('should use today gradient for the last day when it is today', () => {
    // On a Wednesday (day 3), the last item (index 6, Sunday) should not be highlighted
    // But the item at the index matching today should be
    const { container } = render(<WeeklyChart data={sevenDaysData} />);

    const rects = container.querySelectorAll('rect');
    // The last bar should use url(#barGradientToday) if today
    const lastRect = rects[6];
    expect(lastRect.getAttribute('fill')).toMatch(/url\(/);
  });

  it('should render zero-height bars for days with no data', () => {
    const data = [
      { date: '2026-05-25', deliveries: 0, total: 0, bonus: 0 },
      { date: '2026-05-26', deliveries: 0, total: 0, bonus: 0 },
      { date: '2026-05-27', deliveries: 0, total: 0, bonus: 0 },
      { date: '2026-05-28', deliveries: 0, total: 0, bonus: 0 },
      { date: '2026-05-29', deliveries: 0, total: 0, bonus: 0 },
      { date: '2026-05-30', deliveries: 0, total: 0, bonus: 0 },
      { date: '2026-05-31', deliveries: 0, total: 0, bonus: 0 },
    ];

    const { container } = render(<WeeklyChart data={data} />);

    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBe(7);
    // All bars should have fill for zero data
    rects.forEach(rect => {
      expect(rect.getAttribute('fill')).toBe('#1e293b');
    });
  });

  it('should set activeIdx state on pointer enter and clear on leave', () => {
    const { container } = render(<WeeklyChart data={sevenDaysData} />);

    const bars = container.querySelectorAll('g');
    fireEvent.pointerEnter(bars[3]);
    // Should show tooltip for the 4th bar
    expect(screen.getByText(/5 orders/)).toBeInTheDocument();

    fireEvent.pointerLeave(bars[3]);
    expect(screen.queryByText(/5 orders/)).not.toBeInTheDocument();
  });
});
