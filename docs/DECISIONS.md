# Decisions

Step 0 of the [roadmap](ROADMAP.md) asks for five decisions before coding. Three have a default that the concept documents already point to, so work proceeded on those. Two are business decisions that are still open.

## Taken (change them if you disagree)

### 1. Athletes execute workouts in the app

FORM is a workout player, not only a library. The data model therefore separates the definition (what was prescribed) from the session (what happened), and every block format has timer and scoring behaviour.

*Why:* every later stage in the concepts (recovery, coaching, goals) assumes completed sessions with real results.

### 2. Supabase with row-level security, plus database functions for multi-row writes

Reads and simple writes go through the table API under row-level security. Writes that span several tables, or that must be validated on the server, go through Postgres functions (`save_workout_version`, `save_session`). Workout versions, blocks and steps are not writable through the table API at all, so the publish check in the database cannot be bypassed.

*Why:* the concepts require server-side authorization and validation, and this gets both without running a separate API yet. Edge Functions arrive with the AI workflows in Step 3.

### 3. Local-first storage with background sync

The app writes to local storage first and syncs to Supabase when the user is signed in and online. Timers run from the device clock. Identifiers are generated on the device, so a retried upload cannot create duplicates. Conflicts between devices resolve by latest `updated_at`.

*Why:* a workout timer must not depend on connectivity, and the app must keep working with no Supabase project configured.

*Known limit:* latest-write-wins trusts device clocks. That is acceptable for one athlete on a few devices and must be revisited before coaches can edit the same records (Step 6).

### 4. Shared data is read through one database function, not through the tables

Nobody but the athlete has read access to the athlete's tables. A coach or physiotherapist calls `get_shared_context()`, which returns only the categories the athlete has granted and writes an audit record for each one.

*Why:* the concepts require that every professional read is auditable. A table read cannot write a log entry, so giving professionals table access would make reads invisible. One function also means there is a single place where the sharing rule is decided.

*Cost:* professional screens cannot query freely; each new kind of shared data needs a section in that function.

### 5. A grant is one category for one relationship

Each consent decision is its own row: this person, this category, this purpose, until this date. Withdrawing marks the row revoked and keeps it. Ending a relationship withdraws all of its grants in the same step.

*Why:* it makes "what exactly did I agree to, and when" answerable from the data, and makes revocation take effect on the next request.

### 6. Invitations use a code plus the invited email address

The athlete creates an invitation for an email address and passes on a ten-character code. Accepting needs the code and an account with that address. The app does not send email.

*Why:* it works without an email provider, and a leaked code alone is useless.

### 7. The assistant is a pipeline with one model call, not an agent with tools

Import and adaptation each make one request to the model for a structured draft (plus at most one repair request when the validator rejects it). Everything else is ordinary code: loading the workout, matching exercise names to the catalog, validation, the change list, and the equipment, time and safety checks.

*Why:* both tasks are a transformation with a checkable result. Code that runs the same way every time is easier to test and to trust than a model deciding which step to take next, and it leaves a hostile workout text nothing to steer. Model-driven tool use arrives with the coaching chat (Step 9), where the next step really is open-ended.

### 8. Claude Opus 5.5 through the Anthropic SDK, with server-side fallback

The edge function calls `claude-opus-5-5` with structured output and medium effort. If the model's safety checks decline a request, Anthropic re-runs it on its recommended fallback model.

*Cost:* roughly 2 to 5 cents per request. A cheaper model would cut that several-fold. Changing it is one constant in `supabase/functions/assistant/index.ts`; run `npm run eval` before and after.

### 9. Shared code reaches the server as a generated bundle

`npm run build:edge-core` bundles `lib/ai/edgeCore.ts` into `supabase/functions/_shared/core.js`, and a test fails if the committed bundle is out of date.

*Why:* the validator must be identical in the app and on the server. Deno cannot import the app's TypeScript modules directly, and a second hand-written copy would drift.

### 10. Medical situations are stopped by a word list, before the model

*Why:* a model can be talked into things; a list cannot. The list will be wrong in both directions until a clinician has reviewed it, which is recorded as an open item.

## Still open (yours to decide)

### 11. Physiotherapy scope

Wellness coordination only, or intended medical use? The second brings medical-device regulation. Nothing built so far depends on this; it must be settled before Step 8.

### 12. Launch country, hosting region and pricing

These drive the GDPR design and the consent wording. They must be settled before Step 2 ships to real users, because health and consent data start being stored there.
