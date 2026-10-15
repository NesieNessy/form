# Frontend Experience & Architecture Blueprint

**Product:** Athlete Intelligence Platform  
**Version:** 1.0  
**Language:** English  
**Audience:** Product designers, frontend engineers, technical leads, accessibility specialists, coaches, physiotherapists, nutrition professionals, and gym operators  
**Status:** Proposed architecture; validate with user research and engineering discovery

## 1. Executive summary

Build one coherent, accessible, mobile-first training platform with role-aware workspaces for **athletes, coaches, physiotherapists, nutrition professionals, and studio operators**. The frontend should make everyday actions fast—start a workout, log a meal, review recovery, update a rehab exercise—while supporting professional workflows that require careful review, delegation, and explicit data permissions.

**Product principle:** A single athlete-centered data model, several focused workspace experiences, and one consistent design system. Do not build five unrelated apps or a single overcrowded dashboard.

The experience must work well **without AI**. AI assists with importing, generating, adapting, explaining, and summarizing data; it never blocks core tracking and never silently overwrites professional or health-related records.

## 2. User groups and primary jobs

| Persona | Primary goal | Frequent actions | Homepage emphasis |
| --- | --- | --- | --- |
| Athlete | Train consistently and understand progress | Today's session, timer, workout logging, food logging, check-ins | Today dashboard and next action |
| Coach | Deliver plans and monitor athletes | Assign workouts, review completions, comment, adjust plans | Athlete roster, exceptions, review queue |
| Physiotherapist | Manage supervised rehabilitation and return-to-training | Review symptoms, edit rehab protocols, review adherence, approve milestones | Caseload and follow-up priorities |
| Nutrition professional | Personalize fueling and review intake | Review food logs, design plans, discuss adherence | Nutrition caseload and plan reviews |
| Studio operator | Run facilities and classes | Manage memberships, classes, staff, capacity, reports | Operations, schedules, occupancy |

A person may have **multiple roles and organization memberships**. Switching workspace must not change ownership of personal athlete data or grant automatic health access.

## 3. Product experience principles

1. **Action-first:** show the next useful task before charts or AI-generated commentary.
2. **Progressive disclosure:** simple defaults for athletes, advanced controls for professionals.
3. **Consistent primitives:** the same workout blocks, units, metrics, charts, consent states, and review patterns throughout the product.
4. **Visible provenance:** show whether a value was manually entered, imported from a device, calculated, or suggested by AI.
5. **Human control:** AI changes appear as drafts with previews, explanations, and explicit confirmation.
6. **Trustworthy health UX:** avoid diagnostic-looking claims; expose uncertainty and professional-review states.
7. **Calm accessibility:** readable typography, strong contrast, keyboard and screen-reader support, and reduced-motion support.
8. **Graceful degradation:** no wearable, no AI, poor network, and incomplete data are normal supported states.
9. **Privacy by default:** share nothing sensitive simply because a user joins a studio or hires a coach.
10. **Mobile for activity, desktop for management:** train and track on phones; plan and supervise efficiently on larger screens.

## 4. Information architecture

### 4.1 Athlete app navigation

**Primary mobile tabs:** Today · Train · Progress · Health · More. Keep the main navigation to approximately five destinations. Use contextual shortcuts for Nutrition, Rehab, Goals, and AI Coach based on active needs rather than hiding these features.

**Desktop sidebar:** Today, Training, Calendar, Progress, Health & Recovery, Nutrition, Rehabilitation (when relevant), Goals, AI Coach, Connections, Settings.

| Area | Key pages |
| --- | --- |
| Today | Daily overview, today's workout, recovery context, suggested actions |
| Training | Workout library, workout detail, builder, workout player, session history |
| Calendar | Week/month schedule, planned vs completed, rescheduling |
| Progress | Goal cards, personal records, trends, comparisons |
| Health | Wearable connections, sleep, HR/HRV trends, data sources and freshness |
| Nutrition | Food diary, quick log, meal plans, hydration, fueling |
| Rehab | Active plan, exercises, symptom tracking, professional feedback |
| AI Coach | Contextual chat, proposed actions, approval history |
| Settings | Profile, units, accessibility, privacy/consent, data export and deletion |

