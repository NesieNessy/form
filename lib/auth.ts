import { create } from 'zustand';
import { isSupabaseConfigured, supabase } from './supabase';
import { syncNow, watchLocalChanges } from './sync';
import { useWorkoutsStore } from './workoutsStore';

/**
 * `local` means no Supabase project is configured: the app is fully usable
 * and keeps everything on the device. Otherwise the app requires sign-in.
 */
export type AuthStatus = 'loading' | 'local' | 'signedOut' | 'signedIn';

type AuthState = { status: AuthStatus; userId: string | null; email: string | null };

export const useAuthStore = create<AuthState>(() => ({
  status: isSupabaseConfigured ? 'loading' : 'local',
  userId: null,
  email: null,
}));

function whenStoreHydrated(fn: () => void) {
  if (useWorkoutsStore.persist.hasHydrated()) fn();
  else useWorkoutsStore.persist.onFinishHydration(() => fn());
}

function onSignedIn(userId: string, email: string | null) {
  const previous = useAuthStore.getState();
  useAuthStore.setState({ status: 'signedIn', userId, email });
  if (previous.status === 'signedIn' && previous.userId === userId) return;
  // Local data must be loaded before deciding whether it belongs to this account.
  whenStoreHydrated(() => {
    useWorkoutsStore.getState().attachToUser(userId);
    void syncNow();
  });
}

let started = false;

/** Call once at app start. */
export function initAuth(): void {
  if (started || !isSupabaseConfigured) return;
  started = true;
  watchLocalChanges();

  supabase.auth
    .getSession()
    .then(({ data }) => {
      const user = data.session?.user;
      if (user) onSignedIn(user.id, user.email ?? null);
      else useAuthStore.setState({ status: 'signedOut', userId: null, email: null });
    })
    .catch(() => useAuthStore.setState({ status: 'signedOut', userId: null, email: null }));

  supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user;
    if (user) onSignedIn(user.id, user.email ?? null);
    else useAuthStore.setState({ status: 'signedOut', userId: null, email: null });
  });
}

export async function signIn(email: string, password: string): Promise<{ error?: string }> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  return error ? { error: error.message } : {};
}

export async function signUp(email: string, password: string): Promise<{ error?: string; needsConfirmation?: boolean }> {
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) return { error: error.message };
  // With email confirmation on, Supabase returns a user but no session yet.
  return { needsConfirmation: !data.session };
}

export async function signOut(opts: { skipSync?: boolean } = {}): Promise<void> {
  // Give unsent changes one chance to upload; they stay queued on the device either way.
  if (!opts.skipSync) await syncNow().catch(() => {});
  // skipSync is the account-deleted case: there is no server session left to end, so only this device is signed out.
  await supabase.auth.signOut(opts.skipSync ? { scope: 'local' } : undefined).catch(() => {});
  if (useAuthStore.getState().status === 'signedIn') useAuthStore.setState({ status: 'signedOut', userId: null, email: null });
}
