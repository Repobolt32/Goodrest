---
name: obsidian-glass-card
description: Create premium glassmorphic UI components with tactical red light-leak glows, specular edge highlights, and high-contrast typography. Use this skill when generating cards, modals, or hero sections for the "Obsidian Table" design system or any high-end Gastronomy/Dark-mode web application.
---

# Obsidian Glass Card (The Gastronome's Vault)

This skill implements a specific "Obsidian Table" aesthetic: an immersive, dark, and weighted design language where UI elements feel like frosted glass sheets illuminated by tactical "heat lamp" glows.

## Core Design Tokens (Tailwind)

### 1. The Glass Surface
- **Background**: `bg-white/[0.03]` or `bg-[#1a1a1a]/60`.
- **Blur**: `backdrop-blur-[24px]` or `backdrop-blur-2xl`.
- **Border (Ghost Border)**: `border border-white/10`. This acts as a specular highlight.

### 2. The Lighting (Tactical Glows)
- **Primary Glow**: A radial gradient at the bottom-right corner.
  - CSS: `radial-gradient(circle at bottom right, rgba(229, 57, 53, 0.35) 0%, transparent 70%)`
  - Purpose: Simulates a heat lamp or fresh food glow.
- **Specular Highlight**: A linear gradient on the top-left edge.
  - CSS: `linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%)`

### 3. Typography (Plus Jakarta Sans & Manrope)
- **Headlines**: `font-sans` (Plus Jakarta Sans), `font-extrabold`, `tracking-tighter`, `text-white`.
- **Subtext**: `font-sans` (Manrope), `font-medium`, `text-zinc-400`.
- **CTA**: Gradient from `#EF4444` to `#DC2626`.

## Implementation Pattern (React + Tailwind)

```tsx
import { motion } from "framer-motion";

export const ObsidianCard = ({ children }) => (
  <div className="relative group">
    {/* Inner Red Glow Layer */}
    <div 
      className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
      style={{
        background: 'radial-gradient(circle at bottom right, rgba(229, 57, 53, 0.25) 0%, transparent 70%)'
      }}
    />
    
    {/* The Glass Card */}
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative z-10 backdrop-blur-[24px] bg-white/[0.04] border border-white/10 p-8 rounded-[32px] overflow-hidden"
    >
      {/* Permanent subtle Red Light Leak */}
      <div 
        className="absolute bottom-0 right-0 w-full h-full z-[-1] pointer-events-none"
        style={{
          background: 'radial-gradient(circle at bottom right, rgba(229, 57, 53, 0.15) 0%, transparent 60%)'
        }}
      />
      
      {children}
    </motion.div>
  </div>
);
```

## When to Trigger
Trigger this skill whenever the user asks for:
- "Premium cards"
- "Glassmorphic hero"
- "Red glow UI"
- "Obsidian theme"
- "Cinematic Gastronome design"
- "Match the Stitch reference"

Make sure to ALWAYS include the `backdrop-blur` and the `radial-gradient` glow, as these are the soul of the Obsidian Table design.