### 4.2 Professional workspaces

Professional workspaces share a **global header**, **organization/role switcher**, **notification center**, **search**, and **permission-aware client navigation**.

- **Coach:** Overview · Athletes · Training Plans · Workout Library · Reviews · Messages · Reports.
- **Physiotherapist:** Caseload · Rehab Plans · Session Reviews · Outcome Measures · Return-to-Training · Messages.
- **Nutrition professional:** Clients · Food Log Reviews · Nutrition Plans · Fueling · Check-ins · Reports.
- **Studio operator:** Overview · Members · Class Schedule · Staff · Attendance · Facilities · Reports · Organization Settings.

Only show sections for granted role capabilities. A hidden section is not a substitute for server-side authorization.

### 4.3 Client profile composition

Professional athlete/client detail has a stable header with identity, active relationship, consent scope, and contact channel. Its tabs are context-specific: Overview, Training, Health, Nutrition, Rehab, Goals, Notes, and Shared Files. Unapproved tabs show **Request access** rather than exposed previews or sensitive metadata.

## 5. Critical user journeys

### Journey A — Athlete executes a workout

1. Open Today → see scheduled session and estimated duration.
2. Open workout detail → inspect blocks, equipment, scale options, and instructions.
3. Choose approved variant (or request an AI-generated suggestion).
4. Start workout player → timer, active block, next movement, accessible controls.
5. Log results during or after each step; maintain local draft if offline.
6. Finish → review time, rounds/reps, RPE, notes, and wearable activity match.
7. Confirm session → see updated calendar, history, and goal progress.

### Journey B — Coach assigns a plan

Roster → select athlete → view permissions and recent adherence → select template or create workout → preview per-athlete prescription → assign to calendar → athlete receives notification → coach reviews actual session and comments.

### Journey C — Physiotherapist manages rehab

Caseload → patient consent → approved rehab protocol → session adherence and symptom notes → update exercises or review flagged changes → record professional decision and next review. The UI must not imply the AI clinically cleared return to sport.

### Journey D — Nutrition professional reviews intake

Client list → consent-filtered nutrition diary → identify logged vs missing meals and source quality → draft adjustments → attach to relevant training days → client approval/acknowledgement → follow-up check-in.

### Journey E — Studio runs a class

Schedule → class setup with capacity → member booking and attendance → class workout assignment → post-class results as opted-in athlete-owned records. Studio administrators do not see individual health metrics by default.

### Journey F — AI proposes an action

User request or relevant event → read scoped data → generate proposal → show source/context, assumptions, and changes **side-by-side** → validate → approve, edit, or dismiss → record audit trail and notify affected collaborators if appropriate.

## 6. Screen specifications

### 6.1 Athlete Today dashboard

**Top:** greeting, date, lightweight state indicators, and **Start today's workout** primary CTA.  
**Middle:** workout schedule, recovery context (when connected), next nutrition/fueling event, active rehab action, goal milestone.  
**Bottom:** trends and optional AI insight.  

Avoid showing every health metric above the fold. Each status uses human-readable labels plus exact measurement timestamps and optional drill-down.

### 6.2 Workout builder

Support free-text and structured creation without competing interfaces:

- **Quick entry** for notation such as `12 min AMRAP: 10 burpees, 200m run`.
- **Structured editor** with editable nested blocks, repetition groups, step prescriptions, transitions, rests, pacing/power targets, RX/Scaled variants, and notes.
- **Live preview** as an athlete would see it in the player.
- **Validation rail** with errors, warnings, unresolved exercises, estimated duration.
- **Version history** and explicitly named actions: Save draft, Publish template, Assign, Duplicate.

Builder interactions should work by keyboard, not only drag-and-drop. Prefer reorder buttons as a functional alternative.

### 6.3 Workout player

Large timer; current step and upcoming step; start/pause/skip; audible/haptic alerts if enabled; reps/load entry; clear workout phase. Protect against accidental session loss. Maintain a local event log, reconcile safely on reconnect, and show unsynced state without false success messaging.

### 6.4 Calendar and training plan

