# FORM Implementation Roadmap

This is the build order for FORM, derived from the concept documents in [concepts/](concepts/). Tick items off as they land.

The order follows three rules taken from the concepts: finish a reliable workout core and the permission foundation first, build deterministic logic before any AI on top of it, and serve the individual athlete before the professional roles.

## Starting point (October 2026)

FORM is an Expo / React Native app with a Supabase client. It has a workout creation wizard, workout detail, presets, and trend, goal and insight screens.

- Workouts are client-side only (`lib/workoutsStore.ts`); the `workouts` table in `supabase/schema.sql` holds only a date and a completed flag.
- Most screens fall back to mock data (`lib/api.ts`, `lib/mockData.ts`).
- There is no sign-in flow, although row-level security already assumes a signed-in user.
- The workout type in `lib/types.ts` has sections and exercises, but no versions, no planned-versus-completed split, and no nesting.

## Step 0 — Decisions to make before coding

- [ ] Workout player or library only? This shapes the schema; the rest of the concepts assume athletes execute workouts in the app.
- [ ] Backend shape: row-level security plus Edge Functions, or a separate API, for server-side authorization and validation.
- [ ] Is offline session logging in the first release?
- [ ] Physiotherapy scope: wellness coordination only, or intended medical use (triggers medical-device regulation).
- [ ] Launch country, hosting region, and pricing model.

## Step 1 — Workout Core

Source: [workout_data_model_concept.md](concepts/workout_data_model_concept.md), [workout_ai_agents_concept.md](concepts/workout_ai_agents_concept.md) (Phase 1)

- [ ] Sign-up, sign-in and session handling with Supabase Auth.
- [ ] Real schema: `workouts`, `workout_versions`, `blocks`, `steps`, `activities`, `scheduled_workouts`, `sessions`, `session_results`.
- [ ] Migrate types to the four-level model (workout, block, step, prescription), with block purpose separate from block format.
- [ ] Six core formats: `for_time`, `amrap`, `repeating_interval`, `sets_reps`, `continuous`, `sequence`, plus nested repeating groups.
- [ ] Canonical exercise catalog table with units, equipment and sport tags.
- [ ] Deterministic validator (schema, block logic, units, exercise references), callable from app and server.
- [ ] Draft, approved, published lifecycle and workout versioning.
- [ ] Planned and actual kept separate; a completed session stores a snapshot of what was prescribed.
- [ ] Persist wizard workouts to Supabase.
- [ ] Workout player: local timers that survive connection loss, live result entry, scoring (time, rounds plus reps, load, distance).
- [ ] Training calendar for planned and completed sessions.
- [ ] Replace mock data on trends, goals and insights screens with numbers computed from real sessions.

## Step 2 — Athlete Intelligence Foundation

Source: [03-stage-1](concepts/03-stage-1-athlete-intelligence-foundation.md), [02-multi-role-access](concepts/02-multi-role-access-and-business-model.md), [09-api-and-data-contracts](concepts/09-api-and-data-contracts.md)

- [ ] Athlete profile: sports, equipment, availability, benchmarks (FTP, 1RM, threshold pace) with date and source.
- [ ] Data categories as separate tables, not one profile blob: training, health, nutrition, rehab, video, notes.
- [ ] Consent model: `data_share_grant` scoped by recipient, athlete, category, purpose, operation and expiry; deny by default.
- [ ] Grants enforced in row-level security and server functions, never only in the UI.
- [ ] Append-only audit log and a "who accessed my data" screen.
- [ ] Event tables and outbox (`WorkoutScheduled`, `WorkoutCompleted`, `DataGrantRevoked`, …) carrying IDs only.
- [ ] Organization, membership and professional-relationship tables as a skeleton.
- [ ] Notifications with quiet hours and preferences.
- [ ] Data export and deletion flows.
- [ ] Automated negative-access tests: revoked grant, expired grant, guessed IDs, cross-tenant reads.

## Step 3 — First AI workflows: Import and Adaptation

Source: [workout_ai_agents_concept.md](concepts/workout_ai_agents_concept.md)

- [ ] One server-side AI orchestration service with per-workflow tool permissions, not separate agents.
- [ ] Tool gateway carrying user identity and consent scopes, logging every call.
- [ ] Agent proposal record: changes as a diff, validation result, pending-approval state, expiry.
- [ ] Workout Import: text first, then screenshots and PDFs; editable draft that keeps the original source and flags ambiguity instead of inventing values.
- [ ] Workout Adaptation: equipment, time, difficulty and volume changes, with a change list and approval before saving a variant.
- [ ] Approval UI showing the diff.
- [ ] Evaluation set per sport: format classification, number extraction, exercise matching, prompt injection from workout text.

## Step 4 — Health and wearables

Source: [health_wearable_integration_concept.md](concepts/health_wearable_integration_concept.md)

- [ ] Tables: `wearable_connection`, `device`, `health_observation`, `health_series`, `external_activity`, `session_match`, `daily_health_summary`, `athlete_baseline`.
- [ ] Every observation stores unit, observed time, ingested time, source, quality flag and measurement method.
- [ ] Apple Health connector in the iOS app with per-category permission reasons (needs a development build, not Expo Go).
- [ ] File import (FIT, TCX, GPX) and manual entry as fallback.
- [ ] Idempotent ingestion and de-duplication, with user confirmation for ambiguous matches.
- [ ] Matching imported activities to planned sessions.
- [ ] Apply to the Garmin developer program early; build the connector once access is granted.
- [ ] Baseline engine with minimum-sample rules and versioned calculations.
- [ ] Disconnect flow that stops syncing and runs the retention/deletion path.

