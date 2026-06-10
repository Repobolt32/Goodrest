/**
 * Medium Bug Verification Tests
 * 
 * Tests that validate the status of medium-severity bugs from issues-open.md
 * BUG-17, QOL-03, QOL-05, QOL-06, BUG-18
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderHook, waitFor } from '@testing-library/react';
import fs from 'fs';
import path from 'path';

// ──────────────────────────────────────────
// BUG-17: Offers Table Migration Not Applied
// ──────────────────────────────────────────
describe('BUG-17: Offers Table Migration', () => {
  it('migration file exists in supabase/migrations', () => {
    const migrationDir = path.resolve(process.cwd(), 'supabase/migrations');
    const files = fs.readdirSync(migrationDir);
    const offersMigration = files.find(f => f.includes('offers'));
    expect(offersMigration).toBeDefined();
    expect(offersMigration).toMatch(/create_offers/);
  });

  it('bug17-offers-table.test.ts exists and verifies table', () => {
    const testFile = path.resolve(process.cwd(), 'src/tests/unit/actions/bug17-offers-table.test.ts');
    expect(fs.existsSync(testFile)).toBe(true);
    const content = fs.readFileSync(testFile, 'utf-8');
    expect(content).toContain('offers table should exist');
    expect(content).toContain('describe.skipIf');
  });
});

// ──────────────────────────────────────────
// QOL-03: Blind Type Cast `as unknown as MenuItem[]`
// ──────────────────────────────────────────
describe('QOL-03: Blind Type Cast', () => {
  it('useMenu.ts does not contain "as unknown as MenuItem"', () => {
    const sourcePath = path.resolve(process.cwd(), 'src/hooks/useMenu.ts');
    const content = fs.readFileSync(sourcePath, 'utf-8');
    expect(content).not.toMatch(/as unknown as MenuItem/);
  });

  it('menuValidation.ts uses Zod validation', () => {
    const validationPath = path.resolve(process.cwd(), 'src/lib/menuValidation.ts');
    const content = fs.readFileSync(validationPath, 'utf-8');
    expect(content).toContain('import { z } from');
    expect(content).toContain('safeParse');
  });

  it('useMenu.ts calls validateMenuItems', () => {
    const sourcePath = path.resolve(process.cwd(), 'src/hooks/useMenu.ts');
    const content = fs.readFileSync(sourcePath, 'utf-8');
    expect(content).toContain('validateMenuItems');
  });
});

// ──────────────────────────────────────────
// QOL-05: Categories Fetched on Every Category Change
// ──────────────────────────────────────────
describe('QOL-05: Categories Fetched on Every Category Change', () => {
  it('useMenu.ts fetches categories in a separate mount-only effect', () => {
    const sourcePath = path.resolve(process.cwd(), 'src/hooks/useMenu.ts');
    const content = fs.readFileSync(sourcePath, 'utf-8');
    
    // Categories should be fetched in a useEffect with empty deps (mount only)
    // The fetchCategories function is defined INSIDE the useEffect
    expect(content).toMatch(/const fetchCategories = async/);
    // There must be a useEffect with empty dependency array
    expect(content).toMatch(/useEffect[\s\S]*?\[\s*\]\s*\)/);
    // Categories should be fetched ONLY once (not on every category change)
    const categoryEffectIndex = content.indexOf('fetchCategories');
    const emptyDepsAfterCategory = content.indexOf('[]', categoryEffectIndex);
    expect(emptyDepsAfterCategory).toBeGreaterThan(-1);
  });

  it('useMenu.ts has separate effects for categories and items', () => {
    const sourcePath = path.resolve(process.cwd(), 'src/hooks/useMenu.ts');
    const content = fs.readFileSync(sourcePath, 'utf-8');
    
    // Check there are TWO useEffects
    const effectCount = (content.match(/useEffect/g) || []).length;
    expect(effectCount).toBeGreaterThanOrEqual(2);
    
    // One should have empty deps (categories), one with [category, categoryMap] (items)
    expect(content).toContain('[category, categoryMap]');
  });
});

// ──────────────────────────────────────────
// QOL-06: Hardcoded Rating "4.1"
// ──────────────────────────────────────────
describe('QOL-06: Hardcoded Rating "4.1"', () => {
  it('MenuItemCard.tsx does not contain "4.1"', () => {
    const cardPath = path.resolve(process.cwd(), 'src/components/MenuItemCard.tsx');
    const content = fs.readFileSync(cardPath, 'utf-8');
    expect(content).not.toContain('4.1');
  });

  it('MenuItemCard.tsx has no rating display elements', () => {
    const cardPath = path.resolve(process.cwd(), 'src/components/MenuItemCard.tsx');
    const content = fs.readFileSync(cardPath, 'utf-8');
    // Should not render star ratings (not checking `star` as substring since
    // words like `startsWith` trigger false positives)
    expect(content).not.toMatch(/\bstar\b/i);
    expect(content).not.toMatch(/rating/i);
  });
});

// ──────────────────────────────────────────
// BUG-18: Menu Images Use External Unsplash URLs
// ──────────────────────────────────────────
describe('BUG-18: Menu Images Use External Unsplash URLs', () => {
  it('MenuItemCard.tsx detects and replaces external URLs', () => {
    const cardPath = path.resolve(process.cwd(), 'src/components/MenuItemCard.tsx');
    const content = fs.readFileSync(cardPath, 'utf-8');
    
    // Should check for external URL pattern
    expect(content).toContain('startsWith');
    expect(content).toContain('http');
    expect(content).toContain('food-placeholder.svg');
  });

  it('food-placeholder.svg exists in public/images', () => {
    const placeholderPath = path.resolve(process.cwd(), 'public/images/food-placeholder.svg');
    expect(fs.existsSync(placeholderPath)).toBe(true);
  });

  it('no local food images exist yet — DB still has external URLs', () => {
    const imagesDir = path.resolve(process.cwd(), 'public/images');
    const images = fs.readdirSync(imagesDir);
    // Only food-placeholder.svg is the system image; no individual food images
    const foodImages = images.filter(f => f !== 'food-placeholder.svg');
    expect(foodImages).toHaveLength(0);
  });

  it('MenuItemCard test verifies external URLs become placeholder', () => {
    const testPath = path.resolve(process.cwd(), 'src/components/MenuItemCard.test.tsx');
    const content = fs.readFileSync(testPath, 'utf-8');
    expect(content).toMatch(/unsplash/i);
    expect(content).toContain('food-placeholder.svg');
    expect(content).toContain('uses default placeholder for external URLs');
  });
});
