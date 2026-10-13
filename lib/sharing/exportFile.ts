import { Platform, Share } from 'react-native';
import { getWorkoutData } from '../workoutsStore';
import { exportMyData } from './api';

/**
 * Builds the athlete's data export: everything held on this device, plus,
 * when signed in, everything the account holds on the server (sharing
 * decisions and the access log only exist there).
 */
export async function buildExport(signedIn: boolean): Promise<{ json: string; serverIncluded: boolean }> {
  const { dirty: _dirty, ownerUserId: _owner, ...device } = getWorkoutData();
  const doc: Record<string, unknown> = { format: 'form-export-v1', exported_at: new Date().toISOString(), device };
  let serverIncluded = false;
  if (signedIn) {
    const res = await exportMyData();
    if (res.ok) {
      doc.account = res.data;
      serverIncluded = true;
    }
  }
  return { json: JSON.stringify(doc, null, 2), serverIncluded };
}

/** Hands the export to the user: a file download in the browser, the share sheet on a phone. */
export async function deliverExport(json: string): Promise<void> {
  const name = `form-export-${new Date().toISOString().slice(0, 10)}.json`;
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return;
  }
  await Share.share({ title: name, message: json });
}