Day/week/month; planned/completed/skipped indicators not differentiated by color alone; accessible rescheduling; conflict detection; filters by sport and coach; bulk assignment for professionals; transparent change history.

### 6.5 Health & recovery

Chronological metric cards with data sources and refresh times; baseline/trend emphasis rather than unexplained scores; missing-data and device-disconnected states; explain model-derived insights and limitations. Show **measured**, **vendor-estimated**, **platform-calculated**, and **self-reported** distinctly.

### 6.6 Nutrition

Quick food search, barcode input where supported, recent foods, reusable meals, portions/units, recipe composition, hydration, day totals, target ranges, and workout fueling timeline. Support partial entries and correction of misidentified foods. A single photo should never be presented as a precise verified nutrient count.

### 6.7 Rehab

Exercise prescription, side, sets/reps/hold, relevant clinician-set constraints, symptom check-in, adherence, and communication with authorized clinician. Present urgent symptoms with appropriate non-diagnostic guidance to seek medical care, rather than an AI-approved training continuation.

### 6.8 Professional dashboard templates

All professional dashboards share: client/athlete queue, priorities, assignment status, consent visibility, communication, and review actions. Differentiate professional notes from athlete-visible feedback. Show aggregate studio analytics separately from client health data.

### 6.9 AI assistant panel

Contextual, collapsible assistant with explicit scope (“Using your past 4 weeks of running and today’s planned workout”). Include citations to first-party records by date and session when possible, uncertainty, and actionable proposal cards. For high-impact actions use an approval dialog and diff. No autonomous sharing of private data.

## 7. FORM visual design system (logo-derived)

The authoritative brand specifications and implementation-ready tokens live in [`12-form-brand-design-system.md`](12-form-brand-design-system.md) and [`form-design-tokens.css`](form-design-tokens.css). The original supplied SVG is included as [`assets/FORM-gradient-transparent.svg`](../../assets/FORM-gradient-transparent.svg). This section summarizes application requirements; do not interpret the seven logo colors as seven competing UI accent colors.

### 7.1 Brand and UI philosophy

**FORM — FIND YOUR FORM.** The supplied vector wordmark has a transparent background and a left-to-right seven-stop gradient: deep blue `#2F4F93`, blue `#2E78D2`, violet `#6B55B2`, berry `#B4467B`, orange `#E2764E`, gold `#B1A25F`, teal `#28A59C`. Maintain these exact stops and positions when reproducing the *brand* gradient.

Use a technical, calm, performance-oriented interface with excellent numerical readability. Favor off-white and deep-navy neutral surfaces. Choose accessible solid blue for primary interface actions; reserve the full spectrum for the logo, selected marketing surfaces, major celebrations, and restrained emphasis. **Do not use the gradient as a default background for dense dashboards, health data, text blocks, or chart series.**

### 7.2 Color modes and semantics

Define independent light and dark semantic tokens for background, surface, raised surface, foreground, muted foreground, border, primary, primary hover, focus, links and semantic statuses. Gradient stop colors are brand constants; they are **not** substitutes for success/warning/error semantic colors. Visual states must use labels, icons, pattern or position in addition to hue. The CSS token file provides an initial implementation, subject to automated contrast verification at component level.

### 7.3 Typography, shape and spacing

Use a neutral modern sans-serif (system UI fallback); tabular numerals for timers, pace, HR, load, wattage and nutrition values; a 4px spacing scale; modest 8–16px radii; very limited elevation; and 44–48px target heights for action-heavy workout contexts. Large countdowns must remain legible in motion and sunlight. Use a clearly differentiated scale for page headings, section headings, body, labels and data captions.

### 7.4 Layout and core components

- Athlete mobile navigation: Today, Train, Plan, Insights, Profile; domain screens are discoverable from there.
- Professional desktop: role/organization switcher, client roster, review queue, individual workspaces and explicit patient/athlete context.
- Primary buttons use a solid accessible brand color; destructive actions always use semantic danger styling, never gradient.
- Cards and charts use neutral backgrounds and consistent semantic data-series palettes; one accent per chart series, labeled clearly.
- Reusable components: workout builder, exercise rows, player/timer, metric cards, nutrition log, rehab status, goal progress, calendar, agent suggestion with before/after diff, consent controls, and role-switch header.
- Brand gradient may accent a selected progress summary or onboarding graphic, but not communicate clinical risk or progress certainty.

