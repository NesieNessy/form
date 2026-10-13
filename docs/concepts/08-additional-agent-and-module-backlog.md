# Additional Agents, Platform Modules and Delivery Backlog

This backlog captures ideas beyond the five principal expansion stages. It is deliberately separated so a roadmap does not become a collection of poorly governed autonomous agents.

## 1. Additional AI capability backlog

| Capability | User value | Dependencies | Priority | Delivery strategy |
|---|---|---|---|---|
| Adaptive Scheduling Agent | Reschedule missed training around availability and load | Calendar, planning, recovery, approvals | P1 | Extend planning tools; no separate runtime at first |
| Race Preparation & Pacing Agent | Race-specific pacing, taper discussion and fueling plans | Goal, benchmarks, event context, nutrition | P2 | Rules + planning + narrative |
| Habit & Motivation Agent | Sustainable routines and athlete-selected reminders | Notification preferences, goals, adherence | P2 | Behavior-safe templates with limited model explanations |
| Coach & Athlete Management Agent | Summaries across consented rosters, review queues, comments | Coach relationships, scoped analytics, team permissions | P1 for coach launch | Read-only summary first; assignments require approval |
| Workout Import Agent | Convert text, PDFs, screenshots into canonical workouts | Workout Core, extraction, catalog, validator | P0 | Structured extraction workflow |
| Workout Adaptation Agent | Equipment/time/level substitutions | Workout Core, exercise alternatives, guardrails | P0 | Draft + validation + user approval |
| Workout Generation Agent | Sport-specific structured workout drafts | Templates, catalog, validation | P1 | Controlled retrieval + generation |
| Training Planning Agent | Multi-day training schedule | Calendar, goals, sessions, constraints | P1/P2 | Planner + model explanations |
| Workout Analysis Agent | Performance insight and comparisons | Correct historical metrics | P2 | Deterministic computation + explanation |
| Nutrition Assistant(s) | Meal logging, training fueling, plan changes | Food database, nutrition intake and preferences | P1/P2 | Separate ingestion from recommendation |
| Rehab Support Assistant(s) | Adherence summary, limited modification suggestions | Rehab case, therapist restrictions, oversight | P2 | Human authorization for clinical changes |
| Security Agent | Incident triage, suspicious behavior explanations | Logs, IAM, audit, security rules | P0 platform guardrail | Read-only initially |
| Performance Agent | API/sync/AI bottleneck triage | Telemetry, tracing, SLOs | P0 platform guardrail | Read-only initially |

P0/P1/P2 denote product intent, not a calendar commitment. A product may expose many AI capabilities through one secure orchestration layer rather than many independent agents.

## 2. Non-agent feature backlog

### Athlete essentials (early)
- Exercise Library with units, apparatus, variations and sport taxonomies.
- Workout Player with AMRAP, EMOM, intervals, GPS/distance, rest timer, live logging and offline sync.
- Training Calendar for planned/actual sessions and blocks.
- Athlete Profile, benchmark history, equipment inventory, multiple sports and preferences.
- Nutrition logger, hydration, meal templates and recipe import.
- Wearable connection status, sync freshness and correction workflows.

### Collaboration and business (professional rollout)
- Coach roster and delegated staff access; session assignments, feedback and attendance.
- Physio clinical-review workflow, case segmentation, secure review notes, discharge/transition steps.
- Studio locations, class bookings, check-in/attendance, space/equipment management, staff scheduling, optional memberships/payment integration.
- Structured messaging, notifications, professional task inbox and athlete consent center.
- Organization billing, seats, invoices, plan entitlements, usage governance.
- Workout sharing with version pinning and revocable publication links.

### Community and advanced experiences (later)
- Optional athlete group challenges and leaderboards with visibility controls.
- Competitions/events and verified results.
- Route/race planning and multi-sport transitions.
- Class programming templates and shared exercise libraries.
- Athlete-selected habit support and streaks without shame or unsafe escalation.
- Aggregated studio insights with minimum cohort sizes and no sensitive individual health leakage.

## 3. Cross-cutting infrastructure backlog

| Service | Essential contract |
|---|---|
| Consent & permission service | Central policy; purpose, data category, operation, expiry, recipient; deny by default |
| Data provenance service | Source app/device, raw vs derived, measurement method, captured and imported timestamps |
| Event bus & outbox | Idempotent delivery, event schema versions, no raw medical payloads by default |
| Agent evaluation harness | Golden cases, denial tests, health safety cases, regression metrics |
| Agent tool gateway | Per-user and per-organization authorization, tool ACLs, approval gates |
| Notifications | Clear event categories, quiet hours, athlete preferences, delivery logging |
| Offline sync | Local queue, replay safety, conflict resolution, deletion propagation |
| Feature flags | Safe staged rollout by cohort/tenant/role |
| Audit & lineage | Who accessed or changed what and why, model/proposal lineage, immutable audit data |
| Billing & entitlements | Athlete plans, professional seats, studio location capacity; never substitute for consent |
| Export / deletion | Clear athlete export and legitimate deletion workflows across connected data |
| Observability | Performance indicators, safe telemetry, AI costs, sync failures and security signals |

## 4. Suggested sequencing by persona

| Milestone | Athlete | Coach | Physiotherapist | Studio |
|---|---|---|---|---|
| Foundation | Record workouts, connect wearables, consent | Invite, assign, review shared results | Join a care relationship, limited view | Org membership skeleton |
| Recovery | Private daily recovery insights | Opt-in summary | Rehab-aware summary on explicit grant | No member recovery view |
| Coaching | Ask AI coach and accept drafts | AI-assisted review and planning | Summarize rehab adherence for review | AI-supported class programming |
| Goals | Personal KPI timeline | Shared client milestones | Professional functional checkpoints | Optional group challenge aggregates |
| Movement | Video self-review | Timestamped coaching feedback | Reviewed video in authorized case | Class footage only under explicit policy |

## 5. Business and adoption risks

1. **Too many agents:** increases costs, unpredictability, permission complexity and inconsistent advice. Mitigate with a common tool layer and evaluations.
2. **Clinical overreach:** avoid product claims implying medical diagnosis, treatment or clearance without specialist design and regulation review.
3. **Incomplete wearable data:** make data freshness, missingness and device limitations visible.
4. **Coach/studio relationship collisions:** permissions must attach to concrete relationship and purpose, not just organization membership.
5. **Low coach adoption:** prioritize workflows that save review time instead of introducing mandatory AI conversations.
6. **Food logging fatigue:** support repeat meals and quick capture, with a low-friction non-AI pathway.
7. **Video privacy risk:** narrow MVP movements, explicit consent, short retention and source-scoped access.

## 6. Release quality checklist

For every feature require an owner, scope, access policy, action risk classification, data retention, analytics instrumentation, evaluation cases, accessibility review, localization needs, fallbacks, rollout flag and rollback plan.
