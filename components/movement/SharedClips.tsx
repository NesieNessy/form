import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { clipLink, listSharedClips, type Clip } from '@/lib/movement/api';
import { movementName, viewTitle } from '@/lib/movement/model';
import { strings } from '@/lib/strings';
import { colors, fontFamily, spacing } from '@/theme/colors';
import { AnalysisView } from './AnalysisView';
import { ClipNotes } from './ClipNotes';
import { ClipPlayer, type ClipPlayerHandle } from './ClipPlayer';

/** A connected athlete's shared clips for their professional: player, analysis, and notes attributed to who wrote them. */
export function SharedClips({ athleteId, onError }: { athleteId: string; onError: (m: string) => void }) {
  const [state, setState] = useState<{ shared: boolean; videos: Clip[] } | null>(null);

  const load = useCallback(async () => {
    const res = await listSharedClips(athleteId);
    if (res.ok) setState(res.data);
  }, [athleteId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!state) return null;
  return (
    <>
      <Text style={styles.section}>{strings.coachClips}</Text>
      {!state.shared ? <Text style={styles.hint}>{strings.coachClipsNotShared}</Text> : state.videos.length === 0 ? <Text style={styles.body}>{strings.coachClipsNone}</Text> : null}
      {state.videos.map((v) => (
        <SharedClip key={v.id} clip={v} reload={load} onError={onError} />
      ))}
    </>
  );
}

function SharedClip({ clip, reload, onError }: { clip: Clip; reload: () => Promise<void>; onError: (m: string) => void }) {
  const player = useRef<ClipPlayerHandle>(null);
  const [link, setLink] = useState<string | null>(null);
  useEffect(() => {
    void clipLink(clip.storage_path).then(setLink);
  }, [clip.storage_path]);
  const open = clip.review_requests.find((r) => r.status === 'requested');
  return (
    <View style={{ gap: spacing.sm }}>
      <Card style={{ gap: spacing.sm }}>
        <Text style={styles.title}>{`${movementName(clip.movement_id)} · ${viewTitle(clip.movement_id, clip.camera_view).toLowerCase()}`}</Text>
        <Text style={styles.meta}>{new Date(clip.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
        {open?.note ? <Text style={styles.body}>{`“${open.note}”`}</Text> : null}
        <ClipPlayer ref={player} uri={link} />
      </Card>
      {clip.analysis ? <AnalysisView analysis={clip.analysis} onSeek={(s) => player.current?.seek(s)} /> : null}
      <ClipNotes clipId={clip.id} notes={clip.annotations} currentTime={() => player.current?.currentTime() ?? 0} onSeek={(s) => player.current?.seek(s)} onAdded={() => void reload()} onError={onError} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { color: colors.text, fontSize: 16, fontFamily: fontFamily.bold, marginTop: spacing.md },
  title: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  meta: { color: colors.textTertiary, fontSize: 12, fontFamily: fontFamily.regular },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, fontFamily: fontFamily.regular },
  hint: { color: colors.textTertiary, fontSize: 12, lineHeight: 17, fontFamily: fontFamily.regular },
});
