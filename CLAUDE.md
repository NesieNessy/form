# FORM — instructions for Claude

## Every screen works on mobile, tablet and desktop

Always implement new screens and changes for all three: mobile, tablet and desktop. A feature is not done until it works at each size.

- **Mobile** (phones, down to 320 px wide): the base layout. No sideways scrolling, touch targets at least 44 px, safe areas respected.
- **Tablet** (about 600–1023 px): use the extra width where it helps, such as two columns or wider forms, instead of a stretched phone layout.
- **Desktop** (1024 px and wider, web): today the app sits in a centred column from `layout.desktopBreakpoint` (700 px) up to `layout.containerMaxWidth` (840 px) wide (`theme/colors.ts`, `app/_layout.tsx`). Use `useContentWidth()` rather than the window width for anything sized to the content. Screens that list or compare a lot, such as coach and physio screens, use side-by-side columns there (see `app/coach-athlete.tsx`). Keyboard use must work.
- Check each size before reporting a change as done. At least look at screenshots at 390, 768 and 1280 px wide. Extend `e2e/a11y.spec.ts` (which already checks 320 px) when a screen gets a layout of its own.
