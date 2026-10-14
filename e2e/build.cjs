// Builds the web app for end-to-end tests in local mode: no Supabase, so no
// account, no sync and no assistant calls (and no AI cost). `.env.local` is
// ignored on purpose. Metro caches inlined env values, so the build clears
// its cache; restart a dev server with `npx expo start --clear` afterwards.
const { spawnSync } = require('child_process');

const res = spawnSync('npx', ['expo', 'export', '--clear', '--platform', 'web', '--output-dir', 'dist-e2e'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, EXPO_NO_DOTENV: '1', EXPO_PUBLIC_SUPABASE_URL: '', EXPO_PUBLIC_SUPABASE_ANON_KEY: '' },
});
process.exit(res.status ?? 1);
