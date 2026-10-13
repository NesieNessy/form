import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { GradientButton } from '@/components/ui/GradientButton';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { TabHeader } from '@/components/ui/TabHeader';
import { Toast } from '@/components/ui/Toast';
import { DatePickerModal } from '@/components/workout/DatePickerModal';
import { MonthCalendar } from '@/components/workout/MonthCalendar';
import { WorkoutCard } from '@/components/workout/WorkoutCard';
import { combineDateAndTime, isSameDay } from '@/lib/date';
import { strings } from '@/lib/strings';
import { useScheduleItems, useTemplates, type TemplateItem } from '@/lib/useWorkouts';
import { countExercises } from '@/lib/workout/model';
import { useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

const VIEW_TABS = [
  { key: 'list', label: strings.list },
  { key: 'calendar', label: strings.calendar },
  { key: 'templates', label: strings.templates },
];

export default function WorkoutsScreen() {
  const items = useScheduleItems();
  const templates = useTemplates();
  const scheduleWorkout = useWorkoutsStore((s) => s.scheduleWorkout);

  const [view, setView] = useState('list');
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [schedulingTemplate, setSchedulingTemplate] = useState<TemplateItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const dayItems = useMemo(
    () => items.filter((i) => isSameDay(new Date(i.entry.scheduledAt), selectedDay)).reverse(),
    [items, selectedDay]
  );

  if (items.length === 0 && templates.length === 0) {
    return (
      <View style={styles.screen}>
        <TabHeader />
        <ScrollView contentContainerStyle={styles.empty} showsVerticalScrollIndicator={false}>
          <View style={styles.iconWrap}>
            <Icons.dumbbell color={colors.textSecondary} size={28} />
          </View>
          <Text style={styles.title}>{strings.noWorkoutsPlannedYet}</Text>
          <Text style={styles.body}>{strings.workoutsEmptyBody}</Text>
          <View style={{ height: spacing.md }} />
          <GradientButton
            label={strings.newWorkout}
            onPress={() => router.push('/workout-new')}
            style={styles.newWorkoutButton}
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <TabHeader />
      <View style={styles.titleRow}>
        <Text style={styles.pageTitle}>{strings.workouts}</Text>
        <Text style={styles.pageSubtitle}>{strings.workoutsListSubtitle}</Text>
      </View>
      <View style={styles.tabsWrap}>
        <SegmentedTabs options={VIEW_TABS} value={view} onChange={setView} />
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {view === 'list' ? (
          <>
            <GradientButton label={strings.newWorkout} onPress={() => router.push('/workout-new')} />
            {items.map((item) => (
              <WorkoutCard key={item.entry.id} item={item} />
            ))}
          </>
        ) : null}

        {view === 'calendar' ? (
          <>
            <MonthCalendar items={items} selected={selectedDay} onSelect={setSelectedDay} />
            {dayItems.length === 0 ? <Text style={styles.dayEmpty}>{strings.nothingPlannedThisDay}</Text> : null}
            {dayItems.map((item) => (
              <WorkoutCard key={item.entry.id} item={item} showTime />
            ))}
            <GradientButton
              label={strings.planWorkoutThisDay}
              variant="secondary"
              onPress={() => router.push({ pathname: '/workout-new', params: { date: String(selectedDay.getTime()) } })}
            />
          </>
        ) : null}

        {view === 'templates' ? (
          templates.length === 0 ? (
            <View style={styles.templatesEmpty}>
              <Text style={styles.title}>{strings.noTemplatesYet}</Text>
              <Text style={styles.body}>{strings.noTemplatesBody}</Text>
            </View>
          ) : (
            templates.map((template) => {
              const count = countExercises(template.version.content);
              return (
                <Card key={template.workout.id} style={styles.templateRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.templateTitle} numberOfLines={1}>
                      {template.version.content.title}
                    </Text>
                    <Text style={styles.pageSubtitle}>
                      {count} {count === 1 ? strings.exercise : strings.exercisePlural}
                    </Text>
                  </View>
                  <GradientButton
                    label={strings.scheduleTemplate}
                    variant="secondary"
                    style={styles.templateBtn}
                    onPress={() => setSchedulingTemplate(template)}
                  />
                </Card>
              );
            })
          )
        ) : null}
      </ScrollView>

      <DatePickerModal
        visible={schedulingTemplate !== null}
        date={selectedDay}
        onClose={() => setSchedulingTemplate(null)}
        onSelect={(day) => {
          if (schedulingTemplate) {
            scheduleWorkout(schedulingTemplate.workout.id, combineDateAndTime(day, new Date()));
            setSelectedDay(day);
            setToast(strings.scheduled);
          }
          setSchedulingTemplate(null);
        }}
      />
      <Toast message={toast ?? ''} visible={Boolean(toast)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  titleRow: { paddingHorizontal: spacing.screenX, marginBottom: spacing.md },
  tabsWrap: { paddingHorizontal: spacing.screenX, marginBottom: spacing.md },
  pageTitle: { color: colors.text, fontSize: 22, fontFamily: fontFamily.bold },
  pageSubtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 4, fontFamily: fontFamily.regular },
  list: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
  dayEmpty: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', paddingVertical: spacing.md, fontFamily: fontFamily.regular },
  templatesEmpty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  templateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  templateTitle: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  templateBtn: { paddingHorizontal: spacing.lg, paddingVertical: 10 },
  empty: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.sm,
  },
  newWorkoutButton: {
    alignSelf: 'stretch',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontFamily: fontFamily.bold,
  },
  body: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});
