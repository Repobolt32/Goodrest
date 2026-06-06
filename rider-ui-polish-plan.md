# Rider App Zomato-Style UI Polish

## Goal
Apply Zomato-style dark UI polish to all rider-facing screens. Cosmetic only — no logic, no content, no component structure changes.

## Design Decisions

### Color Tokens (Zomato official)
| Token | Hex | Usage |
|---|---|---|
| `--z-bg` | `#1C1C1C` | Page background (pure black, no blue tint) |
| `--z-surface` | `#252525` | Card surfaces |
| `--z-surface-elevated` | `#2C2C2C` | Elevated cards, inputs |
| `--z-border` | `#363636` | Card borders, dividers |
| `--z-text-primary` | `#FFFFFF` | Headings, important values |
| `--z-text-secondary` | `#9C9C9C` | Labels, descriptions |
| `--z-text-tertiary` | `#696969` | Muted info, timestamps |
| `--z-red` | `#E23744` | Primary CTA, brand accent |
| `--z-red-dark` | `#CB202D` | Pressed/active CTA |
| `--z-red-light` | `#F9E5E7` | Light backgrounds, badges |
| `--z-green` | `#3AB757` | Earnings, success |
| `--z-gold` | `#F3C117` | Bonus, ratings |

### Typography Scale
| Role | Size | Weight | Case | Spacing |
|---|---|---|---|---|
| Page heading | `text-2xl` (24px) | `font-bold` | normal | `tracking-tight` |
| Section heading | `text-sm` (14px) | `font-semibold` | normal | `tracking-wide` |
| Value (big) | `text-3xl` (30px) | `font-bold` | normal | `tracking-tight` |
| Value (medium) | `text-xl` (20px) | `font-bold` | normal | none |
| Label | `text-xs` (12px) | `font-medium` | normal | `tracking-wide` |
| Metadata | `text-xs` (12px) | `font-normal` | normal | none |
| Button text | `text-xs` (12px) | `font-semibold` | uppercase | `tracking-wider` |

### Surface Rules
- **No glass-morphism** — delete `backdrop-blur`, `bg-white/60`, radial gradients
- **No decorative blur orbs** — delete all `blur-[100px]` decorative elements
- **Flat cards** — `bg-[#252525] border border-[#363636] rounded-2xl`
- **Elevated cards** — `bg-[#2C2C2C] border border-[#363636] rounded-2xl` for active order
- **Inputs** — `bg-[#252525] border border-[#363636] rounded-xl`

---

## Tasks

### Phase 1: Foundation

- [ ] **Task 1: Update globals.css** — Replace glass-morphism utilities with flat surface utilities. Add Zomato color CSS custom properties. Delete `.glass-panel`, `.glass-card`, `.status-glow`, blur orb styles. → Verify: `glass-card` class no longer exists in globals.css
- [ ] **Task 2: Remove blue-tinted slate backgrounds** — Replace all `bg-slate-950` with `bg-[#1C1C1C]`. Replace all `bg-slate-900` with `bg-[#252525]`. Replace all `border-slate-800/50` with `border-[#363636]`. → Verify: `grep -r "bg-slate-950\|bg-slate-900\|border-slate-800" src/app/rider src/components/rider` returns nothing

### Phase 2: Typography Overhaul

- [ ] **Task 3: Fix TerminalView.tsx labels** — Replace all `text-[9px] font-black uppercase tracking-widest` with `text-xs font-medium tracking-wide normal case`. Replace `text-[10px] font-bold uppercase tracking-widest` with `text-xs font-medium tracking-wide`. → Verify: No `text-[9px]` or `text-[10px]` or `uppercase tracking-widest` on labels in file
- [ ] **Task 4: Fix EarningsView.tsx labels** — Same as Task 3. Also fix `text-[9px]` headers → `text-sm font-semibold tracking-wide`. → Verify: No sub-12px text on labels/headers
- [ ] **Task 5: Fix WeeklyChart.tsx SVG text** — SVG `text-[10px]` → `text-xs` (13px). SVG `text-[9px]` → `text-xs` (13px). SVG `text-[8px]` → `text-xs` (13px). → Verify: No `text-[8-10px]` in SVG text elements
- [ ] **Task 6: Fix BonusProgress + OrderBroadcast** — Same label fixes. Remove `uppercase tracking-widest` from broadcast buttons. → Verify: Broadcast CTA reads fast, no letter-spacing abuse

### Phase 3: Component Polish

- [ ] **Task 7: Fix dashboard page** — Remove decorative blur orbs. Fix tab labels (`text-[9px]` → `text-xs font-medium`). Fix header greeting (`font-black` → `font-bold`). → Verify: No `blur-[120px]` in page, tab labels readable
- [ ] **Task 8: Fix login page** — Remove blur orb. Fix labels (`text-[10px] font-black uppercase tracking-widest` → `text-xs font-medium`). Fix CTA button (`bg-white` → `bg-[#E23744]`, `text-slate-950` → `text-white`). → Verify: CTA is red, labels readable, no decorative blur
- [ ] **Task 9: Apply flat surfaces everywhere** — Replace `glass-card` with `bg-[#252525] border border-[#363636] rounded-2xl`. Active order card uses `bg-[#2C2C2C]`. Remove `backdrop-blur-md` from broadcast overlay. → Verify: No `glass-card`, no `backdrop-blur` in rider files

### Phase 4: Verification

- [ ] **Task 10: Build + visual check** — Run `npm run build`. Open `/rider/login` and `/rider/dashboard` in browser. Check: all text readable at 12px+, no blue tint on dark bg, CTA buttons are red (#E23744), no decorative blur elements. → Verify: Build passes, screenshots show Zomato-style flat dark UI

## Done When
- [ ] All `text-[9px]`, `text-[10px]`, `text-[8px]` removed from rider files
- [ ] No `uppercase tracking-widest` on labels (buttons only get `tracking-wider`)
- [ ] No `font-black` except on big values (₹ amounts, counts)
- [ ] No glass-morphism, no blur orbs, no radial gradients in rider files
- [ ] Background is pure `#1C1C1C` black (no blue tint)
- [ ] CTA buttons use `#E23744` (Zomato red)
- [ ] All labels are `text-xs font-medium` normal case
- [ ] Build passes with zero errors

## Files Modified
1. `src/app/globals.css`
2. `src/app/rider/dashboard/page.tsx`
3. `src/app/rider/login/page.tsx`
4. `src/components/rider/TerminalView.tsx`
5. `src/components/rider/EarningsView.tsx`
6. `src/components/rider/WeeklyChart.tsx`
7. `src/components/rider/BonusProgress.tsx`
8. `src/components/rider/OrderBroadcast.tsx`
