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
import { mockAnalyzedWorkout } from '@/lib/mockData';
import type { Exercise, WorkoutBodyData, WorkoutBodyDataSource } from '@/lib/types';
import { useWorkoutsStore } from '@/lib/workoutsStore';

type StepId = 'method' | 'screenshot' | 'analyzing' | 'edit' | 'bodyData' | 'preview';

const TODAY_LABEL = new Date().toLocaleDateString('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

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
  const [intervalsLabel, setIntervalsLabel] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [notes, setNotes] = useState('');
  const [bodyDataSource, setBodyDataSource] = useState<WorkoutBodyDataSource>('manual');
  const [bodyData, setBodyData] = useState<WorkoutBodyData>({});

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
      dateLabel: TODAY_LABEL,
      intervalsLabel: intervalsLabel.trim() || undefined,
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
          dateLabel={TODAY_LABEL}
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
          dateLabel={TODAY_LABEL}
          intervalsLabel={intervalsLabel}
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
