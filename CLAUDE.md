# FORM — instructions for Claude

## Every screen works on mobile, tablet and desktop

Always implement new screens and changes for all three: mobile, tablet and desktop. A feature is not done until it works at each size.

- **Mobile** (phones, down to 320 px wide): the base layout. No sideways scrolling, touch targets at least 44 px, safe areas respected.
- **Tablet** (600–1023 px): the tab bar becomes a side rail. Use the extra width where it helps, such as two columns or grids, instead of a stretched phone layout.
- **Desktop** (1024 px and wider): the tab bar becomes a sidebar. The tab screens use the full width up to `layout.appMaxWidth`, with columns or grids. Every screen opened from them sits in a centred column of at most `layout.pageMaxWidth` (840 px) (`theme/colors.ts`, `app/_layout.tsx`). Use `useLayout()` to choose a layout and `useContentWidth()` to size charts. Keyboard use must work.
- Check each size before reporting a change as done. At least look at screenshots at 390, 768 and 1280 px wide. `e2e/layout.spec.ts` checks the key screens at 390, 768 and 1280 px; add a screen there when it gets a layout of its own.
