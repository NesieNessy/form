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
- [x] Body measurements (weight, body fat) can be entered since Step 4.
## Step 3 — First AI workflows: Import and Adaptation

Source: [workout_ai_agents_concept.md](concepts/workout_ai_agents_concept.md)

- [x] One server-side entry point for all AI workflows: the `assistant` edge function (`supabase/functions/assistant`). The pipelines themselves live in `lib/ai` and are bundled into the function, so the server runs the same validator, catalog matching and change list as the app.
- [x] Identity and logging: the function reads the athlete's data with the athlete's own token (row-level security applies), and writes one `agent_runs` row per request with every step, the model, token counts and duration. It logs sizes and codes, not the athlete's text.
- [x] Proposal record (`agent_proposals`): the draft, the computed change list, the validator's verdict, open questions, notices, pending state and a seven-day expiry. Clients cannot create or edit one.
- [x] Workout Import from pasted text or a photo. The original text is kept with the draft; missing values stay empty and become questions for the athlete; a draft with gaps cannot be saved.
- [x] Workout Adaptation for equipment, time, difficulty, volume and a free note, with a change list computed in code and the model's reasons shown beside it. Approving creates a new version for that calendar entry; the old version stays in the history.
- [x] Approval screen showing the differences. Approval is re-checked on the server (undecided, unexpired, valid, and still based on the current version) and the workout is saved through the normal validated path.
- [x] Evaluation set (`evals/cases.ts`, `npm run eval`): 16 cases across CrossFit, strength, running, triathlon, yoga and HIIT, plus missing values, text that tries to instruct the assistant, non-workouts and medical requests. Graded by code. Last run: 16/16 cases, 82/82 checks.

Safety gates: a note that describes a medical situation (surgery, a tear, chest pain and similar) is turned away before any model is called. A note that mentions soreness or pain is adapted, with a fixed notice that the result is not medical advice.

Left over from Step 3:

- [ ] PDF import. The server accepts PDFs; the app has no file picker for them yet.
- [ ] The red-flag word list and the wording shown to the athlete are placeholders. They need review by a qualified clinician (Step 8).
- [ ] The evaluation set is small (16 cases) and English only. Grow it from real imports that needed correction.
- [ ] Photo import and the review screens are verified in a desktop browser, not on a phone.
- [ ] Cost: about 2 to 5 cents per request on Claude Opus 5.5. The only spend control is 20 requests per athlete per hour; there is no per-account budget yet.
- [ ] Drafts are created online only. Reviewing or approving one also needs a connection.
## Step 4 — Health and wearables

Source: [health_wearable_integration_concept.md](concepts/health_wearable_integration_concept.md)

- [x] Tables (migration `0006_health_data.sql`): `external_activities` (one recorded activity, its summary, quality flags and a downsampled heart-rate series) and `health_observations` (single measurements). Row-level security as for workouts; both are in the data export. Sessions gained the entry mode `import`.
- [x] Every observation stores unit, observed time, the athlete's local day, ingested time, provider, origin (entered, measured, estimated), device and measurement method. HRV without its method (RMSSD or SDNN) is refused, by the app and by the database.
- [x] File import (FIT, TCX, GPX) and manual entry. Parsing runs on the device (`lib/health/parse.ts`; FIT through Garmin's official SDK), files up to 25 MB. Gaps, missing heart rate, implausible GPS jumps and short recordings are flagged and shown, never filled in.
- [x] Idempotent ingestion: an activity's id comes from its content, so the same file twice is one record (and the database enforces it per athlete and provider). Possible duplicates from a second device are pointed out; only the athlete decides, and the decision can be undone.
- [x] Matching imported activities to planned workouts: same sport family within the day, "likely" within an hour. Recording an activity as the result completes the planned workout with the real duration and, for a single continuous block, the distance. A structured workout is marked done without inventing per-block scores. An unplanned activity can be logged as its own workout with no made-up targets.
- [x] Baseline engine (`lib/health/logic.ts`, `baseline_v1`): median and median absolute deviation of one value per day over 28 days, needing 7 days; the day being judged is excluded and HRV methods are never mixed. Without a baseline the app says how many days are missing instead of comparing. Body Development shows real weight and body-fat trends when there are measurements.
- [x] Source deletion: everything from one source can be deleted. The workout results already recorded stay; on the server a deleted row keeps only a tombstone for other devices, its values, series and file details are erased.
- [x] Sharing: the `wearable_raw` category is now available ("Health measurements"). A professional with that grant sees 90 days of measurements and activity summaries, never the raw series or file details, and every read is logged.

Left over from Step 4:

- [ ] Apple Health connector: needs an iOS development build (not Expo Go) and per-category permission texts. The data model already has the provider and origin for it.
- [ ] Garmin connector: apply to the Garmin developer program; build it once access is granted.
- [ ] No `wearable_connection` or `device` tables yet: they only matter with a live connector. Daily summaries and baselines are computed on the device, not stored (`daily_health_summary`, `athlete_baseline`), so the `wearable_summary` sharing category stays unavailable.
- [ ] Imported activities are summaries plus one heart-rate series. Laps, GPS tracks and power curves are not kept.
- [ ] Time zones: an activity's day comes from the device's current time zone, so a run recorded while travelling can land on a different day than the athlete expects.
- [ ] Verified in a desktop browser; file picking on a phone has not been tried.

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
