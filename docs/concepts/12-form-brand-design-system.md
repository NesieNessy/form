# FORM Brand Design System — Logo-Based Frontend Specification

**Product:** FORM — FIND YOUR FORM.  
**Version:** 1.0  
**Status:** Proposed UI specification grounded in the supplied `FORM-gradient-transparent(1).svg`  
**Applies to:** Athlete app, coach, physiotherapist, nutrition professional, and training studio workspaces  
**Related:** [`11-frontend-ux-ui-architecture.md`](11-frontend-ux-ui-architecture.md), [`form-design-tokens.css`](form-design-tokens.css)

## 1. Brand evidence and design interpretation

The source SVG declares a **2022 × 778** viewBox, a transparent canvas, accessible label `FORM — FIND YOUR FORM.`, and one left-to-right linear gradient. These are directly derived from the asset. The preferred body font, UI colors, radii and component treatments below are **design proposals**, not properties specified by the logo.

| Stop | Position | Hex | Recommended role |
|---|---:|---|---|
| Deep indigo | 0% | `#2F4F93` | Brand anchor / alternative dark emphasis |
| Electric blue | 18% | `#2E78D2` | Brand blue in imagery and graphics |
| Violet | 36% | `#6B55B2` | Secondary spectrum highlight |
| Berry | 52% | `#B4467B` | Gradient transition |
| Orange | 68% | `#E2764E` | Brand highlight, not warning state |
| Muted gold | 84% | `#B1A25F` | Gradient transition, not status |
| Teal | 100% | `#28A59C` | Brand finish, not success state |

```css
background: linear-gradient(90deg,
  #2F4F93 0%, #2E78D2 18%, #6B55B2 36%,
  #B4467B 52%, #E2764E 68%, #B1A25F 84%, #28A59C 100%);
```

**Brand meaning (proposed):** FORM links disciplined training, physical wellbeing, personal adaptation and long-term progress. The shifting hues imply multidimensional growth, whereas stable neutral UI surfaces signal trust, readability and control.

## 2. Design principles

1. **Performance clarity first.** Data must stay readable while moving, sweating, outdoors, or under time pressure.
2. **Calm canvas, expressive identity.** Brand spectrum on the logo and rare focal moments, not every interface element.
3. **Neutral by default.** Health, rehab and nutrition insights are information, not gamification.
4. **Evidence before decoration.** Label timestamps, measurement units, source and uncertainty.
5. **One product, multiple roles.** Shared design language; distinct permissions and specialized workspace layouts.
6. **Mobile-first athlete, desktop-first professional.** Maintain parity in critical workflows.

## 3. Semantic palettes (proposed)

The logo colors are immutable brand reference tokens. Accessible interface tokens are allowed to depart from these original colors as needed for contrast.

| Token | Light | Dark | Use |
|---|---|---|---|
| Canvas | `#F7F9FC` | `#0B1220` | App background |
| Surface | `#FFFFFF` | `#121D30` | Main cards/panels |
| Raised surface | `#EFF3F9` | `#1B2A41` | Selected or elevated controls |
| Primary text | `#17243A` | `#F3F7FD` | Titles, data, body |
| Secondary text | `#50617B` | `#B5C4D7` | Supporting copy |
| Border | `#D9E1EC` | `#34445B` | Separators, outlines |
| Primary action | `#254B9A` | `#91B8FF` | Solid CTAs and active nav |
| On primary | `#FFFFFF` | `#0B1220` | Button label |
| Primary hover | `#1B397B` | `#B7D0FF` | Hover state |
| Focus ring | `#2254B7` | `#A4C5FF` | Keyboard focus |
| Success text | `#166540` | `#85D6AE` | Validated success only |
| Warning text | `#8B4900` | `#FFD08B` | Needs review |
| Danger text | `#B42335` | `#FF9CA6` | Error/destructive |
| Information text | `#2458A6` | `#9CC8FF` | Informational notices |

Use CSS custom properties from [`form-design-tokens.css`](form-design-tokens.css). These values are *starting points* and must pass automated WCAG component-level contrast checks before release.

### Rules for using the full gradient

**Do:** logo/wordmark, splash illustration, onboarding hero accent, completion illustration and low-frequency campaign visuals.  
**Use sparingly:** 2–4px decorative rules, small progress flourishes, selected branded illustration backgrounds.  
**Do not:** use as chart legend, clinical status, user role, text fill for long copy, major full-screen app background, or all buttons. Do not layer text over the gradient without a verified contrast-safe foreground surface.

## 4. Typography and numerics

- UI stack: `Inter` if appropriately licensed and available, otherwise `ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif`.
- Type scale (px/rem at 16px root): Display 40/44, H1 32/38, H2 24/30, H3 20/26, Body 16/24, Small 14/20, Caption 12/16.
- Avoid sub-12px interface text. Do not use color alone for hierarchy.
- Metric numerals: use `font-variant-numeric: tabular-nums`; timer 56–88px depending on viewport; numeric delta and units as separate readable elements.
- Copy should be precise and supportive: “HRV below your personal baseline” is preferable to an unsupported diagnosis.

## 5. Spacing, depth, form and responsive layout

