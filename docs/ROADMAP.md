# FORM Implementation Roadmap

This is the build order for FORM, derived from the concept documents in [concepts/](concepts/). Tick items off as they land.

The order follows three rules taken from the concepts: finish a reliable workout core and the permission foundation first, build deterministic logic before any AI on top of it, and serve the individual athlete before the professional roles.

## Where the code started (October 2026)

Before Step 1, FORM was an Expo / React Native app with a workout creation wizard, presets, and trend, goal and insight screens running on sample data. Workouts lived on the device only, there was no sign-in, and the workout type had no versions, no planned-versus-completed split and no nesting. Steps 1 and 2 replaced all of that; the leftover code from that stage was removed after Step 2.

## Step 0 — Decisions to make before coding

Recorded in [DECISIONS.md](DECISIONS.md).

- [x] Workout player or library only? **Player.**
- [x] Backend shape: **row-level security plus database functions**; Edge Functions arrive with Step 3.
- [x] Is offline session logging in the first release? **Yes, local-first with background sync.**
- [ ] Physiotherapy scope: wellness coordination only, or intended medical use (triggers medical-device regulation). *Open; needed before Step 8.*
- [ ] Launch country, hosting region, and pricing model. *Open; needed before Step 2 ships to real users.*

## Step 1 — Workout Core

Source: [workout_data_model_concept.md](concepts/workout_data_model_concept.md), [workout_ai_agents_concept.md](concepts/workout_ai_agents_concept.md) (Phase 1)

- [x] Sign-up, sign-in and session handling with Supabase Auth. With no Supabase project configured the app runs in local mode without sign-in.
- [x] Real schema: `workouts`, `workout_versions`, `blocks`, `steps`, `activities`, `scheduled_workouts`, `sessions`, `session_results` (`supabase/migrations/0002_workout_core.sql`).
- [x] Four-level model (workout, block, step, prescription), with block purpose separate from block format (`lib/workout/model.ts`).
- [x] Six core formats plus nested repeating groups, in the model, validator, database and player.
- [x] Canonical exercise catalog, in the app and seeded into the database from the same source.
- [x] Deterministic validator in the app (`lib/workout/validate.ts`) and a matching publish check in the database.
- [x] Workout versioning with draft, published and archived states.
- [x] Planned and actual kept separate; a completed session stores a snapshot of what was prescribed.
- [x] Wizard workouts saved to the local store and synced to Supabase (`lib/sync`).
- [x] Workout player with device-clock timers, live result entry and scoring; plus logging results after the fact.
- [x] Training calendar for planned and completed sessions; reusable templates.
- [x] Home, Trends (strength, endurance), Performance Overview and Insights computed from real sessions.

Left over from Step 1:

- [x] Migration applied to the live Supabase project; sign-in and two-device sync (including deletes) verified against it.
- [ ] Run the player on a physical iOS and Android device (screen stays awake, haptics, backgrounding). Verified so far in a desktop browser only.
- [ ] The wizard cannot yet build nested groups or edit a saved workout; both exist in the model (`reviseWorkout`) without a screen.
- [ ] An "approved" state between draft and published is not modelled; it arrives with AI proposals in Step 3.
- [ ] Body weight, body fat, the FORM score, goals and the comparison screen still show sample values, labelled as such. They need body-measurement entry (not built yet) and the goal model (Step 10).
- [ ] Sync pulls everything on each run; add incremental pull before data grows past a thousand rows per table.

## Step 2 — Athlete Intelligence Foundation

Source: [03-stage-1](concepts/03-stage-1-athlete-intelligence-foundation.md), [02-multi-role-access](concepts/02-multi-role-access-and-business-model.md), [09-api-and-data-contracts](concepts/09-api-and-data-contracts.md)

- [x] Athlete profile: sports, equipment, usual training days, weekly target, and benchmarks (1RM, FTP, threshold and CSS pace, max heart rate) with date and source. A workout prescribing a percentage of 1RM suggests the load from the newest benchmark.
- [x] Data categories: a registry of 13 categories, five of them available today (profile, benchmarks, workout plans, session results, performance summary). The rest switch on as their modules arrive.
- [x] Consent model: one grant per recipient, athlete, category, purpose, operation and expiry; deny by default; withdrawn grants are kept as a record.
- [x] Enforcement in the database: other people read an athlete's data only through `get_shared_context()`, never through the tables.
- [x] Append-only audit log and a "Who accessed your data" list in the app.
- [x] Event outbox (`WorkoutScheduled`, `WorkoutCompleted`, `DataGrantCreated`, `DataGrantRevoked`, `RelationshipEnded`, `AthleteBenchmarkUpdated`) carrying IDs only.
- [x] Organization, membership and professional-relationship tables. Membership grants no data access.
- [x] Notifications: in-app inbox, per-category mute and quiet-hours settings.
- [x] Data export (one file) and account deletion (removes every row, ends every connection).
- [x] Negative-access tests: no relationship, no grant, revoked grant, expired grant, ended relationship, guessed IDs, another professional, a studio owner, signed-out callers.

Verified against the live project with temporary athlete and coach accounts, and in local mode.

Left over from Step 2:

- [ ] Push delivery. Notifications are in-app only; quiet hours are stored but nothing is pushed yet, so they have no effect so far.
- [ ] Invitations are passed on as a code by the athlete. The app sends no email.
- [ ] The professional side is a single read-only page. The real coach workspace is Step 6.
- [ ] Nothing consumes the event outbox yet; the first consumers arrive with Step 3.
- [ ] Organizations have tables and access rules but no screens (Step 11).
- [ ] Consent wording (`consentV1` in `lib/strings.ts`) and the retention of audit records after account deletion need legal review before real users. Guardian consent for minors is not modelled.
- [ ] Body measurements (weight, body fat) still cannot be entered.
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