### 7.5 Inclusive interaction and visual QA

Target WCAG 2.2 AA: 4.5:1 normal text, 3:1 large text and relevant controls/graphics; verify effective composited colors in light/dark themes. Support reduced motion, keyboard navigation, visible focus, screen readers, German/English localization, high zoom and health-data privacy blur. Audit gradient combinations separately; text on a multi-stop gradient is prohibited unless a verified contrast-safe overlay/surface is supplied.

### 7.6 Brand consistency across roles

All five roles (athlete, coach, physiotherapist, nutrition professional, studio administrator) share FORM's identity, spacing and components. Their *navigation, permissions and information density* differ; do not assign gradient colors to roles because hue should never imply permission level or clinical authority.

## 8. Frontend technical architecture

### 8.1 Recommended structural approach

Use a **TypeScript-based web frontend** with a shared component library. A modern framework such as React with a suitable application framework can support athlete and professional workspaces. A companion mobile app may be introduced where native HealthKit access, background sync, watch connectivity, and workout-specific controls are required; web alone cannot replace every native integration.

Suggested monorepo boundaries (implementation choice, not required stack):

```text
apps/
  athlete-web/
  professional-web/
  studio-web/                 # May initially be routes in professional-web
  mobile/                     # Optional dedicated native/cross-platform app
packages/
  ui/                         # Design-system components and tokens
  domain-workout/             # Shared workout types, parsers and view models
  domain-health/
  domain-nutrition/
  domain-rehab/
  domain-identity-consent/
  api-client/                 # Typed clients and schemas
  charts/
  i18n/
  testing/
```

Prefer a **modular monolith frontend at first** with domain boundaries, not micro-frontends. Split deployments only after a real organizational or release need.

### 8.2 State boundaries

- **Server state:** workouts, sessions, plans, permissions, metrics, messages; cached with invalidation rules and authorization-aware keys.
- **Local UI state:** drawers, filters, editor selection, timer presentation.
- **Offline working state:** explicit session/event drafts with versioning and sync status.
- **Sensitive state:** minimize persistence; never write tokens or protected health details into insecure browser storage.
- **Derived values:** compute presentation-level values from typed source records, never fabricate missing observations.

### 8.3 API integration

Use versioned API contracts, generated typed clients where possible, schema validation at boundaries, request cancellation, retries only for idempotent calls, and correlation IDs for troubleshooting. Respect `403` vs `404`, consent revocation, expired relationships, and optimistic-update rollback.

**Example route families:**

```text
/app/today
/app/workouts
/app/workouts/:id
/app/sessions/:id
/app/calendar
/app/health
/app/nutrition
/app/rehab
/app/goals
/pro/clients
/pro/clients/:id
/pro/reviews
/studio/classes
/settings/privacy
```

### 8.4 AI integration pattern

Agent API returns a **typed proposal** rather than directly mutating production records:

```json
{
  "proposal_id": "prop_123",
  "agent_type": "workout_adaptation",
  "subject_id": "athlete_123",
  "status": "awaiting_approval",
  "summary": "Reduce session duration from 50 to 30 minutes",
  "evidence": [{"type": "workout", "id": "workout_456"}],
  "changes": [{"path": "blocks[1].rounds", "before": 5, "after": 3}],
  "warnings": [],
  "requires_approval": true
}
```

UI states: Requested → Working → Needs clarification → Draft ready → Validation issues → Awaiting approval → Applying → Applied/Failed. Do not claim “saved” when the backend has only accepted a request.

## 9. Role, tenant, and consent UX

- A global **workspace switcher** separates personal account, coach team, physio practice, nutrition practice, and studio organization.
- Show identity of **who is viewing whose data and why** in client context.
- Support per-category grants for training, nutrition, wearable/health, rehab, video, and messages, including purpose, expiration, and revocation.
- Separate roles: a studio admin may manage attendance without seeing medical records; a coach may see session adherence without seeing diet history unless granted.
- Consent prompt explains intended use, precise access, recipient, duration, and how to revoke.
- Enforce rules in APIs and database authorization, not just conditional frontend rendering.
- On revocation, invalidate active views/caches and prevent new accesses; retained records and deletion obligations follow applicable policy and law.
- Professional credentials and licensure claims require verification flows where product features depend on that status.

