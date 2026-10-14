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

- [x] Food catalog with nutrients, serving definitions and source; unknown stays `null`, never zero. A starter list of 48 generic foods ships with the app (`lib/nutrition/catalog.ts`), and athletes add their own from a label (per 100 g, per 100 ml or per serving; energy in kcal or kJ). A test checks every catalog food's energy against its macros.
- [x] Food and fluid logging: search, quick-add (only what is known), saved meals, corrections with a revision count. Each entry keeps a snapshot of the food, so editing a food never rewrites history. Migration `0007_nutrition.sql` adds `foods`, `food_log_entries` and `saved_meals` with row-level security; deleting an entry erases its content on the server.
- [x] Deterministic engine (`lib/nutrition/engine.ts`): portion conversion (grams, millilitres via density, servings), totals that say "at least" when an entry lacks a nutrient, a count of estimated entries, and a 7-day view that averages only the days that were logged.
- [x] Daily view with a calorie-free option ("Hide energy"), stored in the profile so it applies on every device.
- [x] Fuel linked to workout sessions: "Log Fuel" on a workout's results.
- [x] Training-aware targets as ranges (`lib/nutrition/targets.ts`, `targets_v1`): protein 1.2–2.0 g/kg and carbohydrate by the day's planned training (3–5, 5–7, 6–10, 8–12 g/kg) from the ACSM/AND/DC 2016 position statement, scaled to a weight from the last 60 days. No energy target is suggested. Nothing applies until the athlete approves it; manual targets are possible too.
- [x] Safety: a very low energy target is called out with a pointer to a doctor or registered dietitian (not refused); suggestions carry their source and a not-medical-advice notice.
- [x] Sharing: `nutrition_log` (90 days, without notes) and `nutrition_target` are available with their own consent; the profile category no longer carries nutrition settings. Both are in the export.

Left over from Step 5:

