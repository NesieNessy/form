import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { FoodForm } from '@/components/nutrition/FoodForm';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { GradientButton } from '@/components/ui/GradientButton';
import { NumberField } from '@/components/ui/NumberField';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { FieldCard } from '@/components/workout/FieldCard';
import { TimePickerModal } from '@/components/workout/TimePickerModal';
import { formatTimeLabel } from '@/lib/date';
import { localDateOf } from '@/lib/health/model';
import { searchFoods } from '@/lib/nutrition/catalog';
import { nutrientsFor, unitsFor, validateQuantity } from '@/lib/nutrition/engine';
import { quantityText } from '@/lib/nutrition/format';
import { MEAL_TYPES, NUTRIENTS, formatNutrient, type Food, type FoodSnapshot, type MealType, type NutrientKey, type Nutrients, type Quantity, type QuantityUnit } from '@/lib/nutrition/model';
import type { LogContext } from '@/lib/nutrition/state';
import { strings } from '@/lib/strings';
import { useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, iconStrokeWidth, radius, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

type Tab = 'search' | 'quick' | 'saved' | 'new';
const PREVIEW: NutrientKey[] = ['energy_kcal', 'protein_g', 'carbohydrate_g', 'fat_g'];

function defaultMeal(ms: number, sessionId?: string): MealType {
  if (sessionId) return 'during_workout';
  const h = new Date(ms).getHours();
  return h < 10 ? 'breakfast' : h < 15 ? 'lunch' : h >= 18 && h < 22 ? 'dinner' : 'snack';
}

function defaultTime(date: string | undefined): number {
  const now = Date.now();
  if (!date || date === localDateOf(now)) return now;
  return new Date(`${date}T12:00:00`).getTime();
}

export default function NutritionAddScreen() {
  const params = useLocalSearchParams<{ date?: string; mealType?: MealType; sessionId?: string; entryId?: string }>();
  const entry = useWorkoutsStore((s) => (params.entryId ? s.foodLog[params.entryId] : undefined));
  const editing = !!params.entryId;

  return (
    <View style={styles.screen}>
      <DetailHeader title={editing ? strings.editEntryTitle : strings.addFoodTitle} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {editing ? (
          entry && !entry.deletedAt ? (
            <EditEntry entryId={entry.id} />
          ) : (
            <Text style={styles.empty}>{strings.entryNotFound}</Text>
          )
        ) : (
          <AddEntry date={params.date} mealType={params.mealType} sessionId={params.sessionId} />
        )}
      </ScrollView>
    </View>
  );
}

// ------------------------------------------------------------------- add

function AddEntry({ date, mealType, sessionId }: { date?: string; mealType?: MealType; sessionId?: string }) {
  const [tab, setTab] = useState<Tab>('search');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Food | FoodSnapshot | null>(null);
  const foods = useWorkoutsStore((s) => s.foods);
  const savedMeals = useWorkoutsStore((s) => s.savedMeals);
  const addFood = useWorkoutsStore((s) => s.addFood);
  const logSavedMeal = useWorkoutsStore((s) => s.logSavedMeal);
  const logQuickAdd = useWorkoutsStore((s) => s.logQuickAdd);
  const [ctx, setCtx] = useState<LogContext>(() => {
    const at = defaultTime(date);
    return { consumedAt: at, mealType: mealType ?? defaultMeal(at, sessionId), sessionId };
  });
  const [errors, setErrors] = useState<string[]>([]);

  const results = useMemo(() => searchFoods(query, Object.values(foods)), [query, foods]);
  const meals = Object.values(savedMeals).filter((m) => !m.deletedAt);

  if (picked) {
    return <QuantityPanel food={picked} ctx={ctx} setCtx={setCtx} onCancel={() => setPicked(null)} />;
  }

  return (
    <>
      <SegmentedTabs
        options={[
          { key: 'search', label: strings.tabSearch },
          { key: 'quick', label: strings.tabQuickAdd },
          { key: 'saved', label: strings.tabSaved },
          { key: 'new', label: strings.tabNewFood },
        ]}
        value={tab}
        onChange={(k) => {
          setTab(k as Tab);
          setErrors([]);
        }}
        scrollable
        size="sm"
      />

      {tab === 'search' ? (
        <>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={strings.searchFoodsPlaceholder}
            placeholderTextColor={colors.textTertiary}
            style={styles.search}
            accessibilityLabel={strings.tabSearch}
            autoFocus
          />
          <Text style={styles.hint}>{strings.catalogNote}</Text>
          {results.length === 0 ? <Text style={styles.empty}>{strings.noFoodsFound}</Text> : null}
          {results.map((f) => (
            <TouchableOpacity key={f.id} activeOpacity={0.75} onPress={() => setPicked(f)}>
              <Card style={styles.foodRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.foodName}>{f.name}</Text>
                  <Text style={styles.meta}>{[f.brand, f.source === 'user' ? strings.ownFood : undefined].filter(Boolean).join(' · ') || basisText(f)}</Text>
                </View>
                <Icons.chevronRight size={18} color={colors.textTertiary} />
              </Card>
            </TouchableOpacity>
          ))}
        </>
      ) : null}

      {tab === 'quick' ? (
        <QuickAddForm
          ctx={ctx}
          setCtx={setCtx}
          submitLabel={strings.logIt}
          errors={errors}
          onSubmit={(input) => {
            const res = logQuickAdd(input, ctx);
            if (!res.ok) return setErrors(res.issues.map((i) => i.message));
            router.back();
          }}
        />
      ) : null}

      {tab === 'saved' ? (
        <>
          {meals.length === 0 ? <Text style={styles.empty}>{strings.noSavedMeals}</Text> : null}
          {meals.length ? <ContextFields ctx={ctx} setCtx={setCtx} /> : null}
          {meals.map((m) => (
            <Card key={m.id} style={styles.card}>
              <Text style={styles.foodName}>{m.name}</Text>
              <Text style={styles.meta}>{m.items.map((i) => `${i.food.name} (${quantityText(i.quantity)})`).join(', ')}</Text>
              <GradientButton
                label={strings.logSavedMeal}
                variant="secondary"
                onPress={() => {
                  const res = logSavedMeal(m.id, ctx);
                  if (!res.ok) return setErrors(res.issues.map((i) => i.message));
                  router.back();
                }}
              />
            </Card>
          ))}
          <Errors errors={errors} />
        </>
      ) : null}

      {tab === 'new' ? (
        <FoodForm
          onCancel={() => setTab('search')}
          onSave={(input) => {
            const res = addFood(input);
            if (res.ok) setPicked(useWorkoutsStore.getState().foods[res.foodId]);
            return res;
          }}
        />
      ) : null}
    </>
  );
}

function basisText(f: Food): string {
  const e = f.nutrients.energy_kcal;
  const p = f.nutrients.protein_g;
  const per = f.basis === 'per_100g' ? 'per 100 g' : f.basis === 'per_100ml' ? 'per 100 ml' : `per ${f.servings[0]?.label ?? 'serving'}`;
  return [typeof p === 'number' ? `${formatNutrient('protein_g', p)} protein` : undefined, typeof e === 'number' ? formatNutrient('energy_kcal', e) : undefined, per].filter(Boolean).join(' · ');
}

// --------------------------------------------------------------- amount

function QuantityPanel({ food, ctx, setCtx, onCancel }: { food: Food | FoodSnapshot; ctx: LogContext; setCtx: (c: LogContext) => void; onCancel: () => void }) {
  const logFood = useWorkoutsStore((s) => s.logFood);
  const units = unitsFor(food);
  const [unit, setUnit] = useState<QuantityUnit>(units.includes('serving') && food.basis === 'per_serving' ? 'serving' : units[0] ?? 'serving');
  const [servingLabel, setServingLabel] = useState(food.servings[0]?.label);
  const [value, setValue] = useState<number | undefined>(unit === 'serving' ? 1 : 100);
  const [errors, setErrors] = useState<string[]>([]);
  const quantity: Quantity | undefined = value !== undefined ? { value, unit, ...(unit === 'serving' ? { servingLabel } : {}) } : undefined;

  return (
    <>
      <Card style={styles.card}>
        <Text style={styles.foodName}>{food.name}</Text>
        {food.sourceNote ? <Text style={styles.meta}>{food.sourceNote}</Text> : null}
        <AmountFields food={food} unit={unit} setUnit={setUnit} servingLabel={servingLabel} setServingLabel={setServingLabel} value={value} setValue={setValue} />
        <Preview food={food} quantity={quantity} />
      </Card>
      <ContextFields ctx={ctx} setCtx={setCtx} />
      <Errors errors={errors} />
      <View style={styles.row}>
        <GradientButton label={strings.cancel} variant="secondary" style={{ flex: 1 }} onPress={onCancel} />
        <GradientButton
          label={strings.logIt}
          style={{ flex: 1 }}
          onPress={() => {
            if (!quantity) return setErrors([strings.cannotSaveYet]);
            const res = logFood(food, quantity, ctx);
            if (!res.ok) return setErrors(res.issues.map((i) => i.message));
            router.back();
          }}
        />
      </View>
    </>
  );
}

function AmountFields(props: {
  food: Food | FoodSnapshot;
  unit: QuantityUnit;
  setUnit: (u: QuantityUnit) => void;
  servingLabel?: string;
  setServingLabel: (s: string) => void;
  value?: number;
  setValue: (v: number | undefined) => void;
}) {
  const { food, unit, setUnit, servingLabel, setServingLabel, value, setValue } = props;
  const units = unitsFor(food);
  return (
    <>
      <View style={styles.row}>
        <NumberField label={strings.amount} value={value} onChange={setValue} decimals />
        <View style={{ flex: 1.4, gap: spacing.xs }}>
          <Text style={styles.label}>{' '}</Text>
          <SegmentedTabs
            options={units.map((u) => ({ key: u, label: u === 'serving' ? (food.servings.length === 1 ? food.servings[0].label : 'serving') : u }))}
            value={unit}
            onChange={(u) => {
              setUnit(u as QuantityUnit);
              setValue(u === 'serving' ? 1 : 100);
            }}
            size="sm"
          />
        </View>
      </View>
      {unit === 'serving' && food.servings.length > 1 ? (
        <SegmentedTabs options={food.servings.map((s) => ({ key: s.label, label: s.label }))} value={servingLabel ?? food.servings[0].label} onChange={setServingLabel} size="sm" />
      ) : null}
    </>
  );
}

function Preview({ food, quantity }: { food: Food | FoodSnapshot; quantity?: Quantity }) {
  const hideEnergy = useWorkoutsStore((s) => !!s.profile.hideEnergy);
  if (!quantity) return null;
  const issues = validateQuantity(food, quantity);
  if (issues.length) return <Text style={styles.error}>{issues[0].message}</Text>;
  const res = nutrientsFor(food, quantity);
  if (!res) return null;
  return (
    <View style={styles.previewRow}>
      {PREVIEW.filter((k) => !(hideEnergy && k === 'energy_kcal')).map((k) => (
        <View key={k} style={styles.previewCell}>
          <Text style={styles.meta}>{NUTRIENTS[k].label}</Text>
          <Text style={styles.previewValue}>{typeof res.nutrients[k] === 'number' ? formatNutrient(k, res.nutrients[k] as number) : '?'}</Text>
        </View>
      ))}
    </View>
  );
}

// ------------------------------------------------------- shared fields

function ContextFields({ ctx, setCtx }: { ctx: LogContext; setCtx: (c: LogContext) => void }) {
  const [picking, setPicking] = useState(false);
  return (
    <Card style={styles.card}>
      <Text style={styles.label}>{strings.meal}</Text>
      <SegmentedTabs options={MEAL_TYPES.map((m) => ({ key: m.key, label: m.label }))} value={ctx.mealType} onChange={(k) => setCtx({ ...ctx, mealType: k as MealType })} scrollable size="sm" />
      <TouchableOpacity style={styles.timeRow} onPress={() => setPicking(true)} accessibilityRole="button">
        <Icons.clock size={16} color={colors.textSecondary} strokeWidth={iconStrokeWidth} />
        <Text style={styles.label}>{strings.time}</Text>
        <Text style={styles.timeValue}>{formatTimeLabel(new Date(ctx.consumedAt))}</Text>
      </TouchableOpacity>
      <TimePickerModal
        visible={picking}
        time={new Date(ctx.consumedAt)}
        onClose={() => setPicking(false)}
        onSelect={(t) => {
          const d = new Date(ctx.consumedAt);
          d.setHours(t.getHours(), t.getMinutes(), 0, 0);
          setCtx({ ...ctx, consumedAt: d.getTime() });
          setPicking(false);
        }}
      />
      <TouchableOpacity style={styles.toggle} onPress={() => setCtx({ ...ctx, estimated: !ctx.estimated })} accessibilityRole="checkbox" accessibilityState={{ checked: !!ctx.estimated }}>
        <View style={[styles.box, ctx.estimated && styles.boxOn]} />
        <Text style={styles.toggleText}>{strings.estimateToggle}</Text>
      </TouchableOpacity>
      <FieldCard label={strings.noteOptional} value={ctx.note ?? ''} onChangeText={(note) => setCtx({ ...ctx, note })} placeholder={strings.notePlaceholder} cardStyle={{ marginBottom: 0 }} />
    </Card>
  );
}

function QuickAddForm(props: {
  ctx: LogContext;
  setCtx: (c: LogContext) => void;
  initial?: { label?: string; nutrients: Nutrients; fluidMl?: number };
  submitLabel: string;
  errors: string[];
  onSubmit: (input: { label?: string; nutrients: Nutrients; fluidMl?: number }) => void;
  hideContext?: boolean;
}) {
  const { ctx, setCtx, initial, submitLabel, errors, onSubmit, hideContext } = props;
  const hideEnergy = useWorkoutsStore((s) => !!s.profile.hideEnergy);
  const [label, setLabel] = useState(initial?.label ?? '');
  const num = (k: NutrientKey) => (typeof initial?.nutrients[k] === 'number' ? (initial?.nutrients[k] as number) : undefined);
  const [values, setValues] = useState<Partial<Record<NutrientKey, number>>>({
    energy_kcal: num('energy_kcal'),
    protein_g: num('protein_g'),
    carbohydrate_g: num('carbohydrate_g'),
    fat_g: num('fat_g'),
  });
  const [fluid, setFluid] = useState<number | undefined>(initial?.fluidMl);
  const keys: NutrientKey[] = (['energy_kcal', 'protein_g', 'carbohydrate_g', 'fat_g'] as NutrientKey[]).filter((k) => !(hideEnergy && k === 'energy_kcal'));
  return (
    <>
      <Card style={styles.card}>
        <Text style={styles.hint}>{strings.quickAddHint}</Text>
        <FieldCard label={strings.quickAddLabel} value={label} onChangeText={setLabel} placeholder={strings.quickAddLabelPlaceholder} cardStyle={{ marginBottom: 0 }} />
        <View style={styles.grid}>
          {keys.map((k) => (
            <NumberField key={k} label={NUTRIENTS[k].label} suffix={NUTRIENTS[k].unit} decimals value={values[k]} onChange={(v) => setValues((cur) => ({ ...cur, [k]: v }))} style={styles.gridItem} />
          ))}
          <NumberField label={strings.fluid} suffix="ml" value={fluid} onChange={setFluid} style={styles.gridItem} />
        </View>
      </Card>
      {hideContext ? null : <ContextFields ctx={ctx} setCtx={setCtx} />}
      <Errors errors={errors} />
      <GradientButton
        label={submitLabel}
        onPress={() => {
          const nutrients: Nutrients = {};
          for (const k of keys) if (values[k] !== undefined) nutrients[k] = values[k];
          if (hideEnergy && typeof initial?.nutrients.energy_kcal === 'number') nutrients.energy_kcal = initial.nutrients.energy_kcal;
          onSubmit({ label, nutrients, fluidMl: fluid });
        }}
      />
    </>
  );
}

function Errors({ errors }: { errors: string[] }) {
  return (
    <>
      {errors.map((e) => (
        <Text key={e} style={styles.error} accessibilityLiveRegion="polite">
          {e}
        </Text>
      ))}
    </>
  );
}

// ------------------------------------------------------------------ edit

function EditEntry({ entryId }: { entryId: string }) {
  const entry = useWorkoutsStore((s) => s.foodLog[entryId]);
  const updateEntry = useWorkoutsStore((s) => s.updateEntry);
  const removeEntry = useWorkoutsStore((s) => s.removeEntry);
  const [ctx, setCtx] = useState<LogContext>({ mealType: entry.mealType, consumedAt: entry.consumedAt, sessionId: entry.sessionId, estimated: entry.estimated, note: entry.note });
  const [unit, setUnit] = useState<QuantityUnit>(entry.quantity?.unit ?? 'g');
  const [servingLabel, setServingLabel] = useState(entry.quantity?.servingLabel);
  const [value, setValue] = useState<number | undefined>(entry.quantity?.value);
  const [errors, setErrors] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const quantity: Quantity | undefined = value !== undefined ? { value, unit, ...(unit === 'serving' ? { servingLabel } : {}) } : undefined;
  const contextPatch = { mealType: ctx.mealType, consumedAt: ctx.consumedAt, estimated: !!ctx.estimated, note: ctx.note ?? '' };

  const deleteBlock = confirming ? (
    <Card style={styles.card}>
      <View style={styles.row}>
        <GradientButton label={strings.cancel} variant="secondary" style={{ flex: 1 }} onPress={() => setConfirming(false)} />
        <GradientButton
          label={strings.deleteEntry}
          colorsOverride={[colors.red, colors.red]}
          style={{ flex: 1 }}
          onPress={() => {
            removeEntry(entryId);
            router.back();
          }}
        />
      </View>
    </Card>
  ) : (
    <GradientButton label={strings.deleteEntry} variant="tertiary" onPress={() => setConfirming(true)} />
  );

  if (!entry.food) {
    return (
      <>
        <QuickAddForm
          ctx={ctx}
          setCtx={setCtx}
          initial={{ label: entry.label, nutrients: entry.nutrients, fluidMl: entry.fluidMl }}
          submitLabel={strings.saveChanges}
          errors={errors}
          onSubmit={(input) => {
            const res = updateEntry(entryId, { ...contextPatch, label: input.label ?? '', nutrients: input.nutrients, fluidMl: input.fluidMl });
            if (!res.ok) return setErrors(res.issues.map((i) => i.message));
            router.back();
          }}
        />
        {deleteBlock}
      </>
    );
  }

  return (
    <>
      <Card style={styles.card}>
        <Text style={styles.foodName}>{entry.food.name}</Text>
        <AmountFields food={entry.food} unit={unit} setUnit={setUnit} servingLabel={servingLabel} setServingLabel={setServingLabel} value={value} setValue={setValue} />
        <Preview food={entry.food} quantity={quantity} />
      </Card>
      <ContextFields ctx={ctx} setCtx={setCtx} />
      <Errors errors={errors} />
      <GradientButton
        label={strings.saveChanges}
        onPress={() => {
          if (!quantity) return setErrors([strings.cannotSaveYet]);
          const res = updateEntry(entryId, { ...contextPatch, quantity });
          if (!res.ok) return setErrors(res.issues.map((i) => i.message));
          router.back();
        }}
      />
      {deleteBlock}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-end' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  // NumberField grows to fill its row; a basis of just under half gives two per row.
  gridItem: { flexBasis: '45%', flexGrow: 1 },
  search: {
    color: colors.text,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: fontFamily.regular,
  },
  foodRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  foodName: { color: colors.text, fontSize: 15, fontFamily: fontFamily.semibold },
  meta: { color: colors.textTertiary, fontSize: 12, marginTop: 2, fontFamily: fontFamily.regular },
  hint: { color: colors.textTertiary, fontSize: 12, lineHeight: 17, fontFamily: fontFamily.regular },
  empty: { color: colors.textSecondary, fontSize: 13, fontFamily: fontFamily.regular },
  label: { color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.medium },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  previewCell: { alignItems: 'flex-start' },
  previewValue: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold, marginTop: 2 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  timeValue: { color: colors.text, fontSize: 14, fontFamily: fontFamily.semibold, marginLeft: 'auto' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.textTertiary },
  boxOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  toggleText: { color: colors.text, fontSize: 14, fontFamily: fontFamily.regular },
  error: { color: colors.red, fontSize: 13, lineHeight: 18, fontFamily: fontFamily.regular },
});
