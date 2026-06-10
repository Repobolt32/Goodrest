import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MenuItemCard from '@/components/MenuItemCard';
import { MenuItem } from '@/types/menu';

const mockItem: MenuItem = {
  id: '1',
  name: 'Butter Chicken',
  price: 350,
  category: 'Main Course',
  image_url: 'https://images.unsplash.com/photo-1234567890',
  tags: ['Recommended'],
  is_available: true,
};

const mockItemLocal: MenuItem = {
  id: '2',
  name: 'Jeera Rice',
  price: 150,
  category: 'Rice',
  image_url: '/images/jeera-rice.png',
  tags: [],
  is_available: true,
};

const mockItemNoImage: MenuItem = {
  id: '3',
  name: 'Masala Chai',
  price: 30,
  category: 'Beverages',
  image_url: undefined,
  tags: [],
  is_available: true,
};

describe('MenuItemCard', () => {
  it('uses default placeholder for external URLs', () => {
    render(
      <MenuItemCard
        item={mockItem}
        quantity={0}
        onAdd={() => {}}
        onRemove={() => {}}
      />
    );
    
    const img = screen.getByRole('img', { name: /butter chicken/i });
    expect(img).toHaveAttribute('src', expect.stringContaining('/images/food-placeholder.svg'));
  });

  it('uses local image path when provided', () => {
    render(
      <MenuItemCard
        item={mockItemLocal}
        quantity={0}
        onAdd={() => {}}
        onRemove={() => {}}
      />
    );
    
    const img = screen.getByRole('img', { name: /jeera rice/i });
    expect(img).toHaveAttribute('src', expect.stringContaining('/images/jeera-rice.png'));
  });

  it('does not render image when no image_url', () => {
    render(
      <MenuItemCard
        item={mockItemNoImage}
        quantity={0}
        onAdd={() => {}}
        onRemove={() => {}}
      />
    );
    
    const img = screen.queryByRole('img', { name: /masala chai/i });
    expect(img).not.toBeInTheDocument();
  });
});
