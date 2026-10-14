import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { GradientButton } from '@/components/ui/GradientButton';
import type { ChatProposal, ChatReply, Citation } from '@/lib/ai/chat';
import { describeMove, rescheduleTarget } from '@/lib/ai/chatActions';
import {
  addMemory,
  deleteConversation,
  deleteMemory,
  getMessages,
  listConversations,
  listMemories,
  sendChat,
  type Conversation,
  type Memory,
} from '@/lib/ai/client';
import { useAuthStore } from '@/lib/auth';
import { strings } from '@/lib/strings';
import { useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, radius, spacing } from '@/theme/colors';

type Turn = { id: string; role: 'user' | 'assistant'; text: string; reply?: Partial<ChatReply> };

export default function ChatScreen() {
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const userId = useAuthStore((s) => s.userId);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [panel, setPanel] = useState<'none' | 'earlier' | 'memories'>('none');
  const [handled, setHandled] = useState<Record<string, string>>({});
  const scroll = useRef<ScrollView>(null);

  const loadLists = useCallback(async () => {
    if (!signedIn) return;
    const [c, m] = await Promise.all([listConversations(), listMemories()]);
    setConversations(c);
    setMemories(m);
  }, [signedIn]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  const open = async (id: string) => {
    setConversationId(id);
    setPanel('none');
    const rows = await getMessages(id);
    setTurns(rows.map((r) => ({ id: r.id, role: r.role, text: r.content, reply: r.role === 'assistant' ? r.payload : undefined })));
  };

  const send = async (message = text) => {
    if (busy || !message.trim()) return;
    setBusy(true);
    setError(null);
    setText('');
    setTurns((t) => [...t, { id: `u${Date.now()}`, role: 'user', text: message.trim() }]);
    const res = await sendChat(message.trim(), conversationId);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setConversationId(res.conversation_id);
    setTurns((t) => [...t, { id: `a${Date.now()}`, role: 'assistant', text: res.reply.answer, reply: res.reply }]);
    void loadLists();
  };

  if (!signedIn) {
    return (
      <View style={styles.screen}>
        <DetailHeader title={strings.chatTitle} subtitle={strings.chatSubtitle} />
        <Text style={[styles.body, { padding: spacing.screenX }]}>{strings.chatNeedsAccount}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <DetailHeader title={strings.chatTitle} subtitle={strings.chatSubtitle} />
      <View style={styles.tools}>
        <TouchableOpacity onPress={() => (setConversationId(null), setTurns([]), setPanel('none'))}>
          <Text style={styles.link}>{strings.chatNew}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setPanel(panel === 'earlier' ? 'none' : 'earlier')}>
          <Text style={styles.link}>{strings.chatEarlier}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setPanel(panel === 'memories' ? 'none' : 'memories')}>
          <Text style={styles.link}>{strings.memoriesTitle}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView ref={scroll} contentContainerStyle={styles.content} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })} keyboardShouldPersistTaps="handled">
        {panel === 'earlier' ? (
          <Card style={styles.card}>
            {conversations.length === 0 ? <Text style={styles.hint}>{strings.memoriesEmpty}</Text> : null}
            {conversations.map((c) => (
              <View key={c.id} style={styles.row}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => void open(c.id)}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {c.title}
                  </Text>
                  <Text style={styles.hint}>{new Date(c.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    await deleteConversation(c.id);
                    if (c.id === conversationId) (setConversationId(null), setTurns([]));
                    void loadLists();
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.delete}>{strings.chatDelete}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </Card>
        ) : null}

        {panel === 'memories' ? (
          <Card style={styles.card}>
            <Text style={styles.hint}>{strings.memoriesHint}</Text>
            {memories.length === 0 ? <Text style={styles.hint}>{strings.memoriesEmpty}</Text> : null}
            {memories.map((m) => (
              <View key={m.id} style={styles.row}>
                <Text style={[styles.body, { flex: 1 }]}>{m.text}</Text>
                <TouchableOpacity onPress={async () => (await deleteMemory(m.id), void loadLists())} hitSlop={8}>
                  <Text style={styles.delete}>{strings.chatDelete}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </Card>
        ) : null}

        {turns.length === 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.body}>{strings.chatEmpty}</Text>
            {strings.chatExamples.map((e) => (
              <TouchableOpacity key={e} style={styles.example} onPress={() => void send(e)}>
                <Text style={styles.exampleText}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {turns.map((t) =>
          t.role === 'user' ? (
            <View key={t.id} style={[styles.bubble, styles.mine]}>
              <Text style={styles.bubbleText}>{t.text}</Text>
            </View>
          ) : (
            <View key={t.id} style={{ gap: spacing.sm }}>
              <View style={[styles.bubble, styles.theirs]}>
                <Text style={styles.bubbleText}>{t.text}</Text>
              </View>
              {(t.reply?.warnings ?? []).map((w) => (
                <Text key={w} style={styles.warning}>
                  {w}
                </Text>
              ))}
              {t.reply?.citations?.length ? <Citations items={t.reply.citations} /> : null}
              {(t.reply?.proposals ?? []).map((p, i) => (
                <ProposalCard
                  key={`${t.id}-${i}`}
                  proposal={p}
                  done={handled[`${t.id}-${i}`]}
                  onDone={(label) => setHandled((h) => ({ ...h, [`${t.id}-${i}`]: label }))}
                  userId={userId}
                  onMemory={loadLists}
                />
              ))}
            </View>
          )
        )}
        {busy ? <Text style={styles.hint}>{strings.chatThinking}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={strings.chatPlaceholder}
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          multiline
          maxLength={2000}
          accessibilityLabel={strings.chatPlaceholder}
        />
        <GradientButton label={strings.chatSend} style={{ minWidth: 88 }} onPress={busy || !text.trim() ? undefined : () => void send()} />
      </View>
      <Text style={styles.footer}>{strings.chatFooter}</Text>
    </KeyboardAvoidingView>
  );
}

function Citations({ items }: { items: Citation[] }) {
  const sessions = useWorkoutsStore((s) => s.sessions);
  const go = (c: Citation) => {
    if (c.entity_type === 'scheduled_workout') router.push({ pathname: '/workout-detail', params: { id: c.entity_id } });
    else if (c.entity_type === 'session') {
      const scheduledId = sessions[c.entity_id]?.scheduledWorkoutId;
      if (scheduledId) router.push({ pathname: '/workout-detail', params: { id: scheduledId } });
    } else if (c.entity_type === 'recovery_day') router.push('/recovery');
    else if (c.entity_type === 'nutrition_day') router.push({ pathname: '/nutrition', params: { date: c.entity_id } });
    else if (c.entity_type === 'restriction') router.push('/rehab');
  };
  return (
    <View style={styles.citations}>
      <Text style={styles.hint}>{strings.chatBasedOn}</Text>
      {items.map((c) => (
        <TouchableOpacity key={`${c.entity_type}:${c.entity_id}`} style={styles.chip} onPress={() => go(c)}>
          <Text style={styles.chipText} numberOfLines={1}>
            {c.label ?? c.entity_type}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ProposalCard({ proposal, done, onDone, userId, onMemory }: { proposal: ChatProposal; done?: string; onDone: (label: string) => void; userId: string | null; onMemory: () => void }) {
  const scheduled = useWorkoutsStore((s) => s.scheduled);
  const moveScheduled = useWorkoutsStore((s) => s.moveScheduled);

  if (proposal.type === 'workout') {
    return (
      <Card style={styles.card}>
        <Text style={styles.rowTitle}>{strings.chatDraftTitle(proposal.title)}</Text>
        <GradientButton label={strings.chatReviewDraft} variant="secondary" onPress={() => router.push({ pathname: '/proposal', params: { id: proposal.proposal_id } })} />
      </Card>
    );
  }
  if (proposal.type === 'reschedule') {
    const entry = scheduled[proposal.scheduled_id];
    const target = entry ? rescheduleTarget(entry.scheduledAt, proposal.to) : undefined;
    if (!entry || target === undefined) return null;
    const move = describeMove(entry.scheduledAt, target);
    return (
      <Card style={styles.card}>
        <Text style={styles.rowTitle}>{strings.chatMoveTitle(proposal.title)}</Text>
        <Text style={styles.before}>{move.from}</Text>
        <Text style={styles.after}>{move.to}</Text>
        {done ? (
          <Text style={styles.hint}>{done}</Text>
        ) : (
          <View style={styles.row}>
            <GradientButton label={strings.chatKeep} variant="secondary" style={{ flex: 1 }} onPress={() => onDone(strings.chatDone)} />
            <GradientButton
              label={strings.chatMoveIt}
              style={{ flex: 1 }}
              onPress={() => {
                moveScheduled(entry.id, target);
                onDone(strings.chatMoved);
              }}
            />
          </View>
        )}
      </Card>
    );
  }
  return (
    <Card style={styles.card}>
      <Text style={styles.rowTitle}>{strings.chatMemoryTitle}</Text>
      <Text style={styles.body}>{proposal.text}</Text>
      {done ? (
        <Text style={styles.hint}>{done}</Text>
      ) : (
        <View style={styles.row}>
          <GradientButton label={strings.chatNo} variant="secondary" style={{ flex: 1 }} onPress={() => onDone(strings.chatDone)} />
          <GradientButton
            label={strings.chatRemember}
            style={{ flex: 1 }}
            onPress={async () => {
              if (!userId) return;
              const res = await addMemory(userId, proposal.text);
              onDone(res.ok ? strings.chatRemembered : res.message);
              onMemory();
            }}
          />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  tools: { flexDirection: 'row', gap: spacing.lg, paddingHorizontal: spacing.screenX, paddingBottom: spacing.sm },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.lg, gap: spacing.md },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowTitle: { color: colors.text, fontSize: 14.5, fontFamily: fontFamily.semibold },
  body: { color: colors.textSecondary, fontSize: 13.5, lineHeight: 19, fontFamily: fontFamily.regular },
  hint: { color: colors.textTertiary, fontSize: 12, lineHeight: 17, fontFamily: fontFamily.regular },
  link: { color: colors.teal, fontSize: 13, fontFamily: fontFamily.semibold },
  delete: { color: colors.red, fontSize: 13, fontFamily: fontFamily.semibold },
  example: { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 8 },
  exampleText: { color: colors.text, fontSize: 13, fontFamily: fontFamily.medium },
  bubble: { borderRadius: radius.md, padding: spacing.md, maxWidth: '88%' },
  mine: { alignSelf: 'flex-end', backgroundColor: `${colors.teal}26` },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  bubbleText: { color: colors.text, fontSize: 14, lineHeight: 20, fontFamily: fontFamily.regular },
  warning: { color: colors.amber, fontSize: 12.5, lineHeight: 17, fontFamily: fontFamily.medium },
  citations: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  chip: { maxWidth: '100%', borderRadius: radius.pill, backgroundColor: colors.cardAlt, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { color: colors.textSecondary, fontSize: 12, fontFamily: fontFamily.medium },
  before: { color: colors.textTertiary, fontSize: 13, textDecorationLine: 'line-through', fontFamily: fontFamily.regular },
  after: { color: colors.text, fontSize: 13.5, fontFamily: fontFamily.semibold },
  error: { color: colors.red, fontSize: 13, fontFamily: fontFamily.regular },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingHorizontal: spacing.screenX, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  input: {
    flex: 1,
    color: colors.text,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 14.5,
    maxHeight: 120,
    fontFamily: fontFamily.regular,
  },
  footer: { color: colors.textTertiary, fontSize: 11, textAlign: 'center', paddingVertical: spacing.sm, fontFamily: fontFamily.regular },
});
