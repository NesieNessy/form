import { create } from 'zustand';
import { readPreference, writePreference } from './preferences';

/**
 * The workspace the person is working in (docs/concepts/11-frontend-ux-ui-architecture.md,
 * section 9). It changes what is offered, never who owns data or what
 * anyone may see: access still comes only from the athlete's grants.
 */
export type Workspace = 'personal' | 'coaching' | 'physio';

const stored = readPreference('workspace');

export const useWorkspace = create<{ workspace: Workspace; setWorkspace: (w: Workspace) => void }>((set) => ({
  workspace: stored === 'coaching' || stored === 'physio' ? stored : 'personal',
  setWorkspace: (workspace) => {
    writePreference('workspace', workspace);
    set({ workspace });
  },
}));
