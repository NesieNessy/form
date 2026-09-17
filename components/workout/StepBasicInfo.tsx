import { Calendar, ChevronDown, Clock, Dumbbell, Flame, HeartPulse, MoreHorizontal } from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { GradientButton } from '@/components/ui/GradientButton';
import { IconPillSelector } from '@/components/ui/IconPillSelector';
import { FieldCard } from '@/components/workout/FieldCard';
import { formatDateLabel, formatTimeLabel } from '@/lib/date';
import { strings } from '@/lib/strings';
import type { WorkoutCategory } from '@/lib/types';
import { colors, fontFamily, iconStrokeWidth, spacing } from '@/theme/colors';
import { DatePickerModal } from './DatePickerModal';
import { TimePickerModal } from './TimePickerModal';
import { WizardHeader } from './WizardHeader';

const CATEGORY_OPTIONS = [
  { key: 'crossfit' as const, label: strings.categoryCrossfit, icon: Flame },
  { key: 'strength' as const, label: strings.categoryStrength, icon: Dumbbell },
  { key: 'endurance' as const, label: strings.categoryEndurance, icon: HeartPulse },
  { key: 'other' as const, label: strings.categoryOther, icon: MoreHorizontal },
];

const NOTES_MAX = 200;

type Props = {
  title: string;
  onTitleChange: (v: string) => void;
  date: Date;
  onDateChange: (v: Date) => void;
  startTime: Date;
  onStartTimeChange: (v: Date) => void;
  category: WorkoutCategory;
  onCategoryChange: (v: WorkoutCategory) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  onBack: () => void;
  onContinue: () => void;
};

export function StepBasicInfo({
  title,
  onTitleChange,
  date,
  onDateChange,
  startTime,
  onStartTimeChange,
  category,
  onCategoryChange,
  notes,
  onNotesChange,
  onBack,
  onContinue,
}: Props) {
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);

  return (
    <View style={styles.screen}>
      <WizardHeader title={strings.basicInfoTitle} subtitle={strings.basicInfoSubtitle} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FieldCard
          label={strings.titleOptional}
          value={title}
          onChangeText={onTitleChange}
          placeholder={strings.titlePlaceholder}
        />

        <View style={styles.row}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.8} onPress={() => setDatePickerVisible(true)}>
            <Card style={styles.pickerCard}>
              <Calendar size={16} color={colors.textSecondary} strokeWidth={iconStrokeWidth} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{strings.date}</Text>
                <Text style={styles.pickerValue}>{formatDateLabel(date)}</Text>
              </View>
              <ChevronDown size={16} color={colors.textTertiary} strokeWidth={iconStrokeWidth} />
            </Card>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.8} onPress={() => setTimePickerVisible(true)}>
            <Card style={styles.pickerCard}>
              <Clock size={16} color={colors.textSecondary} strokeWidth={iconStrokeWidth} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{strings.startTime}</Text>
                <Text style={styles.pickerValue}>{formatTimeLabel(startTime)}</Text>
              </View>
            </Card>
          </TouchableOpacity>
        </View>

        <DatePickerModal
          visible={datePickerVisible}
          date={date}
          onClose={() => setDatePickerVisible(false)}
          onSelect={(d) => {
            onDateChange(d);
            setDatePickerVisible(false);
          }}
        />
        <TimePickerModal
          visible={timePickerVisible}
          time={startTime}
          onClose={() => setTimePickerVisible(false)}
          onSelect={(t) => {
            onStartTimeChange(t);
            setTimePickerVisible(false);
          }}
        />

        <Text style={styles.sectionTitle}>{strings.category}</Text>
        <IconPillSelector options={CATEGORY_OPTIONS} value={category} onChange={onCategoryChange} />

        <Card style={styles.notesCard}>
          <Text style={styles.label}>{strings.notesOptional}</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={(v) => onNotesChange(v.slice(0, NOTES_MAX))}
            placeholder={strings.notesPlaceholder}
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={NOTES_MAX}
          />
          <Text style={styles.charCount}>
            {notes.length}/{NOTES_MAX}
          </Text>
        </Card>
      </ScrollView>
      <View style={styles.footer}>
        <GradientButton label={strings.continue} onPress={onContinue} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  label: { color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.medium },
  row: { flexDirection: 'row', gap: spacing.sm },
  pickerCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  pickerValue: { color: colors.text, fontSize: 14, fontFamily: fontFamily.semibold, marginTop: 2 },
  sectionTitle: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold, marginBottom: spacing.sm },
  notesCard: { gap: 6 },
  notesInput: {
    color: colors.text,
    fontSize: 14,
    fontFamily: fontFamily.regular,
    padding: 0,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  charCount: { color: colors.textTertiary, fontSize: 11, textAlign: 'right', fontFamily: fontFamily.regular },
  footer: { paddingHorizontal: spacing.screenX, paddingTop: spacing.sm, paddingBottom: spacing.lg },
});
