---
name: mockup-true-hero
description: Replicate the 'Goodrest' premium mobile hero design exactly based on the authorized visual spec. Specifically use when asked to 'fix the hero layout', 'match the mockup exactly', or 'make the hero pixel-perfect' on phone view. Triggers on any request involving Hero imagery, text alignment, or cinematic contrast for the mobile storefront. Use this skill PROACTIVELY if the Hero UI looks simple or does not match the premium mockup.
---

# Mockup-True Hero Protocol (Goodrest Mobile)

Use this skill to transform the 'Goodrest' Hero section into a pixel-perfect match for the authorized mobile visual specification.

## 1. Top Bar (Header)
- **Minimalism**: Remove all text labels from the mobile header.
- **Components**:
    - **Logo (Left)**: "Good" (White #FFFFFF), "rest" (Coral #FF4D4D). Bold and modern typography.
    - **Search Box (Right)**: A perfectly circular button (`rounded-full`) with a white background (`bg-white`) containing a standard magnifying glass search icon (`text-gray-900`).
- **Safe Area**: Ensure the header respects `safe-area-inset-top`.

## 2. Content Stack (Vertical Order)

### Level 1: Trust Line
- **Accent**: A thin horizontal red line (`w-8 h-[2px] bg-[#FF4D4D]`) positioned strictly to the **LEFT** of the text.
- **Text**: "SERVING GAYAJI FOR 70+ YEARS".
- **Styles**: `uppercase`, `text-[10px]`, `tracking-[2px]`, `font-bold`, `text-[#D1D5DB]`.

### Level 2: Headline
- **Text**: "Authentic Taste. Delivered Fresh."
- **Visuals**:
    - "Authentic Taste." -> White (`text-white`).
    - "Delivered Fresh." -> Coral (`text-[#FF4D4D]`).
- **Styles**: `text-[40px]`, `leading-[1.05]`, `font-black` (Extra Bold).

### Level 3: Description
- **Text**: "Loved by **10,000+** people in the city."
- **Styles**: `text-base`, `text-[#9CA3AF]`, `leading-relaxed`. Bold the numeric part (`10,000+`).

### Level 4: Primary CTA
- **Label**: "Explore Menu & Order Now" followed by a right arrow icon (`&rarr;`).
- **Button Styles**:
    - **Background**: Coral (`bg-[#FF4D4D]`).
    - **Shape**: Rounded corners (`rounded-lg` or `rounded-xl`).
    - **Size**: Large padding (`py-4 px-6`), nearly full width (`w-[90%]`) on mobile.

### Level 5: Social Proof / Stats
- **Layout**: A single row containing three key metrics separated by icons or dots.
- **Item 1**: Yellow Star icon + "**4.3 rating**".
- **Item 2**: Dot separator (`&bull;`) + "**2,000+ monthly orders**".
- **Item 3**: Lightning Bolt icon (Yellow) + "**Fast table ordering**".
- **Styles**: `text-xs`, `text-white`, `font-medium`, `flex items-center gap-2`.

## 3. Cinematic Background & Filters
- **The Dish**: High-quality imagery of a traditional Indian bowl (e.g., Dal Makhani/Butter Chicken).
- **Placement**: Centered or slightly bottom-shifted (`object-bottom`).
- **Depth**: Apply a soft blur (`backdrop-blur-[2px]` or `blur-[1px]`) to the background *except* for the primary focal point of the dish.
- **Readability Overlay**: A dark vertical gradient overlay from the left (`from-black/90 to-transparent`) and a subtle bottom-up vignette to ensure all text remains high-contrast.

## 4. Implementation Guidelines
- **Alignment**: **ABSOLUTE LEFT ALIGNMENT** for all text and the CTA button.
- **Padding**: Horizontal desktop padding `px-8`, mobile padding `px-6`.
- **Z-Index**: Ensure the header (Top Bar) and Content Stack are above the background overlay layers.