- [x] AI meal parsing (`lib/ai/meal.ts`, action `parse_meal`): a sentence becomes draft items. The model only names foods, picks a match from the list it is given (catalog and the athlete's own foods; any other id is dropped), and copies written amounts, marking vague portions as estimates. It never states nutrients; the engine computes them after the athlete has checked every item ("Describe" tab, signed in only). Drafts are not stored; each run is logged (migration `0008_meal_parsing.sql`). Text suggesting disordered eating gets a pointer to support and never reaches the model. Five eval cases (`npm run eval -- meals`): 5/5, 17/17 checks on 2026-10-14.
- [ ] Barcode scan and photo estimates (need a product database and a native build).
- [ ] The support word list and its message are placeholders pending review by a registered dietitian.
- [ ] The starter catalog values are approximate and not verified entry by entry. Check them against USDA FoodData Central or switch to a licensed database before real users rely on them. Regional products and barcodes need such a database too.
- [ ] Recipes (ingredients, yield, portions) and planned fueling for long sessions (plan vs. actual) are not built.
- [ ] The day type comes from planned workouts only; a workout whose blocks state no length uses the usual session length from the profile.
- [ ] Target rules and wording need review by a registered dietitian before real users. Minors, pregnancy and clinical conditions are not modelled; the notice only points elsewhere.
- [ ] Verified in a desktop browser; not tried on a phone.

## Step 6 — Coach beta

Source: [02-multi-role-access](concepts/02-multi-role-access-and-business-model.md), [08-backlog](concepts/08-additional-agent-and-module-backlog.md)

- [x] Invite and accept flow with a data-sharing checklist. Either side can now invite (`invite_athlete`, migration `0009_coach_beta.sql`); the invitee accepts with the code and an account under the invited email. An athlete who accepts a professional's invitation lands on a checklist where every category starts off and sensitive ones are marked.
- [x] Coach workspace (More → Coaching): roster sorted so athletes who need a look come first, invitations, and per athlete: send a workout, see what happened to it, comment. The coach's own workouts and templates are the program library.
- [x] Assignment with version pinning: `workout_assignments` stores the exact version as sent; later edits by the coach do not change it. The athlete accepts it into their own calendar as their own copy (with fresh block and step ids, which the server requires) or declines; nothing is added without accepting (More → From Your Coach). Comments per assignment for both sides.
- [x] Shared-outcome review limited to granted categories: `get_assignment_outcomes` returns the calendar status only with `workout_plan`, the result only with `workout_session`, and logs each read.
- [x] Relationship termination: `end_relationship` now also cancels pending assignments; the coach loses the assignments, comments and outcomes at once, the athlete keeps everything (also in the export).
- [x] Roster summaries are rule-based (`lib/coaching/roster.ts`): sessions in the last 7 days, gaps of a week or more, share of planned workouts done, unanswered and declined assignments, all from what the athlete shares. Reading the summary is logged.

Left over from Step 6:

- [ ] AI-written roster summaries. The rule-based notes cover the facts; a model-written narrative was left out to keep AI spend for a deliberate decision.
- [ ] Program library beyond the coach's own workouts: no shared programs, multi-week plans or bulk assignment to several athletes.
- [ ] Comments on sessions the athlete logged without an assignment, and messaging outside assignments.
- [ ] Notifications are in-app only (no push or email), and invite codes are passed on by hand.
- [ ] Credential checks for professionals, organizations/teams and coach-to-coach collaboration (Step 11).
- [ ] Verified in a desktop browser with two live accounts; not tried on a phone.

## Step 7 — Recovery and readiness

Source: [04-stage-2](concepts/04-stage-2-recovery-and-readiness.md)

- [x] Daily check-in (More → Recovery) for fatigue, soreness, stress and energy on 0–10, each optional, plus "I feel ill, or have pain or an injury". Stored as measurements (migration `0010_recovery.sql` adds the metrics).
- [x] Recovery insight (`lib/recovery/insight.ts`, `recovery_v1`, rules documented in the file): today's resting heart rate, HRV and sleep against the athlete's own baseline, the check-in, and a 7-day training-load jump against the 21 days before. It says "not enough data" without a check-in or a usable measurement, "go by how you feel" when the device and the athlete disagree, and never overrules what the athlete reports. Feeling unwell offers only rest or moving the workout.
- [x] At most three options for today's planned workout (keep, about a third shorter, about 15 % lighter, move to tomorrow, rest). Shorter and lighter are fixed rules; the change list is shown before choosing, and only the choice changes the plan (as a new version, so the old one stays in the history).
- [x] Opt-in recovery summary for coaches: one row per day in `daily_recovery` with the status, which signals pointed where, and what the athlete chose; never values or the check-in. Shared under its own consent category (`recovery_summary`), logged on every read, included in the export.
- [x] No readiness percentage anywhere; the screen says it is not a diagnosis and not a score.

Left over from Step 7:

- [ ] The thresholds in `recovery_v1` are reasoned defaults, not calibrated. Evaluating them needs real data from several sports and devices (and a look at how often they warn too much), and review by a sports scientist or physician.
- [ ] Therapist restrictions do not exist yet, so they cannot take precedence (Step 8).
- [ ] The coach sees the summary in the shared view only as data; the coach screens do not show it yet.
- [ ] Only today is assessed; there is no recovery history view or weekly pattern for the athlete.
- [ ] Verified in a desktop browser; not tried on a phone.

## Step 8 — Rehabilitation and physio beta

Source: [injury_rehabilitation_return_to_training_concept_en.md](concepts/injury_rehabilitation_return_to_training_concept_en.md)

- [x] Injury episodes in the athlete's own words (body region, side, onset, what makes it worse; no diagnosis asked for) and symptom logs (0–10 intensity, optional function score, context, red flags), local-first and synced. Clinician restrictions are authored, scoped to movement kinds, dated and time-bound (migration `0011_rehab.sql`).
- [x] Deterministic restriction engine (`lib/rehab/conflicts.ts`): every catalog exercise has movement tags (a test keeps them complete); a planned workout is checked against the restrictions in force on its date and the athlete's own notes, with exercises outside the catalog listed as unchecked. It warns and can draft the workout without the clashing exercises; nothing changes unless the athlete chooses. Escalation is a rule: any red flag shows "get this checked promptly" and hides exercise suggestions (wording is a placeholder for clinician review).
- [x] Rehab plans on the Workout Core: the physio enters exercises with optional sets, reps and holds; an empty dose stays absent and the athlete is told to ask rather than guess. Versions are kept; the athlete adds sessions to their calendar as their own copies.
- [x] Physio workspace (More → Physio Cases): only cases the athlete shared, one by one (`share_case`), each opening logged. Restrictions, lifting them, plans, review notes; return-to-sport decisions (participation, sport, performance) only by a clinician verified in `professional_verifications`, which only the operator can write, and only with written criteria. The athlete can read all of it and change none of it; ending the relationship closes the cases.
- [x] Coach view "Training limits" (`functional_restriction` category): movement kinds, rule, dates and who set it; never the injury, body part or notes.

Left over from Step 8:

- [ ] AI assistants (intake documentation, restriction-aware modification drafts, progress summaries, return-to-training coordination). Not built, to keep the safety foundation deterministic first. Meanwhile the existing "Adapt This Workout" assistant does not know about restrictions; it should either receive them or be hidden for restricted workouts.
- [ ] Clinician verification has no screen: the operator inserts the row by hand. A real process (registration check per country) is needed before launch.
- [ ] Red-flag list, escalation wording, tag mapping and every rehab text need review by qualified clinicians; regulatory assessment (EU MDR) before any clinical claim.
- [ ] No attachments, functional assessments, phases with milestones, or symptom trend charts yet.
- [ ] Verified in a desktop browser with live accounts; not tried on a phone.

## Step 9 — AI coaching chat

Source: [05-stage-3](concepts/05-stage-3-ai-coaching.md)

- [x] Conversational endpoint (`chat` action of the `assistant` function, More → Ask FORM): a code-controlled tool loop (`lib/ai/chat.ts`, at most six model calls). The tools read only the athlete's own records, through their own token so row-level security applies, and return minimal fields: recent sessions, schedule, one workout, recovery summaries, training limits, nutrition days. There is no open-ended data tool. Dates and times go to the model in the athlete's local time.
- [x] Workout generation and changes go through the existing pipelines: `draft_workout` uses the validated import pipeline and `draft_adaptation` the adaptation pipeline (with the athlete's training limits added), both ending on the existing approval screen. A generated draft that touches a limit carries a warning.
- [x] Response contract `{ intent, answer, citations, proposals, warnings, requires_approval }`; the model must answer through a `respond` tool. Citations are kept only if a tool returned that record in the same turn; the rest are dropped and logged.
- [x] Confirmation with a visible change: a suggested move shows the old and new time and is applied on the device only when the athlete taps "Move It"; drafts open the approval screen with the change list.
- [x] Memory: only preferences the athlete confirms ("Remember this?"), stored apart from health records (`coach_memories`, migration `0012_coach_chat.sql`), never health information (refused by the assistant and the app), listed and deletable. Conversations are stored for context, deletable, and in the export.
- [x] Medical, red-flag and "can I train through this" questions are answered by a rule, without a model, with a pointer to a doctor or physiotherapist.
- [x] Evaluations (`npm run eval -- chats`): grounding, someone else's data, an instruction planted in a workout title, a reschedule proposal, and the injury boundary. 5/5 cases, 17/17 checks on 2026-10-14.

Left over from Step 9:

- [ ] Roles other than the athlete: coach and physio chats over shared data, and studio use.
- [ ] Nutrition actions in the chat (logging a meal, fuel suggestions); it can only read nutrition today.
- [ ] Cost: a chat turn uses roughly 8,000 to 10,000 input tokens on Claude Opus 5.5. There is no per-account budget beyond 20 requests an hour; prompt caching and a smaller model for simple questions are worth trying.
- [ ] No streaming: the answer appears when complete (about 5 to 15 seconds).
- [ ] The evaluation set is small and English only.

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

## Step 13 — A polished frontend for the athlete

Requested on 2026-10-14. Each step so far added screens that work and are tested, but the app has grown screen by screen; this step makes it one coherent, pleasant product.

- [ ] Navigation: the More list has grown long (health, nutrition, recovery, rehab, coaching, chat). Group features into a clear home and tab structure, with today's essentials (planned workout, recovery, check-in, fuel) on the home screen.
- [ ] Replace the remaining sample-data screens (Trends, Insights, Comparison, Goals & Forecasts, Long-Term Progress) with real data or remove them.
- [ ] A shared design system: consistent cards, headers, empty states, loading and error states, form controls (one checkbox, one 0–10 scale, one date/time field), spacing and typography.
- [ ] Onboarding: first-run flow (sports, equipment, goals, optional account), and explanations of consent and AI where they first appear.
- [ ] Phone-first polish: test on iOS and Android devices (so far only a desktop browser), safe areas, keyboard handling, haptics, dark/light, large text.
- [ ] Accessibility pass: screen-reader labels and order, contrast, touch targets, reduced motion.
- [ ] Visual regression screenshots in the end-to-end suite so later changes cannot quietly break layouts.

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
