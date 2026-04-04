# UI-SPEC: Goodrest Foundation (Phase 1)

> Status: APPROVED (Retroactive)
> Phase: 01-foundation

## 🎨 Creative Direction: Premium Fast-Food
Inspired by high-performance fast-food apps, the design focuses on bold typography, high-contrast colors, and interactive card layouts.

### Typography
- **Headings**: `Lilita One` or `Oswald` (Bold, Uppercase)
- **Body**: `Inter` (14px/16px, Regular/Semibold)
- **Line Height**: 1.2 (Headings), 1.5 (Body)

### Spacing & Layout
- **Unit**: 8px (4, 8, 16, 24, 32, 48, 64)
- **Bento Radius**: `1.5rem` (Tailwind Class: `rounded-bento`)
- **Grid**: Bento Box Card Grid (2-3 columns on Desktop, 1 on Mobile)

### Color Palette (60/30/10)
- **Surface (60%)**: `#f8fafc` (Background), `#ffffff` (Cards)
- **Secondary (30%)**: `#0f172a` (Text/Accent Surfaces)
- **Accent (10%)**: `#f97316` (Primary Action), `#ef4444` (Featued/Recommendation)

## 🏗️ Component Inventory

### 1. Category Selector
- **Interaction**: Horizontal scroll with hidden scrollbar.
- **State**: Active tab has primary background and white text.

### 2. MenuItemCard
- **Layout**: Image top, details bottom.
- **Micro-interactions**: Scale up on hover, shadow transition.
- **Controls**: Pill-shaped quantity selector.

### 3. Floating Cart
- **Behavior**: Sticky bottom or bottom-right.
- **Animation**: Entrance from bottom (Framer Motion).
