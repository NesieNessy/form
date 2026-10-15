import { Sensitive } from '@/components/ui/Sensitive';
import { SourceTag } from '@/components/ui/SourceTag';
import { foodEntrySource } from '@/lib/provenance';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { GradientButton } from '@/components/ui/GradientButton';
import { localDateOf } from '@/lib/health/model';
import { entriesOn, shiftDate, totals, weekSummary } from '@/lib/nutrition/engine';
import { entryAmount, entryName, fluidText, formatDayLabel, rangeText, totalText } from '@/lib/nutrition/format';
import { MEAL_TYPES, NUTRIENTS, formatNutrient, type FoodLogEntry, type NutrientKey } from '@/lib/nutrition/model';
import { DAY_TYPE_LABEL, targetsForDay, trainingDay } from '@/lib/nutrition/targets';
import { strings } from '@/lib/strings';
import { useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, iconStrokeWidth, radius, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

const SHOWN: NutrientKey[] = ['energy_kcal', 'protein_g', 'carbohydrate_g', 'fat_g', 'fiber_g'];

export default function NutritionScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const today = localDateOf(Date.now());
  const [date, setDate] = useState(params.date ?? today);
  const foodLog = useWorkoutsStore((s) => s.foodLog);
  const profile = useWorkoutsStore((s) => s.profile);
  const scheduled = useWorkoutsStore((s) => s.scheduled);
  const versions = useWorkoutsStore((s) => s.versions);
  const saveMeal = useWorkoutsStore((s) => s.saveMeal);
  const [saving, setSaving] = useState<string | null>(null);
  const [mealName, setMealName] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const all = useMemo(() => Object.values(foodLog), [foodLog]);
  const entries = useMemo(() => entriesOn(all, date), [all, date]);
  const day = useMemo(() => totals(entries), [entries]);
  const week = useMemo(() => weekSummary(all, date), [all, date]);
  const training = useMemo(() => trainingDay(date, Object.values(scheduled), versions, profile.minutesPerSession), [date, scheduled, versions, profile.minutesPerSession]);
  const targets = targetsForDay(profile.nutritionTargets, training.dayType);
  const shown = SHOWN.filter((k) => !(profile.hideEnergy && k === 'energy_kcal'));
  const incomplete = entries.filter((e) => shown.some((k) => typeof e.nutrients[k] !== 'number')).length;

  const byMeal = MEAL_TYPES.map((m) => ({ ...m, entries: entries.filter((e) => e.mealType === m.key) })).filter((m) => m.entries.length);
  const add = (mealType?: string) => router.push({ pathname: '/nutrition-add', params: { date, ...(mealType ? { mealType } : {}) } });

  return (
    <View style={styles.screen}>
      <DetailHeader title={strings.nutritionTitle} subtitle={strings.nutritionSubtitle} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.dayRow}>
          <TouchableOpacity onPress={() => setDate(shiftDate(date, -1))} hitSlop={10} accessibilityLabel={strings.previousDay}>
            <Icons.chevronLeft size={22} color={colors.text} strokeWidth={iconStrokeWidth} />
          </TouchableOpacity>
          <Text style={styles.dayLabel}>{formatDayLabel(date, today)}</Text>
          <TouchableOpacity onPress={() => date < today && setDate(shiftDate(date, 1))} hitSlop={10} accessibilityLabel={strings.nextDay} disabled={date >= today}>
            <Icons.chevronRight size={22} color={date >= today ? colors.textTertiary : colors.text} strokeWidth={iconStrokeWidth} />
          </TouchableOpacity>
        </View>

        <Card style={styles.card}>
          {training.workouts > 0 || profile.nutritionTargets ? (
            <Text style={styles.meta}>{strings.dayTypeLine(DAY_TYPE_LABEL[training.dayType], training.minutes, training.estimated)}</Text>
          ) : null}
          {shown.map((key) => {
            const target = rangeText(targets[key as keyof typeof targets], NUTRIENTS[key].unit);
            return (
              <View key={key} style={styles.totalRow}>
                <Text style={styles.totalLabel}>{NUTRIENTS[key].label}</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Sensitive style={styles.totalValue}>{totalText(key, day.nutrients[key], day.entries)}</Sensitive>
                  {target ? <Text style={styles.target}>{target}</Text> : null}
                </View>
              </View>
            );
          })}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{strings.fluid}</Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.totalValue}>{day.entries ? fluidText(day.fluidMl) : '–'}</Text>
              {rangeText(targets.fluid_ml, 'ml') ? <Text style={styles.target}>{rangeText(targets.fluid_ml, 'ml')}</Text> : null}
            </View>
          </View>
          {incomplete ? <Text style={styles.hint}>{strings.incompleteHint(incomplete)}</Text> : null}
          {day.estimated ? <Text style={styles.hint}>{strings.estimatedHint(day.estimated)}</Text> : null}
        </Card>

        <GradientButton label={strings.addFood} icon={<Icons.plus size={16} color={colors.onAction} strokeWidth={iconStrokeWidth} />} onPress={() => add()} />
        {message ? <Text style={styles.message}>{message}</Text> : null}

        {entries.length === 0 ? <Text style={styles.empty}>{strings.nothingLogged}</Text> : null}
        {byMeal.map((m) => (
          <Card key={m.key} style={styles.card}>
            <View style={styles.mealHead}>
              <Text style={[styles.cardTitle, { flex: 1 }]}>{m.label}</Text>
              <TouchableOpacity onPress={() => add(m.key)} hitSlop={8} accessibilityLabel={`${strings.addToMeal}: ${m.label}`}>
                <Icons.plus size={18} color={colors.teal} strokeWidth={iconStrokeWidth} />
              </TouchableOpacity>
            </View>
            {m.entries.map((e) => (
              <EntryRow key={e.id} entry={e} hideEnergy={!!profile.hideEnergy} />
            ))}
            {saving === m.key ? (
              <View style={styles.saveRow}>
                <TextInput
                  value={mealName}
                  onChangeText={setMealName}
                  placeholder={strings.mealNamePlaceholder}
                  placeholderTextColor={colors.textTertiary}
                  style={styles.input}
                  accessibilityLabel={strings.saveMealAs}
                />
                <GradientButton
                  label={strings.save}
                  style={{ minWidth: 90 }}
                  onPress={() => {
                    const res = saveMeal(mealName, m.entries.map((e) => e.id));
                    if (!res.ok) return setMessage(res.issues[0].message);
                    setSaving(null);
                    setMealName('');
                    setMessage(strings.mealSaved);
                  }}
                />
              </View>
            ) : m.entries.some((e) => e.food) ? (
              <TouchableOpacity onPress={() => setSaving(m.key)} hitSlop={6}>
                <Text style={styles.link}>{strings.saveMealAs}</Text>
              </TouchableOpacity>
            ) : null}
          </Card>
        ))}

        <Text style={styles.sectionTitle}>{strings.thisWeek}</Text>
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{strings.daysLogged(week.loggedDays, week.days)}</Text>
          {week.loggedDays > 0 ? (
            <>
              <Text style={styles.meta}>{strings.perDayAverage}</Text>
              {shown.slice(0, 4).map((key) => (
                <View key={key} style={styles.totalRow}>
                  <Text style={styles.totalLabel}>{NUTRIENTS[key].label}</Text>
                  <Text style={styles.totalValue}>
                    {week.average[key].incomplete ? strings.atLeast(formatNutrient(key, week.average[key].value)) : formatNutrient(key, week.average[key].value)}
                  </Text>
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{strings.fluid}</Text>
                <Text style={styles.totalValue}>{fluidText(week.averageFluidMl)}</Text>
              </View>
            </>
          ) : null}
          <Text style={styles.hint}>{strings.weekAverageHint}</Text>
        </Card>

        <GradientButton label={strings.targetsMenu} variant="secondary" onPress={() => router.push('/nutrition-targets')} />
      </ScrollView>
    </View>
  );
}

function EntryRow({ entry, hideEnergy }: { entry: FoodLogEntry; hideEnergy: boolean }) {
  const key: NutrientKey = hideEnergy ? 'protein_g' : 'energy_kcal';
  const v = entry.nutrients[key];
  return (
    <TouchableOpacity style={styles.entryRow} activeOpacity={0.7} onPress={() => router.push({ pathname: '/nutrition-add', params: { entryId: entry.id } })}>
      <View style={{ flex: 1 }}>
        <Text style={styles.entryName}>{entryName(entry)}</Text>
        <Text style={styles.meta}>{entryAmount(entry)}</Text>
        {foodEntrySource(entry) ? <SourceTag source={foodEntrySource(entry)!} /> : null}
      </View>
      <Sensitive style={styles.entryValue}>{typeof v === 'number' ? formatNutrient(key, v) : '–'}</Sensitive>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
  dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs },
  dayLabel: { color: colors.text, fontSize: 16, fontFamily: fontFamily.bold },
  card: { gap: spacing.sm },
  cardTitle: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  sectionTitle: { color: colors.text, fontSize: 16, fontFamily: fontFamily.bold, marginTop: spacing.md },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: colors.textSecondary, fontSize: 13.5, fontFamily: fontFamily.medium },
  totalValue: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  target: { color: colors.textTertiary, fontSize: 11.5, fontFamily: fontFamily.regular },
  meta: { color: colors.textTertiary, fontSize: 12, fontFamily: fontFamily.regular },
  hint: { color: colors.textTertiary, fontSize: 12, lineHeight: 17, fontFamily: fontFamily.regular },
  message: { color: colors.textSecondary, fontSize: 13, fontFamily: fontFamily.regular },
  empty: { color: colors.textSecondary, fontSize: 13, fontFamily: fontFamily.regular },
  mealHead: { flexDirection: 'row', alignItems: 'center' },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  entryName: { color: colors.text, fontSize: 14, fontFamily: fontFamily.semibold },
  entryValue: { color: colors.text, fontSize: 14, fontFamily: fontFamily.semibold },
  link: { color: colors.teal, fontSize: 13, fontFamily: fontFamily.semibold, paddingTop: spacing.xs },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    flex: 1,
    color: colors.text,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: fontFamily.regular,
  },
});
