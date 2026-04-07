# Implementation Plan - Hero UI Cleanup (Minimalist Design)

🤖 **Applying knowledge of `@[frontend-design]`...**

The user requested to clean the Hero section by removing all images while keeping the texts, aiming for a simple and clean aesthetic.

## Skills Consulted
- `frontend-design` (Aesthetics, Typography, Minimalism)
- `clean-code` (UI component refactoring)
- `react-best-practices` (Next.js Image removal)

## MCP Tools Identified
- `grep_search` (Locate images)
- `replace_file_content` (Modify Hero.tsx)

## Proposed Changes

### [Hero Component](file:///e:/desktop/goodrest/src/components/Hero.tsx)

#### [MODIFY] [Hero.tsx](file:///e:/desktop/goodrest/src/components/Hero.tsx)
- [DELETE] Remove the background `Image` component (line 20-27).
- [DELETE] Remove the bottom-peeking dish `Image` component and its parent `motion.div` (line 39-57).
- [DELETE] Remove the glassmorphic background card `motion.div` (line 31-36) to simplify the layout.
- [MODIFY] Adjust the main section `section` to have a solid background or a simpler gradient.
- [MODIFY] Ensure typography remains impactful (Inter font) as it becomes the primary focus.

## Open Questions
- Do you want to keep the glassmorphic blur effect? I propose removing it for maximum simplicity, but I am open to keeping it as a "subtle depth" element if you prefer. For now, the plan includes its removal for a truly "clean" look.

## Verification Plan

### Automated Tests
- Run `npm run dev` and visually verify.
- Check browser console for missing asset warnings (we will remove references, but tốt to check).

### Manual Verification
- Visual inspection of the Hero section at different screen sizes (Responsive check).