## 10. Accessibility and inclusion

Target **WCAG 2.2 AA** for web experience and equivalent accessible mobile behavior. Test keyboard navigation, logical focus order, visible focus, form labels and instructions, error announcement, screen reader structure, input modality parity, reduced motion, localization expansion, units and number formats, adequate target sizes, and charts with readable summaries. Timer alerts must have visual equivalents; sound must be optional.

Test with real users including athletes operating a workout timer under exertion, coaches managing long rosters, and users with motor or visual limitations.

## 11. Reliability, performance, and security UX

### Performance budgets (initial product targets, not guarantees)

- Track Core Web Vitals by route and device; use contemporary thresholds as measured, not assumed.
- Minimize critical-path JS on athlete Today and Workout Player.
- Virtualize large rosters/history tables, lazy-load rich charts and AI panels.
- Avoid polling every second when local timer math is sufficient; synchronize authoritative timestamps.
- Render useful skeletons, contextual error states, and an explicit retry path.
- Instrument session startup time, logging latency, sync failures, and crash-free sessions.

### Security requirements

- CSP and output encoding for user-entered workout notes, professional comments, and AI messages.
- Secure authentication/session controls, CSRF protection where applicable, safe link handling.
- No analytics SDK receiving raw health notes, video, nutritional records, or protected identifiers by default.
- Prevent cross-tenant data leaks through route guards **and backend enforcement**.
- Signed/authorized media access, short-lived upload permissions, virus/file validation on backend.
- Explicit deletion/export interface; avoid misleading “Delete” actions that only hide records.
- Audit-sensitive actions (record sharing, clinician plan approval, bulk studio export).

## 12. Empty, exceptional, and edge states

Design explicit experiences for: no workout scheduled; no wearable connected; wearable connected but stale; health permission denied/revoked; partial nutrition day; missing HRV; conflicting duplicated imports; offline workout; concurrent professional edits; assignment changed mid-session; expired practitioner relationship; clinically sensitive AI output requiring review; unknown exercise; device time zone mismatch; failed media upload; access revoked while page is open.

These are product flows, not merely technical errors.

## 13. Analytics and success criteria

| Outcome | Core measure | Supporting measures |
| --- | --- | --- |
| First-use activation | First workout successfully logged | Onboarding completion, time to first action |
| Athlete engagement | Weekly sessions recorded | Calendar adherence, optional check-ins |
| Tracking quality | Correctly saved session/food logs | Corrections, sync backlog, incomplete entries |
| Professional efficiency | Time to assign/review a plan | Work queue age, bulk action error rate |
| AI usefulness | Accepted proposals with low rework | Dismissal, correction, validation failure |
| Trust | Consent comprehension and successful revocation | Privacy support tickets, access errors |
| Accessibility | Critical flow completion with assistive technology | Accessibility defects and remediation time |
| Reliability | Successful workout completion and sync | Crash rate, failed sync rate, response latency |

Avoid optimizing only for time spent in app or engagement when that increases athlete burden.

## 14. Implementation roadmap aligned to stages 1–5

### Stage 1 — Athlete Intelligence Foundation

**Deliver:** shared UI kit and tokens; authentication, role/org switcher, athlete profile, consent center, Today view, workout library/detail, player, basic logging, typed API layer, offline session drafts, professional client shell.  
**Acceptance:** an athlete can complete and record a workout; a coach can access only approved athlete records; revocation is reflected promptly; all primary flows are keyboard usable.

### Stage 2 — Recovery & Readiness

**Deliver:** wearable connection UX, health metric cards, provenance and freshness labels, self-reported recovery check-in, baseline visualizations, readiness insights with uncertainty.  
**Acceptance:** imported vs estimated vs self-reported data are visibly distinct; missing or stale data never produce misleading certainty; consent controls work.