## Step 5 — Nutrition

Source: [nutrition_training_tracking_concept_en.md](concepts/nutrition_training_tracking_concept_en.md)

- [ ] Food catalog with nutrients, serving definitions and source; unknown stays `null`, never zero.
- [ ] Food, fluid and recipe logging: search, manual entry, quick-add, saved meals.
- [ ] Deterministic totals engine with a logging-coverage indicator.
- [ ] Daily dashboard with a calorie-free view option.
- [ ] Fuel events linked to workout sessions.
- [ ] AI: natural-language meal parsing into drafts, barcode scan, later photo estimates.
- [ ] Training-aware targets (as ranges), fueling plans and weekly plan drafts, all requiring approval.
- [ ] Safety rules for extreme restriction requests and medical contexts.

## Step 6 — Coach beta

Source: [02-multi-role-access](concepts/02-multi-role-access-and-business-model.md), [08-backlog](concepts/08-additional-agent-and-module-backlog.md)

- [ ] Invite and accept flow with a data-sharing checklist.
- [ ] Coach workspace: roster, program library, assignment with version pinning, comments.
- [ ] Shared-outcome review limited to granted categories.
- [ ] Relationship termination that removes future access and records an audit event.
- [ ] Read-only AI roster summaries; assignments still need approval.

## Step 7 — Recovery and readiness

Source: [04-stage-2](concepts/04-stage-2-recovery-and-readiness.md)

- [ ] Daily check-in for fatigue, soreness, stress and energy.
- [ ] Recovery insight service combining baseline deviations with check-ins; abstains on sparse or conflicting data.
- [ ] At most a few low-risk options (keep, shorten, reduce intensity, reschedule, rest), each needing athlete approval.
- [ ] Opt-in recovery summary for coaches, never raw readings.
- [ ] No readiness percentage unless calibration and uncertainty are documented.

## Step 8 — Rehabilitation and physio beta

Source: [injury_rehabilitation_return_to_training_concept_en.md](concepts/injury_rehabilitation_return_to_training_concept_en.md)

- [ ] Injury episodes, symptom logs and authored, time-bound restrictions.
- [ ] Deterministic restriction engine and workout conflict detection; the safety and escalation service is rules, not a language model.
- [ ] Rehab plans reusing the workout model, with `null` dosage where the clinician has not specified it.
- [ ] Physio workspace: case-scoped access, plan approval, review notes, return-to-sport decisions recorded by a verified clinician.
- [ ] Narrow "functional restriction" view an athlete can share with a coach, without diagnosis.
- [ ] AI assistants in order: intake documentation, training modification drafts, progress summaries, return-to-training coordination. None may diagnose, clear, or lift a restriction.

## Step 9 — AI coaching chat

Source: [05-stage-3](concepts/05-stage-3-ai-coaching.md)

- [ ] Conversational endpoint routing intents to the existing tools.
- [ ] Workout Generation and Training Planning behind the same draft, validation and approval pipeline.
- [ ] Response contract with citations, proposals, warnings and an approval flag.
- [ ] Confirmation with a visible diff for any calendar or plan write.
- [ ] Memory policy: explicit preferences only, separate from health records, deletable.
- [ ] Evaluations for grounding, permission bypass, cross-tenant leakage and unsafe rehab advice.

## Step 10 — Goals and progress

Source: [06-stage-4](concepts/06-stage-4-goal-and-progress.md)

- [ ] Replace the current `goals` table with the full model: metric, unit, target date, baseline, milestones, visibility, revision history.
- [ ] Deterministic progress calculation with sample size and comparability rules (scaled versus RX, different routes, different FTP protocols).
- [ ] Goal wizard, milestone timeline and periodic review.
- [ ] Shared coach review view; rehab goals completable only by a qualified person.

## Step 11 — Studio beta

Source: [02-multi-role-access](concepts/02-multi-role-access-and-business-model.md)

- [ ] Facilities, class timetables, bookings, attendance, staff scheduling.
- [ ] Memberships, billing and seat entitlements, which never substitute for consent.
- [ ] Aggregated reporting with minimum group sizes; no member health data by default.

## Step 12 — Movement analysis

Source: [07-stage-5](concepts/07-stage-5-movement-analysis.md)

- [ ] Separate consents for recording, model inference and professional sharing.
- [ ] Signed, time-limited upload and download URLs with per-asset access checks.
- [ ] Quality assessment that returns "cannot assess reliably" for poor footage.
- [ ] One or two movements with fixed camera guides (bodyweight squat first).
- [ ] Bounded observation vocabulary with timestamps; no diagnosis or injury prediction.
- [ ] Coach and physio review with attributed annotations.
- [ ] Retention expiry and deletion that propagates to derived data.

## Alongside every step

Source: [performance_security_agents_concept_en.md](concepts/performance_security_agents_concept_en.md), [08-backlog](concepts/08-additional-agent-and-module-backlog.md)

- Observability: redacted logs, traces, service-level targets for workout save and sync, AI cost tracking.
- Operations agents: read-only performance and security assistants, only after that telemetry exists.
- Release checklist per feature: owner, access policy, retention, evaluation cases, accessibility, feature flag, rollback plan.
- Legal review: GDPR roles, special-category data, and the medical-device boundary before any clinical claims.

## Rules that apply everywhere

- AI output is a draft; anything that changes a workout, plan or schedule needs explicit approval.
- Calculations, validation, permissions and writes are ordinary code, not model output.
- Missing data is unknown, never zero; never invent values.
- No diagnosis, medical clearance, or removal of clinician restrictions by AI.
- Roles are not data permissions: access comes from an explicit grant, not from membership.
