# FORM

Find your form. A fitness tracking app built with Expo (React Native) and Supabase.

## Run it

```bash
npm install
npm run web      # or: npm run ios / npm run android
```

With no configuration the app runs in **local mode**: everything is stored on the device and there is no sign-in.

## Connect Supabase (optional)

1. Create a Supabase project.
2. In the SQL editor run `supabase/schema.sql`, then each file in `supabase/migrations/` in order (`0002` through `0015`).
3. Copy `.env.example` to `.env.local` (git-ignored) and fill in the project URL and publishable key. The names must start with `EXPO_PUBLIC_`.
4. Restart with a clean bundler cache: `npx expo start --clear`.

For the AI assistant (workout import and adaptation), also set an Anthropic API key as a secret and deploy the server function:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase secrets set ANTHROPIC_API_KEY=<your-key>
npx supabase functions deploy assistant --use-api
```

The app then requires sign-in and syncs workouts, schedule, sessions, profile and benchmarks in the background. Sharing with a coach, the access log and notifications work only when signed in.

## Check your changes

```bash
npm run typecheck
npm test
```

`npm test` runs the workout-core unit tests and the database tests. The database tests execute the real migrations in an in-process Postgres (PGlite), so they need no Supabase project.

After changing `lib/workout/catalog.ts`, run `npm run gen:activity-seed` to regenerate the catalog rows in the migration.

After changing anything the assistant uses (`lib/ai`, the validator, the catalog, `lib/strings.ts`), run `npm run build:edge-core` and deploy the function again. A test fails if the bundle is stale.

End-to-end tests run the exported web app in a browser, in local mode (no account, no Supabase, no AI calls):

```bash
npm run e2e:build   # web export into dist-e2e/, ignoring .env.local
npm run e2e         # generates fixtures, then runs Playwright (e2e/*.spec.ts)
```

Locally, set `E2E_BROWSER_CHANNEL=msedge` to use the installed Edge, or run `npx playwright install chromium` once. The build clears Metro's cache, so start a dev server afterwards with `npx expo start --clear`.

GitHub Actions (`.github/workflows/ci.yml`) runs the typecheck, `npm test`, the web build and the end-to-end tests on every push and pull request. It uses no secrets and makes no AI calls.

`npm run eval` runs the assistant's evaluation cases against the deployed function. It makes 24 paid assistant requests (about 90 cents) and needs `EVAL_EMAIL` and `EVAL_PASSWORD` for a test account. `npm run eval -- meals` runs only the meal-parsing cases (four paid calls), `npm run eval -- chats` only the chat cases (four paid turns). Use a fresh test account for the chat cases: they add workouts to it.

## Where things are

- `docs/ROADMAP.md` — the build order and what is done.
- `docs/DECISIONS.md` — architecture decisions taken so far and those still open.
- `docs/concepts/` — the product and technical concept documents everything is based on.
- `lib/workout/` — the workout model, validator, timer math, scoring and analytics (no React, fully tested).
- `lib/ai/` — the assistant's pipelines (import, adaptation, meal parsing, chat), draft schema and change list; `evals/` holds its evaluation cases.
- `lib/athlete/` — profile and benchmarks.
- `lib/nutrition/` — food catalog, portion and nutrient engine, food log, saved meals and training-aware targets.
- `lib/health/` — activity file parsing (GPX, TCX, FIT), duplicate detection, matching to planned workouts, measurements and personal baselines.
- `lib/sharing/` — client for invitations, grants, assignments, the access log, export and notifications.
- `lib/coaching/` — rule-based roster notes for the coach workspace.
- `lib/rehab/` — injury episodes, symptom logs, the restriction engine and the client for clinician records.
- `lib/recovery/` — daily check-in, the recovery rules and the workout options (shorter, lighter, move, rest).
- `lib/workoutsStore.ts`, `lib/sync/` — local-first storage and background sync.
- `supabase/` — schema, migrations, database tests and the `assistant` edge function.