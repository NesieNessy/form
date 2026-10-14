import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { GradientButton } from '@/components/ui/GradientButton';
import { NumberField } from '@/components/ui/NumberField';
import { rangeText } from '@/lib/nutrition/format';
import type { DayType, NutritionTargets, Range } from '@/lib/nutrition/model';
import { DAY_TYPE_LABEL, TARGET_RULES, checkTargets, suggestTargets } from '@/lib/nutrition/targets';
import { strings } from '@/lib/strings';
import { useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, spacing } from '@/theme/colors';

type Key = 'energy_kcal' | 'protein_g' | 'carbohydrate_g' | 'fat_g' | 'fluid_ml';
const ROWS: { key: Key; label: string; unit: string }[] = [
  { key: 'energy_kcal', label: 'Energy', unit: 'kcal' },
  { key: 'protein_g', label: 'Protein', unit: 'g' },
  { key: 'carbohydrate_g', label: 'Carbohydrate', unit: 'g' },
  { key: 'fat_g', label: 'Fat', unit: 'g' },
  { key: 'fluid_ml', label: 'Fluid', unit: 'ml' },
];
const DAY_TYPES = Object.keys(DAY_TYPE_LABEL) as DayType[];

export default function NutritionTargetsScreen() {
  const profile = useWorkoutsStore((s) => s.profile);
  const observations = useWorkoutsStore((s) => s.observations);
  const updateProfile = useWorkoutsStore((s) => s.updateProfile);
  const [editing, setEditing] = useState(false);
  const [proposal, setProposal] = useState<NutritionTargets | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const targets = profile.nutritionTargets;
  const rows = ROWS.filter((r) => !(profile.hideEnergy && r.key === 'energy_kcal'));

  return (
    <View style={styles.screen}>
      <DetailHeader title={strings.targetsTitle} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <TouchableOpacity
            style={styles.toggle}
            onPress={() => updateProfile({ hideEnergy: !profile.hideEnergy })}
            accessibilityRole="switch"
            accessibilityState={{ checked: !!profile.hideEnergy }}
          >
            <View style={[styles.box, profile.hideEnergy && styles.boxOn]} />
            <Text style={styles.toggleText}>{strings.hideEnergy}</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>{strings.hideEnergyHint}</Text>
        </Card>

        <Text style={styles.sectionTitle}>{strings.yourTargets}</Text>
        {targets && !editing ? (
          <Card style={styles.card}>
            <Text style={styles.meta}>
              {targets.source === 'suggested' ? strings.targetsSourceSuggested(targets.ruleVersion ?? '', targets.weightKg ?? 0) : strings.targetsSourceManual}
            </Text>
            <TargetRows targets={targets} rows={rows} />
          </Card>
        ) : null}
        {!targets && !editing && !proposal ? <Text style={styles.empty}>{strings.noTargets}</Text> : null}

        {editing ? (
          <ManualTargets
            initial={targets}
            rows={rows}
            onCancel={() => setEditing(false)}
            onSave={(t) => {
              updateProfile({ nutritionTargets: { ...t, source: 'manual', approvedAt: Date.now() } });
              setEditing(false);
            }}
          />
        ) : null}

        {proposal ? (
          <Card style={[styles.card, styles.proposal]}>
            <Text style={styles.cardTitle}>{strings.suggestionTitle}</Text>
            <Text style={styles.body}>{strings.suggestionBody(proposal.weightKg ?? 0)}</Text>
            <TargetRows targets={proposal} rows={rows} />
            <Text style={styles.hint}>{TARGET_RULES.reference}</Text>
            <Text style={styles.hint}>{strings.suggestionNotAdvice}</Text>
            <View style={styles.row}>
              <GradientButton label={strings.discard} variant="secondary" style={{ flex: 1 }} onPress={() => setProposal(null)} />
              <GradientButton
                label={strings.approveTargets}
                style={{ flex: 1 }}
                onPress={() => {
                  updateProfile({ nutritionTargets: { ...proposal, approvedAt: Date.now() } });
                  setProposal(null);
                }}
              />
            </View>
          </Card>
        ) : null}

        {!editing && !proposal ? (
          <>
            <GradientButton
              label={strings.suggestTargets}
              onPress={() => {
                const s = suggestTargets(Object.values(observations), Date.now());
                if (!s.ok) return setNotice(strings.suggestionNeedsWeight);
                setNotice(null);
                setProposal(s.targets);
              }}
            />
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            <GradientButton label={targets ? strings.editTargets : strings.setTargets} variant="secondary" onPress={() => setEditing(true)} />
            {targets ? <GradientButton label={strings.removeTargets} variant="tertiary" onPress={() => updateProfile({ nutritionTargets: undefined })} /> : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function TargetRows({ targets, rows }: { targets: NutritionTargets; rows: typeof ROWS }) {
  return (
    <>
      {rows.map((r) => {
        if (r.key === 'carbohydrate_g' && targets.carbohydrateByDayType) {
          return (
            <View key={r.key} style={{ gap: 4 }}>
              <Text style={styles.rowLabel}>{strings.carbsByDay}</Text>
              {DAY_TYPES.map((t) => (
                <View key={t} style={styles.line}>
                  <Text style={styles.subLabel}>{DAY_TYPE_LABEL[t]}</Text>
                  <Text style={styles.value}>{rangeText(targets.carbohydrateByDayType?.[t], 'g')}</Text>
                </View>
              ))}
            </View>
          );
        }
        const text = rangeText(targets[r.key], r.unit);
        return text ? (
          <View key={r.key} style={styles.line}>
            <Text style={styles.rowLabel}>{r.label}</Text>
            <Text style={styles.value}>{text}</Text>
          </View>
        ) : null;
      })}
    </>
  );
}

function ManualTargets({ initial, rows, onSave, onCancel }: { initial?: NutritionTargets; rows: typeof ROWS; onSave: (t: Omit<NutritionTargets, 'source' | 'approvedAt'>) => void; onCancel: () => void }) {
  const [values, setValues] = useState<Partial<Record<Key, Range>>>(() =>
    Object.fromEntries(ROWS.map((r) => [r.key, initial?.source === 'manual' ? initial[r.key] ?? {} : {}]))
  );
  const [messages, setMessages] = useState<{ text: string; warning: boolean }[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const set = (key: Key, end: 'min' | 'max', v: number | undefined) => setValues((cur) => ({ ...cur, [key]: { ...cur[key], [end]: v } }));

  const submit = () => {
    const t: Omit<NutritionTargets, 'source' | 'approvedAt'> = {};
    for (const r of ROWS) {
      const range = values[r.key];
      if (range && (range.min !== undefined || range.max !== undefined)) t[r.key] = { ...(range.min !== undefined ? { min: range.min } : {}), ...(range.max !== undefined ? { max: range.max } : {}) };
    }
    const issues = checkTargets(t);
    const errors = issues.filter((i) => i.severity === 'error');
    const warnings = issues.filter((i) => i.severity === 'warning');
    if (errors.length || (warnings.length && !acknowledged)) {
      setMessages(issues.map((i) => ({ text: i.message, warning: i.severity === 'warning' })));
      if (!errors.length) setAcknowledged(true);
      return;
    }
    onSave(t);
  };

  return (
    <Card style={styles.card}>
      {rows.map((r) => (
        <View key={r.key} style={{ gap: spacing.xs }}>
          <Text style={styles.rowLabel}>{`${r.label} (${r.unit})`}</Text>
          <View style={styles.row}>
            <NumberField label={strings.minimum} value={values[r.key]?.min} onChange={(v) => set(r.key, 'min', v)} />
            <NumberField label={strings.maximum} value={values[r.key]?.max} onChange={(v) => set(r.key, 'max', v)} />
          </View>
        </View>
      ))}
      {messages.map((m) => (
        <Text key={m.text} style={[styles.error, m.warning && styles.warning]} accessibilityLiveRegion="polite">
          {m.text}
        </Text>
      ))}
      <View style={styles.row}>
        <GradientButton label={strings.cancel} variant="secondary" style={{ flex: 1 }} onPress={onCancel} />
        <GradientButton label={strings.save} style={{ flex: 1 }} onPress={submit} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
  card: { gap: spacing.sm },
  proposal: { borderColor: `${colors.teal}88` },
  cardTitle: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  sectionTitle: { color: colors.text, fontSize: 16, fontFamily: fontFamily.bold, marginTop: spacing.md },
  body: { color: colors.textSecondary, fontSize: 13.5, lineHeight: 19, fontFamily: fontFamily.regular },
  hint: { color: colors.textTertiary, fontSize: 12, lineHeight: 17, fontFamily: fontFamily.regular },
  meta: { color: colors.textTertiary, fontSize: 12, fontFamily: fontFamily.regular },
  empty: { color: colors.textSecondary, fontSize: 13, fontFamily: fontFamily.regular },
  notice: { color: colors.amber, fontSize: 13, lineHeight: 18, fontFamily: fontFamily.regular },
  line: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: colors.textSecondary, fontSize: 13.5, fontFamily: fontFamily.medium },
  subLabel: { color: colors.textTertiary, fontSize: 13, fontFamily: fontFamily.regular },
  value: { color: colors.text, fontSize: 14, fontFamily: fontFamily.semibold },
  row: { flexDirection: 'row', gap: spacing.md },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.textTertiary },
  boxOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  toggleText: { color: colors.text, fontSize: 14, fontFamily: fontFamily.regular },
  error: { color: colors.red, fontSize: 13, lineHeight: 18, fontFamily: fontFamily.regular },
  warning: { color: colors.amber },
});
