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

## Still open (yours to decide)

### 4. Physiotherapy scope

Wellness coordination only, or intended medical use? The second brings medical-device regulation. Nothing built so far depends on this; it must be settled before Step 8.

### 5. Launch country, hosting region and pricing

These drive the GDPR design and the consent wording. They must be settled before Step 2 ships to real users, because health and consent data start being stored there.
