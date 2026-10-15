import { tr } from '@/lib/i18n/tr';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { GradientButton } from '@/components/ui/GradientButton';
import { NumberField } from '@/components/ui/NumberField';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { FieldCard } from '@/components/workout/FieldCard';
import { kjToKcal, validateFood } from '@/lib/nutrition/engine';
import type { NutrientBasis, NutrientKey, Nutrients } from '@/lib/nutrition/model';
import type { FoodInput } from '@/lib/nutrition/state';
import { strings } from '@/lib/strings';
import { colors, fontFamily, spacing } from '@/theme/colors';

const FIELDS: { key: NutrientKey; label: string; suffix: string }[] = [
  { key: 'protein_g', label: tr('Protein', 'Eiweiß'), suffix: 'g' },
  { key: 'carbohydrate_g', label: tr('Carbohydrate', 'Kohlenhydrate'), suffix: 'g' },
  { key: 'fat_g', label: tr('Fat', 'Fett'), suffix: 'g' },
  { key: 'fiber_g', label: tr('Fiber', 'Ballaststoffe'), suffix: 'g' },
  { key: 'sugar_g', label: tr('Sugar', 'Zucker'), suffix: 'g' },
  { key: 'sodium_mg', label: tr('Sodium', 'Natrium'), suffix: 'mg' },
];

type Props = {
  onSave: (input: FoodInput) => { ok: boolean; issues?: { message: string }[] };
  onCancel: () => void;
};

/** A food typed in from its label. Empty fields stay unknown. */
export function FoodForm({ onSave, onCancel }: Props) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [basis, setBasis] = useState<NutrientBasis>('per_100g');
  const [servingLabel, setServingLabel] = useState('');
  const [servingGrams, setServingGrams] = useState<number | undefined>(undefined);
  const [energy, setEnergy] = useState<number | undefined>(undefined);
  const [energyUnit, setEnergyUnit] = useState<'kcal' | 'kj'>('kcal');
  const [values, setValues] = useState<Partial<Record<NutrientKey, number>>>({});
  const [isFluid, setIsFluid] = useState(false);
  const [messages, setMessages] = useState<{ text: string; warning?: boolean }[]>([]);
  const [confirmedWarnings, setConfirmedWarnings] = useState(false);

  const build = (): FoodInput => {
    const nutrients: Nutrients = {};
    if (energy !== undefined) nutrients.energy_kcal = Math.round((energyUnit === 'kj' ? kjToKcal(energy) : energy) * 10) / 10;
    for (const f of FIELDS) if (values[f.key] !== undefined) nutrients[f.key] = values[f.key];
    const servings = servingLabel.trim() ? [{ label: servingLabel.trim(), ...(servingGrams ? { grams: servingGrams } : {}) }] : [];
    return { name, brand, basis, nutrients, servings, isFluid: isFluid || basis === 'per_100ml' || undefined };
  };

  const submit = () => {
    const input = build();
    const issues = validateFood(input);
    const errors = issues.filter((i) => i.severity === 'error');
    const warnings = issues.filter((i) => i.severity === 'warning');
    if (errors.length || (warnings.length && !confirmedWarnings)) {
      setMessages([...errors.map((i) => ({ text: i.message })), ...warnings.map((i) => ({ text: i.message, warning: true }))]);
      if (!errors.length) setConfirmedWarnings(true);
      return;
    }
    const res = onSave(input);
    if (!res.ok) setMessages((res.issues ?? []).map((i) => ({ text: i.message })));
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.hint}>{strings.labelHint}</Text>
      <FieldCard label={strings.newFoodName} value={name} onChangeText={setName} cardStyle={styles.field} />
      <FieldCard label={strings.newFoodBrand} value={brand} onChangeText={setBrand} cardStyle={styles.field} />
      <Text style={styles.label}>{strings.valuesPer}</Text>
      <SegmentedTabs
        options={[
          { key: 'per_100g', label: strings.per100g },
          { key: 'per_100ml', label: strings.per100ml },
          { key: 'per_serving', label: strings.perServing },
        ]}
        value={basis}
        onChange={(k) => setBasis(k as NutrientBasis)}
        size="sm"
      />
      <View style={styles.row}>
        <FieldCard label={strings.servingDescription} value={servingLabel} onChangeText={setServingLabel} placeholder={strings.servingDescriptionPlaceholder} cardStyle={[styles.field, { flex: 1 }]} />
        <NumberField label={strings.servingGrams} value={servingGrams} onChange={setServingGrams} decimals />
      </View>
      <View style={styles.row}>
        <NumberField label={strings.energy} suffix={energyUnit === 'kj' ? 'kJ' : 'kcal'} value={energy} onChange={setEnergy} decimals />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text style={styles.label}>{strings.energyUnit}</Text>
          <SegmentedTabs options={[{ key: 'kcal', label: 'kcal' }, { key: 'kj', label: 'kJ' }]} value={energyUnit} onChange={(k) => setEnergyUnit(k as 'kcal' | 'kj')} size="sm" />
        </View>
      </View>
      <View style={styles.grid}>
        {FIELDS.map((f) => (
          <NumberField
            key={f.key}
            label={f.label}
            suffix={f.suffix}
            decimals
            value={values[f.key]}
            onChange={(v) => setValues((cur) => ({ ...cur, [f.key]: v }))}
            style={styles.gridItem}
          />
        ))}
      </View>
      {basis !== 'per_100ml' ? (
        <TouchableOpacity style={styles.toggle} onPress={() => setIsFluid(!isFluid)} accessibilityRole="checkbox" accessibilityState={{ checked: isFluid }} aria-checked={isFluid}>
          <View style={[styles.box, isFluid && styles.boxOn]} />
          <Text style={styles.toggleText}>{strings.isDrink}</Text>
        </TouchableOpacity>
      ) : null}
      {messages.map((m) => (
        <Text key={m.text} style={[styles.error, m.warning && styles.warning]} accessibilityLiveRegion="polite">
          {m.text}
        </Text>
      ))}
      <View style={styles.row}>
        <GradientButton label={strings.cancel} variant="secondary" style={{ flex: 1 }} onPress={onCancel} />
        <GradientButton label={strings.saveFood} style={{ flex: 1 }} onPress={submit} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  field: { marginBottom: 0 },
  hint: { color: colors.textSecondary, fontSize: 12.5, lineHeight: 18, fontFamily: fontFamily.regular },
  label: { color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.medium },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-end' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  // NumberField grows to fill its row; a basis of just under half gives two per row.
  gridItem: { flexBasis: '45%', flexGrow: 1 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.textTertiary },
  boxOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  toggleText: { color: colors.text, fontSize: 14, fontFamily: fontFamily.regular },
  error: { color: colors.red, fontSize: 13, lineHeight: 18, fontFamily: fontFamily.regular },
  warning: { color: colors.amber },
});
