import { call, type Result } from '../sharing/api';
import { supabase } from '../supabase';
import type { Analysis, CameraView, Confidence, Limitation, MovementId, ObservationLabel } from './model';

/** Client for supabase/migrations/0015_movement.sql and the private movement-videos bucket. */

const BUCKET = 'movement-videos';
/** Signed links last five minutes, so a revoked grant stops new viewing quickly. */
const LINK_SECONDS = 300;

export type ClipAnnotation = { id: string; author_role: 'athlete' | 'professional'; author_name: string | null; by_me: boolean; at_seconds: number | null; body: string; created_at: string };
export type ClipAnalysis = {
  id: string;
  engine_version: string;
  usable: boolean;
  limitations: Limitation[];
  repetitions: number;
  analysed_seconds: number;
  observations: { label: ObservationLabel; summary: string; confidence: Confidence; timestamps: number[] }[];
  created_at: string;
};
export type Clip = {
  id: string;
  movement_id: MovementId;
  camera_view: CameraView;
  storage_path: string;
  duration_seconds: number | null;
  size_bytes: number;
  consent_inference: boolean;
  shared_with_professionals: boolean;
  retention_until: string;
  status: 'pending' | 'uploaded' | 'deleted';
  created_at: string;
  analysis: ClipAnalysis | null;
  annotations: ClipAnnotation[];
  review_requests: { id: string; professional_name: string | null; note: string | null; status: 'requested' | 'answered'; created_at: string }[];
};

export type NewClip = { movementId: MovementId; view: CameraView; mime: string; size: number; retentionDays: number; consentRecording: boolean; consentInference: boolean; share: boolean };

/** Registers the clip, uploads the file to its registered path, and marks it uploaded. */
export async function uploadClip(input: NewClip, uri: string, durationSeconds: number | null): Promise<Result<{ id: string; storage_path: string }>> {
  const reg = await call<{ id: string; storage_path: string }>('create_video_asset', {
    p_movement: input.movementId,
    p_view: input.view,
    p_mime: input.mime,
    p_size: input.size,
    p_retention_days: input.retentionDays,
    p_consent_recording: input.consentRecording,
    p_consent_inference: input.consentInference,
    p_share: input.share,
  });
  if (!reg.ok) return reg;
  try {
    const blob = await (await fetch(uri)).blob();
    const { error } = await supabase.storage.from(BUCKET).upload(reg.data.storage_path, blob, { contentType: input.mime, upsert: false });
    if (error) return { ok: false, error: 'The upload did not finish. Check the connection and try again.' };
  } catch {
    return { ok: false, error: 'The upload did not finish. Check the connection and try again.' };
  }
  const fin = await call<null>('finalize_video_asset', { p_asset: reg.data.id, p_duration: durationSeconds });
  return fin.ok ? reg : fin;
}

export const myClips = () => call<Clip[]>('my_videos');
export const setClipConsent = (id: string, inference: boolean | null, share: boolean | null) => call<null>('set_video_consent', { p_asset: id, p_inference: inference, p_share: share });
export const saveAnalysis = (id: string, a: Analysis) => call<string>('save_movement_analysis', { p_asset: id, p_analysis: a });
export const addClipNote = (id: string, atSeconds: number | null, body: string) => call<string>('add_video_annotation', { p_asset: id, p_at: atSeconds, p_body: body });
export const requestClipReview = (id: string, relationshipId: string, note: string) => call<string>('request_video_review', { p_asset: id, p_relationship: relationshipId, p_note: note });

export async function listSharedClips(athleteId: string): Promise<Result<{ shared: boolean; videos: Clip[] }>> {
  return call<{ shared: boolean; videos: Clip[] }>('list_shared_videos', { p_athlete: athleteId });
}

/** A short-lived link to play the clip; the storage policy decides whether the caller may have one. */
export async function clipLink(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, LINK_SECONDS);
  return error ? null : data.signedUrl;
}

/** Removes the file first (the owner can always reach their own folder), then the record and everything derived from it. */
export async function deleteClip(clip: Pick<Clip, 'id' | 'storage_path'>): Promise<Result<null>> {
  const { error } = await supabase.storage.from(BUCKET).remove([clip.storage_path]);
  if (error) return { ok: false, error: 'The clip could not be removed. Check the connection and try again.' };
  return call<null>('delete_video_asset', { p_asset: clip.id });
}

/** Removes clips past their retention date, and uploads that never finished. */
export async function purgeExpiredClips(): Promise<number> {
  const res = await call<{ id: string; storage_path: string }[]>('my_expired_videos');
  if (!res.ok) return 0;
  let n = 0;
  for (const clip of res.data) if ((await deleteClip(clip)).ok) n++;
  return n;
}

/** Every file in the person's folder, before their account is deleted (the database cannot remove stored files). */
export async function removeAllMyClipFiles(userId: string): Promise<void> {
  const { data } = await supabase.storage.from(BUCKET).list(userId, { limit: 1000 });
  if (data?.length) await supabase.storage.from(BUCKET).remove(data.map((f) => `${userId}/${f.name}`));
}
