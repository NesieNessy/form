import { Sensitive } from '@/components/ui/Sensitive';
import { SourceTag } from '@/components/ui/SourceTag';
import { observationSource } from '@/lib/provenance';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from '@/components/charts/LineChart';
import { MeasurementForm } from '@/components/health/MeasurementForm';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { GradientButton } from '@/components/ui/GradientButton';
import { activityLine, activityTitle, formatActivityDate, metricWithUnit } from '@/lib/health/format';
import { metricOverview, metricSeries, type MetricToday } from '@/lib/health/logic';
import { METRICS, localDateOf, type ExternalActivity, type HealthObservation, type Provider } from '@/lib/health/model';
import { MAX_FILE_BYTES, parseActivityFile } from '@/lib/health/parse';
import { readPickedFile } from '@/lib/health/readFile';
import { strings, locale } from '@/lib/strings';
import { useContentWidth } from '@/lib/useContentWidth';
import { useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, iconStrokeWidth, radius, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

const SOURCES: { provider: Provider; label: string; status?: string }[] = [
  { provider: 'file', label: strings.sourceFiles },
  { provider: 'manual', label: strings.sourceManual },
  { provider: 'apple_health', label: strings.sourceAppleHealth, status: strings.sourceAppleHealthStatus },
  { provider: 'garmin', label: strings.sourceGarmin, status: strings.sourceGarminStatus },
];

export default function HealthScreen() {
  const activities = useWorkoutsStore((s) => s.activities);
  const observations = useWorkoutsStore((s) => s.observations);
  const importActivity = useWorkoutsStore((s) => s.importActivity);
  const addObservation = useWorkoutsStore((s) => s.addObservation);
  const removeSource = useWorkoutsStore((s) => s.removeSource);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState<Provider | null>(null);

  const liveActivities = useMemo(
    () => Object.values(activities).filter((a) => !a.deletedAt).sort((a, b) => b.startedAt - a.startedAt),
    [activities]
  );
  const liveObservations = useMemo(() => Object.values(observations).filter((o) => !o.deletedAt), [observations]);
  const toReview = liveActivities.filter((a) => a.status === 'new');
  const recent = liveActivities.filter((a) => a.status !== 'new').slice(0, 20);
  const overview = useMemo(() => metricOverview(liveObservations, localDateOf(Date.now())).filter((m) => m.latest), [liveObservations]);

  const pickFile = async () => {
    setMessage(null);
    const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    if (asset.size && asset.size > MAX_FILE_BYTES) {
      setMessage({ text: `${strings.importFailed} The file is larger than 25 MB.`, error: true });
      return;
    }
    setBusy(true);
    try {
      const parsed = parseActivityFile(await readPickedFile(asset), asset.name);
      if (!parsed.ok) {
        setMessage({ text: `${strings.importFailed} ${parsed.message}`, error: true });
        return;
      }
      const res = importActivity(parsed.activity);
      if (res.alreadyImported) setMessage({ text: strings.importAlreadyThere });
      router.push({ pathname: '/activity', params: { id: res.activityId } });
    } catch {
      setMessage({ text: strings.importFailed, error: true });
    } finally {
      setBusy(false);
    }
  };

  const counts = (provider: Provider) => [
    liveActivities.filter((a) => a.provider === provider).length,
    liveObservations.filter((o) => o.provider === provider).length,
  ] as const;

  return (
    <View style={styles.screen}>
      <DetailHeader title={strings.healthTitle} subtitle={strings.healthSubtitle} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{strings.activityFiles}</Text>
          <Text style={styles.hint}>{strings.activityFilesHint}</Text>
          <GradientButton
            label={busy ? strings.reading : strings.importActivityFile}
            icon={<Icons.upload size={16} color={colors.onAction} strokeWidth={iconStrokeWidth} />}
            onPress={busy ? undefined : pickFile}
          />
          {message ? (
            <Text style={[styles.message, message.error && styles.error]} accessibilityLiveRegion="polite">
              {message.text}
            </Text>
          ) : null}
        </Card>

        {toReview.length ? (
          <>
            <Text style={styles.sectionTitle}>{`${strings.toReview} (${toReview.length})`}</Text>
            <Text style={styles.sectionHint}>{strings.toReviewHint}</Text>
            {toReview.map((a) => (
              <ActivityRow key={a.id} activity={a} highlight />
            ))}
          </>
        ) : null}

        <Text style={styles.sectionTitle}>{strings.recentActivities}</Text>
        {recent.length === 0 && toReview.length === 0 ? <Text style={styles.empty}>{strings.noActivitiesYet}</Text> : null}
        {recent.map((a) => (
          <ActivityRow key={a.id} activity={a} />
        ))}

        <Text style={styles.sectionTitle}>{strings.measurements}</Text>
        <Text style={styles.sectionHint}>{strings.measurementsHint}</Text>
        {overview.length === 0 && !adding ? <Text style={styles.empty}>{strings.noMeasurementsYet}</Text> : null}
        {overview.map((m) => (
          <MetricCard key={m.metric} item={m} observations={liveObservations} />
        ))}
        {adding ? (
          <MeasurementForm
            onCancel={() => setAdding(false)}
            onSave={(input) => {
              addObservation(input);
              setAdding(false);
            }}
          />
        ) : (
          <GradientButton
            label={strings.addMeasurement}
            variant="secondary"
            icon={<Icons.plus size={16} color={colors.text} strokeWidth={iconStrokeWidth} />}
            onPress={() => setAdding(true)}
          />
        )}

        <Text style={styles.sectionTitle}>{strings.sources}</Text>
        {SOURCES.map((source) => {
          const [nActivities, nMeasurements] = counts(source.provider);
          const hasData = nActivities + nMeasurements > 0;
          return (
            <Card key={source.provider} style={styles.card}>
              <View style={styles.sourceRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{source.label}</Text>
                  <Text style={styles.rowMeta}>{source.status ?? strings.sourceCount(nActivities, nMeasurements)}</Text>
                </View>
                {hasData && confirming !== source.provider ? (
                  <TouchableOpacity onPress={() => setConfirming(source.provider)} hitSlop={8} accessibilityLabel={`${strings.deleteSourceData}: ${source.label}`}>
                    <Text style={styles.deleteLink}>{strings.deleteSourceData}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {confirming === source.provider ? (
                <>
                  <Text style={styles.confirmText}>{strings.confirmDeleteSource(source.label)}</Text>
                  <View style={styles.confirmRow}>
                    <GradientButton label={strings.cancel} variant="secondary" style={{ flex: 1 }} onPress={() => setConfirming(null)} />
                    <GradientButton
                      label={strings.deleteSourceData}
                      variant="danger"
                      style={{ flex: 1 }}
                      onPress={() => {
                        removeSource(source.provider);
                        setConfirming(null);
                      }}
                    />
                  </View>
                </>
              ) : null}
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}

function ActivityRow({ activity, highlight }: { activity: ExternalActivity; highlight?: boolean }) {
  return (
    <TouchableOpacity activeOpacity={0.75} onPress={() => router.push({ pathname: '/activity', params: { id: activity.id } })}>
      <Card style={[styles.activityRow, highlight && styles.highlight]}>
        <View style={styles.activityIcon}>
          <Icons.activity size={18} color={colors.teal} strokeWidth={iconStrokeWidth} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{activityTitle(activity)}</Text>
          <Text style={styles.rowMeta}>{`${formatActivityDate(activity.startedAt)} · ${activityLine(activity)}`}</Text>
        </View>
        <Icons.chevronRight size={18} color={colors.textTertiary} />
      </Card>
    </TouchableOpacity>
  );
}

function MetricCard({ item, observations }: { item: MetricToday; observations: HealthObservation[] }) {
  const [open, setOpen] = useState(false);
  const removeObservation = useWorkoutsStore((s) => s.removeObservation);
  const width = useContentWidth() - spacing.screenX * 2 - spacing.lg * 2;
  const latest = item.latest as HealthObservation;
  const meta = METRICS[item.metric];
  const series = open ? metricSeries(observations, item.metric, latest.method).slice(-60) : [];
  const history = open
    ? observations.filter((o) => o.metric === item.metric).sort((a, b) => b.observedAt - a.observedAt).slice(0, 14)
    : [];
  const shortDay = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(locale, { month: 'short', day: 'numeric' });

  return (
    <Card style={styles.card}>
      <TouchableOpacity style={styles.sourceRow} activeOpacity={0.7} onPress={() => setOpen(!open)} accessibilityRole="button">
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{latest.method ? `${meta.label} (${latest.method.toUpperCase()})` : meta.label}</Text>
          <Text style={styles.rowMeta}>
            {item.baseline.status === 'ready'
              ? strings.yourNormal(metricWithUnit(item.metric, item.baseline.median), item.baseline.days)
              : strings.baselineAfter(item.baseline.needed - item.baseline.days)}
          </Text>
          {item.unusual ? <Text style={styles.unusual}>{strings.outsideUsualRange}</Text> : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Sensitive style={styles.metricValue}>{metricWithUnit(item.metric, latest.value)}</Sensitive>
          <Text style={styles.rowMeta}>{shortDay(latest.localDate)}</Text>
          <SourceTag source={observationSource(latest.provider)} />
        </View>
      </TouchableOpacity>
      {series.length >= 2 ? (
        <LineChart points={series.map((p) => ({ label: shortDay(p.date), value: p.value }))} color={colors.teal} width={width} height={120} />
      ) : null}
      {history.map((o) => (
        <View key={o.id} style={styles.historyRow}>
          <Text style={styles.historyDate}>{shortDay(o.localDate)}</Text>
          <Sensitive style={styles.historyValue}>{metricWithUnit(o.metric, o.value)}</Sensitive>
          <TouchableOpacity onPress={() => removeObservation(o.id)} hitSlop={8} accessibilityLabel={`${strings.deleteWorkout} ${metricWithUnit(o.metric, o.value)}`}>
            <Icons.trash size={15} color={colors.textTertiary} strokeWidth={iconStrokeWidth} />
          </TouchableOpacity>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
  card: { gap: spacing.sm },
  cardTitle: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  hint: { color: colors.textSecondary, fontSize: 12.5, lineHeight: 18, fontFamily: fontFamily.regular },
  message: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, fontFamily: fontFamily.regular },
  error: { color: colors.red },
  sectionTitle: { color: colors.text, fontSize: 16, fontFamily: fontFamily.bold, marginTop: spacing.md },
  sectionHint: { color: colors.textTertiary, fontSize: 12.5, lineHeight: 18, marginTop: -spacing.sm, fontFamily: fontFamily.regular },
  empty: { color: colors.textSecondary, fontSize: 13, fontFamily: fontFamily.regular },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  highlight: { borderColor: `${colors.teal}88` },
  activityIcon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: `${colors.teal}22`, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: colors.text, fontSize: 14.5, fontFamily: fontFamily.semibold },
  rowMeta: { color: colors.textTertiary, fontSize: 12, marginTop: 2, fontFamily: fontFamily.regular },
  unusual: { color: colors.amber, fontSize: 12, marginTop: 3, fontFamily: fontFamily.medium },
  metricValue: { color: colors.text, fontSize: 16, fontFamily: fontFamily.bold },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  deleteLink: { color: colors.red, fontSize: 13, fontFamily: fontFamily.semibold },
  confirmText: { color: colors.text, fontSize: 13.5, lineHeight: 19, fontFamily: fontFamily.regular },
  confirmRow: { flexDirection: 'row', gap: spacing.md },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  historyDate: { flex: 1, color: colors.textSecondary, fontSize: 13, fontFamily: fontFamily.regular },
  historyValue: { color: colors.text, fontSize: 13.5, fontFamily: fontFamily.semibold },
});