### Stage 3 — AI Coaching

**Deliver:** contextual assistant, source-aware answers, proposal previews and diffs, AI job states, approval flow, activity/audit history.  
**Acceptance:** no AI proposal changes a user or clinical plan without configured approval; tool failures are recoverable; generated content is clearly identified.

### Stage 4 — Goal & Progress

**Deliver:** goal setup, milestones, PRs, trend dashboards, coach review views, nutrition-related goals with appropriate permissions, plan-vs-actual comparisons.  
**Acceptance:** every chart shows units, timeframe, and data availability; progress reflects real recorded sessions; shared goals have explicit ownership.

### Stage 5 — Movement Analysis

**Deliver:** consent-driven video capture/upload, preprocessing status, playback with annotations, technique feedback drafts, professional review workflow, retention controls.  
**Acceptance:** no video is viewable without permission; feedback is not presented as diagnosis; processing errors and low-confidence analysis are visible.

### Parallel professional capability track

- **Coach:** roster and workout assignment in Stage 1; AI summaries Stage 3; progress reviews Stage 4.
- **Physiotherapist:** rehab plan and permissioned monitoring from Stage 1 foundations; professional review at Stages 3–5.
- **Nutrition professional:** client permissions and food log review with nutrition module; AI drafts and goal tracking as later capabilities.
- **Studio:** organization switcher, class roster and schedule as standalone operations track, without requiring health access.

## 15. Delivery approach

**Phase A — Discovery:** interview five role groups; validate top jobs and sensitive sharing expectations; prototype athlete Today, workout player, and professional client context.

**Phase B — Design system:** tokens, component library, states, responsive grid, accessibility rules, localization foundations, documentation.

**Phase C — Vertical slices:** ship one complete flow at a time (schedule → execute → save; professional assign → athlete complete → professional review), including backend authorization and telemetry.

**Phase D — Data-rich modules:** add health, nutrition, rehab, and progress views as self-contained modules integrated with existing identity/permissions.

**Phase E — AI and advanced analysis:** add proposals, review, video processing, and agent orchestration after deterministic user flows are reliable.

## 16. Definition of done for every frontend feature

- Role and consent behavior documented and tested.
- Loading, empty, error, offline, and unauthorized states designed.
- Mobile and desktop breakpoints verified.
- Keyboard and screen-reader paths verified; contrast evaluated.
- API contract and validation schema versioned.
- Optimistic updates reconcile or roll back correctly.
- Sensitive data excluded from inappropriate analytics/logging.
- Instrumentation and acceptance criteria implemented.
- Human review available for clinical or significant personalized AI changes.

## 17. Key risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Overcrowded feature set | Role-specific workspaces, progressive disclosure, user-tested IA |
| Inconsistent UX across domains | Single design system and shared data/interaction primitives |
| Excessive AI dependence | Functional manual flows first; drafts and approval patterns |
| Health privacy leakage | Scoped consent UX plus server-side enforcement and audits |
| Unreliable device sync | Source/freshness indicators, deduplication, offline queue and reconciliation |
| Misleading performance or recovery claims | Units, comparisons, data quality indicators, cautious language |
| Multi-role complexity | Explicit workspace switcher and relationship context |
| Mobile web limitations | Native companion where device capabilities require it |

## 18. Recommended first clickable prototype

Create **six realistic views** before expanding the UI surface:

1. Athlete Today dashboard.
2. Workout detail + structured block preview.
3. Workout Player with timer and session logging.
4. Professional client dashboard with consent scope.
5. Nutrition day diary + food entry.
6. Recovery/health trends with source and freshness metadata.

Test these with both personal athletes and at least one user from each professional role. Prioritize improvements to clarity, completion speed, and trust rather than visual novelty.

---

### Relationship to the wider blueprint

This frontend plan builds on the platform master plan, multi-role permissions, stages 1–5 (Athlete Intelligence Foundation, Recovery & Readiness, AI Coaching, Goal & Progress, Movement Analysis), API/data contracts, and the Nutrition Professional Workspace. The backend remains responsible for identity, permissions, validation, persistence, agent execution, and audit enforcement.
