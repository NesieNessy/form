import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Share } from 'react-native';
import { StepBasicInfo } from '@/components/workout/StepBasicInfo';
import { StepExerciseDetail } from '@/components/workout/StepExerciseDetail';
import { StepSaveContinue } from '@/components/workout/StepSaveContinue';
import { StepSectionExercises } from '@/components/workout/StepSectionExercises';
import { StepSectionStructure } from '@/components/workout/StepSectionStructure';
import { StepSectionType } from '@/components/workout/StepSectionType';
import { StepWorkoutPreview } from '@/components/workout/StepWorkoutPreview';
import { StepWorkoutStructure } from '@/components/workout/StepWorkoutStructure';
import { combineDateAndTime } from '@/lib/date';
import { buildExerciseFromLibraryEntry, type ExerciseLibraryEntry } from '@/lib/exerciseLibrary';
import { generateId } from '@/lib/id';
import type { Exercise, SectionWorkoutType, WorkoutCategory, WorkoutSection, WorkoutStructure } from '@/lib/types';
import { defaultStructureForType, defaultWorkoutTypeForSection, wizardToContent } from '@/lib/workout/fromWizard';
import { formatWorkoutShareText } from '@/lib/workout/share';
import { validateWorkout } from '@/lib/workout/validate';
import { useWorkoutsStore } from '@/lib/workoutsStore';

type WizardStep =
  | { screen: 'basicInfo' }
  | { screen: 'structure' }
  | { screen: 'sectionType'; sectionIndex: number }
  | { screen: 'sectionStructure'; sectionIndex: number }
  | { screen: 'sectionExercises'; sectionIndex: number }
  | { screen: 'exerciseDetail'; sectionIndex: number; exerciseId: string | null }
  | { screen: 'preview' }
  | { screen: 'saveContinue' };

