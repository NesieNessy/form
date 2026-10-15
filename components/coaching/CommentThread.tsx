import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { GradientButton } from '@/components/ui/GradientButton';
import { addAssignmentComment, type AssignmentComment } from '@/lib/sharing/api';
import { strings } from '@/lib/strings';
import { colors, fontFamily, radius, spacing } from '@/theme/colors';

type Props = {
  assignmentId: string;
  comments: AssignmentComment[];
  /** False once the connection has ended or the assignment is closed to new comments. */
  canPost: boolean;
  onPosted: () => void;
  onError: (message: string) => void;
};

/** The conversation about one sent workout. Both sides see it; it is kept in the athlete's export. */
export function CommentThread({ assignmentId, comments, canPost, onPosted, onError }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const post = async () => {
    if (busy || !text.trim()) return;
    setBusy(true);
    const res = await addAssignmentComment(assignmentId, text);
    setBusy(false);
    if (!res.ok) return onError(res.error);
    setText('');
    onPosted();
  };

  return (
    <View style={styles.wrap}>
      {comments.length ? <Text style={styles.title}>{strings.comments}</Text> : null}
      {comments.map((c) => (
        <View key={c.id} style={[styles.bubble, c.by_me ? styles.mine : styles.theirs]}>
          <Text style={styles.author}>{c.by_me ? strings.you : (c.author_name ?? strings.someone)}</Text>
          <Text style={styles.body}>{c.body}</Text>
        </View>
      ))}
      {canPost ? (
        <View style={styles.row}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={strings.commentPlaceholder}
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
            maxLength={2000}
            multiline
            accessibilityLabel={strings.addComment}
          />
          <GradientButton label={strings.post} variant="secondary" style={{ minWidth: 80 }} onPress={busy ? undefined : () => void post()} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  title: { color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.semibold },
  bubble: { borderRadius: radius.md, padding: spacing.sm, maxWidth: '88%' },
  mine: { alignSelf: 'flex-end', backgroundColor: `${colors.teal}22` },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.cardAlt },
  author: { color: colors.textTertiary, fontSize: 11, fontFamily: fontFamily.medium, marginBottom: 2 },
  body: { color: colors.text, fontSize: 13.5, lineHeight: 19, fontFamily: fontFamily.regular },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: {
    flex: 1,
    color: colors.text,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: fontFamily.regular,
    maxHeight: 120,
  },
});
