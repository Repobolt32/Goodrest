# Implementation Plan - Border-Weighted Obsidian Glass Hero

🤖 **Applying knowledge of `@[obsidian-glass-card]` and `@[frontend-design]`...**

The goal is to achieve 99% visual parity with the reference by shifting the light distribution from the "center-weighted" glow to an "edge-weighted" spray that follows the card borders.

## User Review Required

> [!IMPORTANT]
> The light will be pulled out from the center of the card and concentrated on the corners and adjacent borders. The center will remain a dark "Obsidian" void.

## Proposed Changes

### [Hero Component](file:///e:/desktop/goodrest/src/components/Hero.tsx)

#### [MODIFY] [Hero.tsx](file:///e:/desktop/goodrest/src/components/Hero.tsx)
- **Glass Card Background**:
    - Replace the current `bg-white/[0.03]` and internal glow `div`s with a unified layered background on the card element.
    - **CSS Implementation**:
      ```css
      background: 
        radial-gradient(ellipse at 0% 0%, rgba(255,255,255,0.80) 0%, rgba(0,0,0,0) 55%),
        radial-gradient(ellipse at 100% 100%, rgba(210,20,20,0.90) 0%, rgba(0,0,0,0) 55%),
        rgba(10, 10, 10, 0.6);
      ```
    - **Border**: Maintain `1px solid rgba(255,255,255,0.12)` with the existing `rounded-[40px]`.
    - **Cleaning**: Remove the legacy "Ambient Background Glows" and internal "Signature Tactical Red Glow" / "Specular Highlight" div layers if they are redundant with the new unified background.

## Skills Consulted
- `obsidian-glass-card` - For glassmorphic design patterns.
- `frontend-design` - For aesthetic principles.

## MCP Tools Identified
- `chrome-devtools` - For visual verification.

## Verification Plan

### Automated Tests
- `npx tsc --noEmit`

### Manual Verification (DevTools Mode)
1. Capture screenshot of the new "Edge-Weighted" lighting.
2. Verify that:
    - Top-left corner has a bright white/silver glow spreading along top/left edges.
    - Bottom-right corner has a bright red/crimson glow spreading along bottom/right edges.
    - Center is pure black/dark.
    - Glassmorphism border is preserved.
3. Compare with the provided reference image for 99%+ parity.