export default function WorkoutNewScreen() {
  const { presetTitle, presetSections, date: dateParam } = useLocalSearchParams<{
    presetTitle?: string;
    presetSections?: string;
    date?: string;
  }>();
  const createWorkout = useWorkoutsStore((s) => s.createWorkout);
  const startSession = useWorkoutsStore((s) => s.startSession);
  const setTemplate = useWorkoutsStore((s) => s.setTemplate);

  const [stepStack, setStepStack] = useState<WizardStep[]>([{ screen: 'basicInfo' }]);
  const step = stepStack[stepStack.length - 1];

  const [title, setTitle] = useState(() => presetTitle ?? '');
  const [category, setCategory] = useState<WorkoutCategory>('crossfit');
  const [date, setDate] = useState(() => (dateParam && Number.isFinite(Number(dateParam)) ? new Date(Number(dateParam)) : new Date()));
  const [startTime, setStartTime] = useState(() => new Date());
  const [notes, setNotes] = useState('');
  const [sections, setSections] = useState<WorkoutSection[]>(() =>
    presetSections ? (JSON.parse(presetSections) as WorkoutSection[]) : [{ key: 'wod', exercises: [] }]
  );
  const [saved, setSaved] = useState<{ workoutId: string; scheduledId: string } | null>(null);
  const isTemplate = useWorkoutsStore((s) => (saved ? (s.workouts[saved.workoutId]?.isTemplate ?? false) : false));

  // Built once per edit, not per render: the conversion mints the ids that get stored.
  const content = useMemo(() => wizardToContent({ title, category, notes, sections }), [title, category, notes, sections]);
  const validation = useMemo(() => validateWorkout(content), [content]);

  const pushStep = (s: WizardStep) => setStepStack((prev) => [...prev, s]);
  const handleBack = () => {
    if (stepStack.length <= 1) {
      router.back();
    } else {
      setStepStack((prev) => prev.slice(0, -1));
    }
  };

  const updateSection = (index: number, patch: Partial<WorkoutSection>) =>
    setSections((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  const updateSectionExercises = (index: number, exercises: Exercise[]) => updateSection(index, { exercises });

  const handleSaveWorkout = () => {
    if (!validation.valid) return;
    const ids = createWorkout(content, {
      source: presetSections ? 'preset' : 'manual',
      scheduledAt: combineDateAndTime(date, startTime),
    });
    if (!ids.scheduledId) return;
    setSaved({ workoutId: ids.workoutId, scheduledId: ids.scheduledId });
    pushStep({ screen: 'saveContinue' });
  };

  const openSession = (mode: 'player' | 'manual') => {
    if (!saved) return;
    const res = startSession(saved.scheduledId, mode);
    if ('error' in res) return;
    router.replace({ pathname: mode === 'player' ? '/workout-player' : '/workout-log', params: { sessionId: res.sessionId } });
  };

  switch (step.screen) {
    case 'basicInfo':
      return (
        <StepBasicInfo
          title={title}
          onTitleChange={setTitle}
          date={date}
          onDateChange={setDate}
          startTime={startTime}
          onStartTimeChange={setStartTime}
          category={category}
          onCategoryChange={setCategory}
          notes={notes}
          onNotesChange={setNotes}
          onBack={handleBack}
          onContinue={() => pushStep({ screen: 'structure' })}
        />
      );

    case 'structure':
      return (
        <StepWorkoutStructure
          sections={sections}
          onSectionsChange={setSections}
          onBack={handleBack}
          onContinue={() => pushStep({ screen: 'sectionType', sectionIndex: 0 })}
        />
      );

    case 'sectionType': {
      const idx = step.sectionIndex;
      return (
        <StepSectionType
          section={sections[idx]}
          sectionIndex={idx}
          totalSections={sections.length}
          onWorkoutTypeChange={(t: SectionWorkoutType) => updateSection(idx, { workoutType: t })}
          onStructureChange={(structure: WorkoutStructure) => updateSection(idx, { structure })}
          onBack={handleBack}
          onContinue={() => {
            // Persist the pre-selected defaults so what was on screen is what gets saved.
            const workoutType = sections[idx].workoutType ?? defaultWorkoutTypeForSection(sections[idx].key);
            updateSection(idx, { workoutType, structure: sections[idx].structure ?? defaultStructureForType(workoutType) });
            pushStep({ screen: 'sectionStructure', sectionIndex: idx });
          }}
        />
      );
    }

    case 'sectionStructure': {
      const idx = step.sectionIndex;
      return (
        <StepSectionStructure
          section={sections[idx]}
          sectionIndex={idx}
          totalSections={sections.length}
          onStructureChange={(structure) => updateSection(idx, { structure })}
          onBack={handleBack}
          onContinue={() => pushStep({ screen: 'sectionExercises', sectionIndex: idx })}
        />
      );
    }

    case 'sectionExercises': {
      const idx = step.sectionIndex;
      const section = sections[idx];
      return (
        <StepSectionExercises
          section={section}
          sectionIndex={idx}
          totalSections={sections.length}
          onExercisesChange={(exercises) => updateSectionExercises(idx, exercises)}
          onEditExercise={(exerciseId) => pushStep({ screen: 'exerciseDetail', sectionIndex: idx, exerciseId })}
          onAddExercise={() => pushStep({ screen: 'exerciseDetail', sectionIndex: idx, exerciseId: null })}
          onQuickAdd={(entry: ExerciseLibraryEntry) =>
            updateSectionExercises(idx, [...section.exercises, buildExerciseFromLibraryEntry(entry, generateId('ex'))])
          }
          onBack={handleBack}
          onContinue={() =>
            idx + 1 < sections.length
              ? pushStep({ screen: 'sectionType', sectionIndex: idx + 1 })
              : pushStep({ screen: 'preview' })
          }
        />
      );
    }

    case 'exerciseDetail': {
      const { sectionIndex, exerciseId } = step;
      const section = sections[sectionIndex];
      const existing = exerciseId ? section.exercises.find((e) => e.id === exerciseId) : undefined;
      const initial: Exercise = existing ?? { id: generateId('ex'), name: '', primary: { target: 'reps', reps: 10 } };
      return (
        <StepExerciseDetail
          initial={initial}
          isEditing={Boolean(existing)}
          onBack={handleBack}
          onSave={(exercise) => {
            const next = existing
              ? section.exercises.map((e) => (e.id === exercise.id ? exercise : e))
              : [...section.exercises, exercise];
            updateSectionExercises(sectionIndex, next);
            handleBack();
          }}
        />
      );
    }

    case 'preview':
      return (
        <StepWorkoutPreview
          content={content}
          validation={validation}
          dateTimeMs={combineDateAndTime(date, startTime)}
          onBack={handleBack}
          onSave={handleSaveWorkout}
        />
      );

    case 'saveContinue':
      return (
        <StepSaveContinue
          isTemplate={isTemplate}
          onStart={() => openSession('player')}
          onLogResults={() => openSession('manual')}
          onToggleTemplate={() => saved && setTemplate(saved.workoutId, !isTemplate)}
          onShare={() => {
            Share.share({ message: formatWorkoutShareText(content) }).catch(() => {});
          }}
          onDone={() => router.back()}
        />
      );

    default:
      return null;
  }
}
