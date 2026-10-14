import React, { useState } from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { GradientButton } from '@/components/ui/GradientButton';
import { FieldCard } from '@/components/workout/FieldCard';
import { addClipNote, type ClipAnnotation } from '@/lib/movement/api';
import { strings } from '@/lib/strings';
import { colors, fontFamily, spacing } from '@/theme/colors';
import { clock } from './AnalysisView';

/** Timestamped notes on a clip, each shown with who wrote it. */
export function ClipNotes({ clipId, notes, currentTime, onSeek, onAdded, onError }: {
  clipId: string;
  notes: ClipAnnotation[];
  currentTime: () => number;
  onSeek: (s: number) => void;
  onAdded: () => void;
  onError: (m: string) => void;
}) {
  const [body, setBody] = useState('');
  const [atNow, setAtNow] = useState(true);
  const [busy, setBusy] = useState(false);
  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{strings.clipNotes}</Text>
      {notes.length === 0 ? <Text style={styles.body}>{strings.noClipNotes}</Text> : null}
      {notes.map((n) => (
        <View key={n.id} style={{ gap: 2 }}>
          <View style={styles.row}>
            {n.at_seconds !== null ? (
              <TouchableOpacity onPress={() => onSeek(Number(n.at_seconds))} hitSlop={6}>
                <Text style={styles.time}>{clock(Number(n.at_seconds))}</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={styles.meta}>
              {n.by_me ? strings.you : strings.noteBy(n.author_name ?? strings.someone, n.author_role === 'professional' ? strings.professionalRole : strings.athleteRole)}
            </Text>
          </View>
          <Text style={styles.body}>{n.body}</Text>
        </View>
      ))}
      <FieldCard label={strings.addNote} value={body} onChangeText={setBody} placeholder={strings.clipNotePlaceholder} maxLength={1000} multiline cardStyle={styles.inset} />
      <View style={styles.row}>
        <Switch value={atNow} onValueChange={setAtNow} accessibilityLabel={strings.addNoteAt('')} />
        <Text style={styles.body}>{strings.addNoteAt(clock(currentTime()))}</Text>
      </View>
      <GradientButton
        label={busy ? strings.saving : strings.addNote}
        variant="secondary"
        onPress={
          body.trim() && !busy
            ? async () => {
                setBusy(true);
                const res = await addClipNote(clipId, atNow ? Math.round(currentTime() * 10) / 10 : null, body);
                setBusy(false);
                if (!res.ok) return onError(res.error);
                setBody('');
                onAdded();
              }
            : undefined
        }
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  title: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  time: { color: colors.blue, fontSize: 12.5, fontFamily: fontFamily.semibold },
  meta: { color: colors.textTertiary, fontSize: 12, fontFamily: fontFamily.regular },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, fontFamily: fontFamily.regular },
  inset: { marginBottom: 0, backgroundColor: colors.cardAlt, borderWidth: 0 },
});
