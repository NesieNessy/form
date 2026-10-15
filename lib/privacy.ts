import { create } from 'zustand';
import { readPreference, writePreference } from './preferences';

/**
 * Privacy blur (docs/concepts/12-form-brand-design-system.md, section 8):
 * when on, sensitive values (health, recovery, nutrition, rehab) show as
 * dots until tapped, for use in a gym or class. A device setting.
 */
type PrivacyState = { hideSensitive: boolean; setHideSensitive: (on: boolean) => void };

export const usePrivacy = create<PrivacyState>((set) => ({
  hideSensitive: readPreference('privacy') === 'on',
  setHideSensitive: (on) => {
    writePreference('privacy', on ? 'on' : 'off');
    set({ hideSensitive: on });
  },
}));
