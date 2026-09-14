import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Platform } from 'react-native';
import { StepAnalyzing } from '@/components/workout/StepAnalyzing';
import { StepBodyData } from '@/components/workout/StepBodyData';
import { StepChooseMethod } from '@/components/workout/StepChooseMethod';
import { StepEditWorkout } from '@/components/workout/StepEditWorkout';
import { StepPreview } from '@/components/workout/StepPreview';
import { StepScreenshot } from '@/components/workout/StepScreenshot';
import { formatDateLabel } from '@/lib/date';
import { mockAnalyzedWorkout } from '@/lib/mockData';
import { strings } from '@/lib/strings';
import type { Exercise, WorkoutBodyData, WorkoutBodyDataSource, WorkoutSetup, WorkoutType } from '@/lib/types';
import { useWorkoutsStore } from '@/lib/workoutsStore';

type StepId = 'method' | 'screenshot' | 'analyzing' | 'edit' | 'bodyData' | 'preview';

async function pickImage(): Promise<string | undefined> {
  try {
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') return undefined;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      return result.assets[0].uri;
    }
  } catch {
    // No picker available (e.g. permission denied, unsupported environment) — stay put.
  }
  return undefined;
}

export default function WorkoutNewScreen() {
  const addWorkout = useWorkoutsStore((s) => s.addWorkout);

  const [stepStack, setStepStack] = useState<StepId[]>(['method']);
  const step = stepStack[stepStack.length - 1];

  const [screenshotUri, setScreenshotUri] = useState<string | undefined>();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState<Date>(() => new Date());
  const [warmup, setWarmup] = useState<Exercise[]>([]);
  const [strength, setStrength] = useState<Exercise[]>([]);
  const [skill, setSkill] = useState<Exercise[]>([]);
  const [workoutType, setWorkoutType] = useState<WorkoutType>('emom');
  const [setup, setSetup] = useState<WorkoutSetup>({});
  const [intervalsLabel, setIntervalsLabel] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [notes, setNotes] = useState('');
  const [bodyDataSource, setBodyDataSource] = useState<WorkoutBodyDataSource>('manual');
  const [bodyData, setBodyData] = useState<WorkoutBodyData>({});

  const updateSetup = (patch: Partial<WorkoutSetup>) => setSetup((prev) => ({ ...prev, ...patch }));

  const buildSummaryLabel = (): string => {
    switch (workoutType) {
      case 'emom': {
        const parts = [setup.interval, setup.rounds && `${setup.rounds} rounds`].filter(Boolean);
        return [strings.workoutTypeEmom, parts.join(' · ')].filter(Boolean).join(' · ');
      }
      case 'amrap':
        return [strings.workoutTypeAmrap, setup.timeCap].filter(Boolean).join(' · ');
      case 'forTime': {
        const parts = [
          setup.rounds && `${setup.rounds} rounds`,
          setup.timeCap && `Cap ${setup.timeCap}`,
        ].filter(Boolean);
        return [strings.workoutTypeForTime, parts.join(' · ')].filter(Boolean).join(' · ');
      }
      case 'tabata': {
        const parts = [
          (setup.work || setup.rest) && `${setup.work ?? '?'} / ${setup.rest ?? '?'}`,
          setup.rounds && `${setup.rounds} rounds`,
        ].filter(Boolean);
        return [strings.workoutTypeTabata, parts.join(' · ')].filter(Boolean).join(' · ');
      }
      case 'mix':
      default:
        return intervalsLabel.trim();
    }
  };

  const pushStep = (next: StepId) => setStepStack((s) => [...s, next]);
  const handleBack = () => {
    if (stepStack.length <= 1) {
      router.back();
    } else {
      setStepStack((s) => s.slice(0, -1));
    }
  };

  const handlePickAndGo = async () => {
    const uri = await pickImage();
    if (uri) {
      setScreenshotUri(uri);
      pushStep('screenshot');
    }
  };

  const handleEnterManually = () => {
    setBodyDataSource('manual');
    pushStep('edit');
  };

  const handleAnalyzed = () => {
    setTitle(mockAnalyzedWorkout.title);
    setWorkoutType('mix');
    setIntervalsLabel(mockAnalyzedWorkout.intervalsLabel);
    setExercises(mockAnalyzedWorkout.exercises);
    setNotes(mockAnalyzedWorkout.notes);
    setBodyDataSource('screenshot');
    pushStep('edit');
  };

  const handleSave = () => {
    addWorkout({
      id: `workout-${Date.now()}`,
      title: title.trim() || 'Untitled Workout',
      dateLabel: formatDateLabel(date),
      warmup: warmup.filter((ex) => ex.name.trim().length > 0),
      strength: strength.filter((ex) => ex.name.trim().length > 0),
      skill: skill.filter((ex) => ex.name.trim().length > 0),
      workoutType,
      workoutSetup: setup,
      intervalsLabel: buildSummaryLabel() || undefined,
      exercises: exercises.filter((ex) => ex.name.trim().length > 0),
      notes: notes.trim() || undefined,
      bodyDataSource,
      bodyData,
      screenshotUri,
      createdAt: Date.now(),
    });
    router.back();
  };

  switch (step) {
    case 'method':
      return (
        <StepChooseMethod
          onBack={handleBack}
          onUploadScreenshot={handlePickAndGo}
          onChooseFromGallery={handlePickAndGo}
          onEnterManually={handleEnterManually}
        />
      );
    case 'screenshot':
      return (
        <StepScreenshot
          uri={screenshotUri ?? ''}
          onBack={handleBack}
          onReplace={handlePickAndGo}
          onContinue={() => pushStep('analyzing')}
        />
      );
    case 'analyzing':
      return <StepAnalyzing onDone={handleAnalyzed} />;
    case 'edit':
      return (
        <StepEditWorkout
          title={title}
          onTitleChange={setTitle}
          date={date}
          onDateChange={setDate}
          warmup={warmup}
          onWarmupChange={setWarmup}
          strength={strength}
          onStrengthChange={setStrength}
          skill={skill}
          onSkillChange={setSkill}
          workoutType={workoutType}
          onWorkoutTypeChange={setWorkoutType}
          setup={setup}
          onSetupChange={updateSetup}
          intervalsLabel={intervalsLabel}
          onIntervalsChange={setIntervalsLabel}
          exercises={exercises}
          onExercisesChange={setExercises}
          notes={notes}
          onNotesChange={setNotes}
          onBack={handleBack}
          onContinue={() => pushStep('bodyData')}
        />
      );
    case 'bodyData':
      return (
        <StepBodyData
          source={bodyDataSource}
          onSourceChange={setBodyDataSource}
          bodyData={bodyData}
          onBodyDataChange={(patch) => setBodyData((prev) => ({ ...prev, ...patch }))}
          onBack={handleBack}
          onContinue={() => pushStep('preview')}
        />
      );
    case 'preview':
      return (
        <StepPreview
          title={title}
          dateLabel={formatDateLabel(date)}
          warmup={warmup}
          strength={strength}
          skill={skill}
          intervalsLabel={buildSummaryLabel()}
          exercises={exercises}
          notes={notes}
          bodyData={bodyData}
          onBack={handleBack}
          onSave={handleSave}
        />
      );
    default:
      return null;
  }
}
