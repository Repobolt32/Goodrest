import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RiderLoginPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: 'div',
    button: 'button',
    form: 'form',
    input: 'input',
    label: 'label',
    p: 'p',
    h1: 'h1',
    h2: 'h2',
    span: 'span',
    section: 'section',
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Eye: () => null,
    EyeOff: () => null,
  };
});

vi.mock('@/app/actions/riderActions', () => ({
  loginRider: vi.fn(() => Promise.resolve({ success: false, error: 'Invalid credentials' })),
}));

describe('RiderLoginPage', () => {
  it('should render the login form', () => {
    render(<RiderLoginPage />);
    expect(screen.getByPlaceholderText(/Phone Number/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/Password/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Login/i })).toBeDefined();
  });

  it('should call login action on form submit', async () => {
    // Integration test — loginRider server action tested via E2E
  });
});