- Spacing: 4, 8, 12, 16, 24, 32, 48, 64px.
- Radius: 8px control, 12px card, 16px modal, pill for compact badges only.
- Touch targets: aim for at least 44 × 44px; workout player key actions ideally 48–56px.
- Borders: 1px subtle; elevation: one restrained card and modal shadow token. Dark mode favors tonal elevation.
- Mobile shell: bottom navigation, full-width action cards, sticky timer controls. Tablet: flexible split panes. Desktop: side navigation and adaptive 12-column layout.
- Safe-area insets for phones; avoid charts requiring horizontal pinch-zoom by default.

## 6. Component behavior guidelines

| Component | FORM treatment | Accessibility / safety rule |
|---|---|---|
| Primary CTA | Solid brand-blue fill, rounded 8–10px | Accessible contrast, disabled/loading state |
| Secondary CTA | Surface with brand outline/text | Never rely on color alone |
| App navigation | Neutral surface and blue active indicator | Text/icon and `aria-current` |
| Workout block card | Neutral elevated card, large prescription and unit | Reorder affordance and keyboard support |
| Timer | High contrast, large tabular numbers | Pause/resume confirm state, offline operation |
| Health metric | Value + unit + source + time window | Missing data and sensor reliability states |
| Nutrition logging | Strong food and portion hierarchy | Confirm guessed portions/calories |
| Rehab review | Clear provider approval and restrictions | No AI-only clinical clearance |
| AI proposal | Summary, source, uncertainty, before/after diff | Approval before consequential changes |
| Charts | Neutral grid + distinct accessible series | Legend, textual trend summary, table fallback |
| Consent control | Scopes, duration, affected professionals | Revocable and comprehensible |
| Empty/error states | Neutral illustrations, direct action | Recovery path and support message |

## 7. Five user roles

**Athlete:** immersive workout player, Today overview, train/plan/insights, nutrition diary, readiness context, goals and rehab status. Prioritize one-handed use.  
**Coach:** roster, workout authoring, assignment calendar, exception and feedback queues, side-by-side athlete trends.  
**Physiotherapist:** assessment notes, approved rehab templates, movement-video review, progress history, controlled return-to-training tasks.  
**Nutrition professional:** food diary, meal plan builder, adherence insights, athlete messaging and nutrition-specific consents.  
**Studio administrator:** schedules, classes, staffing, organization operations and aggregated reporting, without implicit access to medical or nutrition records.

Role is never expressed solely by a color. Always display organization, current athlete/client and access scope near sensitive information.

## 8. Theming and accessibility

- Support explicit light/dark/system choice; respect user preference, including OS high-contrast and reduced-motion settings.
- WCAG 2.2 AA goals: normal text 4.5:1; large text 3:1; relevant non-text UI boundaries/controls 3:1. Run tests using computed foreground/background pairs, not raw token names.
- Keyboard, focus visibility, screen-reader labelling, responsive zoom and large text are mandatory.
- On charts, combine distinct styles, markers, patterns and labels with hue for color-vision accessibility.
- Never use red/green alone for health or nutrition feedback. Do not derive medical conclusions from decorative brand colors.
- Motion: 120–200ms for lightweight transitions, none for critical countdown updates; `prefers-reduced-motion` disables nonessential animations.
- Sensitive previews: privacy-blur and explicit user-triggered reveal for crowded/studio settings.

## 9. Design token architecture

Token layers:

```text
Brand primitives (SVG stops)
  → Neutral and action palettes (light/dark)
    → Semantic tokens (text, surfaces, borders, status)
      → Component tokens (buttons, cards, inputs, charts, timer)
```

The brand layer never determines authorization, exercise intensity, readiness score or clinical status. The supplied CSS file contains mode-specific CSS variables and sample component classes; production implementation should integrate these with the chosen component library and design-token pipeline.

## 10. UI implementation and acceptance checklist

- Store original SVG unmodified as an asset; render with an accessible alternative in contexts where its own `aria-label` is unavailable.
- Build light/dark Storybook examples for every shared component.
- Define hover, active, focus, disabled, loading, offline, missing-data, error and success states.
- Run automated contrast tests, axe accessibility checks, keyboard-only reviews and exercise-timer usability sessions.
- Test 320px mobile, common phones, tablets and desktop layouts; test 200% text zoom.
- Validate brand consistency across athlete, coach, physio, nutrition and studio flows.
- Measure workout-start and logging task completion, not only visual consistency.

## 11. Rollout aligned to five product stages

| Stage | Design system integration |
|---|---|
| 1 — Foundation | Brand tokens, global shell, login/onboarding, exercise library, workout player, consent surfaces, role switch |
| 2 — Recovery | Time-series charts, source indicators, uncertainty and readiness cards |
| 3 — AI Coaching | Assistant panels, sources, proposal diffs, approval and escalation affordances |
| 4 — Goals | Progress charts, milestones, compare periods, coach/nutrition goal views |
| 5 — Movement Analysis | Video player, overlay controls, annotated feedback, review workflow and video consent |

## 12. Definition of done

A screen is ready only when: it matches the shared tokens; covers all states; has WCAG checks; shows health-data source/quality where applicable; respects access scope; has localizable strings; works in both themes and responsive layouts; and has passing visual regression coverage.
