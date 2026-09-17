import { router } from 'expo-router';
import React, { useState } from 'react';
import { StepBasicInfo } from '@/components/workout/StepBasicInfo';
import { StepExerciseDetail } from '@/components/workout/StepExerciseDetail';
import { StepSaveContinue } from '@/components/workout/StepSaveContinue';
import { StepSectionExercises } from '@/components/workout/StepSectionExercises';
import { StepSectionStructure } from '@/components/workout/StepSectionStructure';
import { StepSectionType } from '@/components/workout/StepSectionType';
import { StepWorkoutPreview } from '@/components/workout/StepWorkoutPreview';
import { StepWorkoutStructure } from '@/components/workout/StepWorkoutStructure';
import { combineDateAndTime, formatDateLabel } from '@/lib/date';
import { buildExerciseFromLibraryEntry, type ExerciseLibraryEntry } from '@/lib/exerciseLibrary';
import { generateId } from '@/lib/id';
import { strings } from '@/lib/strings';
import type {
  Exercise,
  SectionWorkoutType,
  Workout,
  WorkoutCategory,
  WorkoutSection,
  WorkoutStructure,
} from '@/lib/types';
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
  const addWorkout = useWorkoutsStore((s) => s.addWorkout);
  const updateWorkout = useWorkoutsStore((s) => s.updateWorkout);

  const [stepStack, setStepStack] = useState<WizardStep[]>([{ screen: 'basicInfo' }]);
  const step = stepStack[stepStack.length - 1];

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<WorkoutCategory>('crossfit');
  const [date, setDate] = useState(() => new Date());
  const [startTime, setStartTime] = useState(() => new Date());
  const [notes, setNotes] = useState('');
  const [sections, setSections] = useState<WorkoutSection[]>([{ key: 'wod', exercises: [] }]);
  const [durationLabel, setDurationLabel] = useState('');
  const [totalVolumeLabel, setTotalVolumeLabel] = useState('');
  const [savedWorkoutId, setSavedWorkoutId] = useState<string | null>(null);

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
    const id = generateId('workout');
    const now = Date.now();
    const workout: Workout = {
      id,
      title: title.trim() || strings.untitledWorkout,
      category,
      dateTimeMs: combineDateAndTime(date, startTime),
      dateLabel: formatDateLabel(date),
      notes: notes.trim() || undefined,
      sections: sections.map((s) => ({
        ...s,
        exercises: s.exercises.filter((ex) => ex.name.trim().length > 0),
      })),
      createdAt: now,
      updatedAt: now,
    };
    addWorkout(workout);
    setSavedWorkoutId(id);
    pushStep({ screen: 'saveContinue' });
  };

  const handleDurationChange = (v: string) => {
    setDurationLabel(v);
    if (savedWorkoutId) updateWorkout(savedWorkoutId, { durationLabel: v || undefined });
  };
  const handleTotalVolumeChange = (v: string) => {
    setTotalVolumeLabel(v);
    if (savedWorkoutId) updateWorkout(savedWorkoutId, { totalVolumeLabel: v || undefined });
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
          onContinue={() => pushStep({ screen: 'sectionStructure', sectionIndex: idx })}
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
          title={title}
          dateTimeMs={combineDateAndTime(date, startTime)}
          sections={sections}
          notes={notes}
          onBack={handleBack}
          onSave={handleSaveWorkout}
        />
      );

    case 'saveContinue':
      return (
        <StepSaveContinue
          durationLabel={durationLabel}
          onDurationChange={handleDurationChange}
          totalVolumeLabel={totalVolumeLabel}
          onTotalVolumeChange={handleTotalVolumeChange}
          onDone={() => router.back()}
        />
      );

    default:
      return null;
  }
}
