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
2. In the SQL editor run `supabase/schema.sql`, then `supabase/migrations/0002_workout_core.sql`.
3. Copy `.env.example` to `.env` and fill in the project URL and anon key.
4. Restart with a clean bundler cache: `npx expo start --clear`.

The app then requires sign-in and syncs workouts, schedule and sessions in the background.

## Check your changes

```bash
npm run typecheck
npm test
```

`npm test` runs the workout-core unit tests and the database tests. The database tests execute the real migrations in an in-process Postgres (PGlite), so they need no Supabase project.

After changing `lib/workout/catalog.ts`, run `npm run gen:activity-seed` to regenerate the catalog rows in the migration.

## Where things are

- `docs/ROADMAP.md` — the build order and what is done.
- `docs/DECISIONS.md` — architecture decisions taken so far and those still open.
- `docs/concepts/` — the product and technical concept documents everything is based on.
- `lib/workout/` — the workout model, validator, timer math, scoring and analytics (no React, fully tested).
- `lib/workoutsStore.ts`, `lib/sync/` — local-first storage and background sync.
- `supabase/` — schema, migrations and database tests.