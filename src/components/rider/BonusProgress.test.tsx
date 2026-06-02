import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BonusProgress from './BonusProgress';

vi.mock('framer-motion', () => ({
  motion: { div: 'div', button: 'button', p: 'p', span: 'span', section: 'section' },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

describe('BonusProgress', () => {
  it('should render tier1 progress bar (under 6 deliveries)', () => {
    render(
      <BonusProgress
        todayDeliveries={3}
        currentBonus={0}
        nextMilestone={6}
        deliveriesUntilNext={3}
        progress={0.5}
        label="₹100 bonus in 3 more deliveries"
      />
    );

    expect(screen.getByText('🏆 Nightly Bonus')).toBeInTheDocument();
    expect(screen.getByText('3/6 deliveries')).toBeInTheDocument();
    expect(screen.getByText('₹100 bonus in 3 more deliveries')).toBeInTheDocument();
    expect(screen.queryByText(/earned/)).not.toBeInTheDocument();
  });

  it('should render tier2 progress bar (6+ deliveries, targeting ₹200)', () => {
    render(
      <BonusProgress
        todayDeliveries={8}
        currentBonus={100}
        nextMilestone={10}
        deliveriesUntilNext={2}
        progress={0.5}
        label="₹100 earned! ₹200 in 2 more"
      />
    );

    expect(screen.getByText('8/10 deliveries')).toBeInTheDocument();
    expect(screen.getByText('₹100 earned! ₹200 in 2 more')).toBeInTheDocument();
    expect(screen.getByText('₹100 earned')).toBeInTheDocument();
  });

  it('should render maxed state (10+ deliveries)', () => {
    render(
      <BonusProgress
        todayDeliveries={12}
        currentBonus={200}
        nextMilestone={null}
        deliveriesUntilNext={0}
        progress={1}
        label="₹200 bonus achieved! 🏆"
      />
    );

    expect(screen.getByText('10/10 deliveries')).toBeInTheDocument();
    expect(screen.getByText('₹200 bonus achieved! 🏆')).toBeInTheDocument();
    expect(screen.getByText('₹200 earned')).toBeInTheDocument();
  });

  it('should render 0 deliveries correctly', () => {
    render(
      <BonusProgress
        todayDeliveries={0}
        currentBonus={0}
        nextMilestone={6}
        deliveriesUntilNext={6}
        progress={0}
        label="₹100 bonus in 6 more deliveries"
      />
    );

    expect(screen.getByText('0/6 deliveries')).toBeInTheDocument();
    expect(screen.getByText('₹100 bonus in 6 more deliveries')).toBeInTheDocument();
  });

  it('should show progress bar with correct width percentage', () => {
    const { container } = render(
      <BonusProgress
        todayDeliveries={3}
        currentBonus={0}
        nextMilestone={6}
        deliveriesUntilNext={3}
        progress={0.5}
        label="test"
      />
    );

    const bar = container.querySelector('[style*="width"]');
    expect(bar).toBeTruthy();
    expect(bar!.getAttribute('style')).toContain('50%');
  });

  it('should clamp progress to 100% when progress > 1', () => {
    const { container } = render(
      <BonusProgress
        todayDeliveries={12}
        currentBonus={200}
        nextMilestone={null}
        deliveriesUntilNext={0}
        progress={1.5}
        label="test"
      />
    );

    const bar = container.querySelector('[style*="width"]');
    expect(bar!.getAttribute('style')).toContain('100%');
  });

  it('should not show earned badge when currentBonus is 0', () => {
    render(
      <BonusProgress
        todayDeliveries={5}
        currentBonus={0}
        nextMilestone={6}
        deliveriesUntilNext={1}
        progress={5 / 6}
        label="test"
      />
    );

    expect(screen.queryByText(/earned/)).not.toBeInTheDocument();
  });

  it('should show earned badge when currentBonus > 0', () => {
    render(
      <BonusProgress
        todayDeliveries={6}
        currentBonus={100}
        nextMilestone={10}
        deliveriesUntilNext={4}
        progress={0}
        label="test"
      />
    );

    expect(screen.getByText(/₹100 earned/)).toBeInTheDocument();
  });
});
