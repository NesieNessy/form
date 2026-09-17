/**
 * Every static UI string in the app — labels, button text, field names,
 * placeholders, headers — in one place for a quick overview and fast
 * translation. Each value appears once: if the same text is used in
 * multiple screens/components, they all reference the same key here
 * instead of repeating the literal.
 *
 * Not included: content that comes from data (lib/mockData.ts) — sample
 * workout names, insight bodies, chart values, etc. That's demo content
 * standing in for a real backend, not app chrome, so it isn't part of
 * this translatable-strings resource.
 */
export const strings = {
  // Common actions
  continue: 'Continue',
  newWorkout: 'New Workout',
  startWorkout: 'Start Workout',
  saveWorkout: 'Save Workout',
  shareProgress: 'Share Progress',
  addExercise: 'Add Exercise',
  done: 'Done',
  save: 'Save',
  back: 'Back',

  // Common field labels
  current: 'Current',
  target: 'Target',
  start: 'Start',
  notes: 'Notes',
  exercises: 'Exercises',
  title: 'Title',
  date: 'Date',
  workouts: 'Workouts',
  optional: 'Optional',
  required: 'Required',

  // Tab bar (app/(tabs)/_layout.tsx)
  home: 'Home',
  trends: 'Trends',
  more: 'More',

  // Home screen
  weeklyGoal: 'Weekly Goal',
  yourProgress: 'Your Progress',

  // Trends screen
  yourTrends: 'Your Trends',
  overview: 'Overview',
  bodyData: 'Body Data',
  strength: 'Strength',
  endurance: 'Endurance',
  weight: 'Weight',
  bodyFat: 'Body Fat',
  muscleMass: 'Muscle Mass',
  bmi: 'BMI',
  distance400m: '400 m',
  distance1km: '1 km',
  distance5km: '5 km',
  all: 'All',
  howIsThisMeasured: 'How is this measured?',
  tip: 'Tip',
  tipBody: (metricLabel: string) => `Your ${metricLabel} is trending steadily downward. Great progress!`,
  yourStrengthProgress: 'Your Strength Progress',
  overallProgress: 'Overall Progress',
  endurancePerformance: 'Endurance Performance',
  moreEnduranceStats: 'More Endurance Stats',
  avgHeartRate: 'Avg Heart Rate',
  vo2max: 'VO2max',
  avgPace: 'Avg. Pace',
  totalDistance: 'Total Distance',
  sessions: 'Sessions',

  // Insights screen
  yourInsights: 'Your Insights',

  // Body Development screen
  bodyComposition: 'Body Composition',
  before: 'Before',
  now: 'Now',

  // Long-Term Progress screen
  weightKgLabel: 'Weight (kg)',
  bodyFatPctLabel: 'Body Fat (%)',
  strengthIndexLabel: 'Strength (Index)',

  // Goals & Forecasts screen
  yourGoals: 'Your Goals',
  forecast: 'Forecast',

  // Workouts (tab) screen
  noWorkoutsPlannedYet: 'No workouts planned yet',
  workoutsEmptyBody: 'Your training plans will show up here once you create them.',
  workoutsListSubtitle: 'Your training plans, all in one place.',

  // Workout detail screen
  workoutFallbackTitle: 'Workout',
  workoutNotFound: "This workout couldn't be found.",
  untitledWorkout: 'Untitled Workout',
  exerciseNumbered: (n: number) => `Exercise ${n}`,
  exercise: 'exercise',
  exercisePlural: 'exercises',

  // FormScoreCard component
  yourForm: 'YOUR FORM',

  // Detail screen title/subtitle pairs — also used as the matching menu
  // item's title/subtitle on the More screen.
  bodyDevelopmentTitle: 'Body Development',
  bodyDevelopmentSubtitle: 'See how your body is changing.',
  performanceOverviewTitle: 'Performance Overview',
  performanceOverviewSubtitle: 'All your key metrics.',
  comparisonTitle: 'Comparison',
  comparisonSubtitle: 'Compare yourself to your past self.',
  goalsForecastsTitle: 'Goals & Forecasts',
  goalsForecastsSubtitle: "See where you're headed.",
  insightsTipsTitle: 'Insights & Tips',
  insightsTipsSubtitle: 'Personalized recommendations.',
  longTermProgressTitle: 'Long-Term Progress',
  longTermProgressSubtitle: 'Your journey, in one chart.',

  // More screen
  moreSubtitle: 'Deeper insights into your progress.',

  // Workout wizard — step 1: basic information
  basicInfoTitle: 'New Workout',
  basicInfoSubtitle: 'Log your training. Keep it simple or add all the details.',
  titleOptional: 'Workout Title (optional)',
  titlePlaceholder: 'e.g. CrossFit Class, Open Workout 24.1',
  startTime: 'Start Time',
  category: 'Type',
  categoryCrossfit: 'CrossFit',
  categoryStrength: 'Strength',
  categoryEndurance: 'Endurance',
  categoryOther: 'Other',
  notesOptional: 'Notes (optional)',
  notesPlaceholder: 'e.g. Location, Coach, How did it feel?',

  // Workout wizard — step 2: workout structure
  workoutStructureTitle: 'Workout Structure',
  workoutStructureSubtitle: 'Add the parts of your workout. You can add, remove or reorder sections.',
  addSection: 'Add Section',
  warmup: 'Warm-Up',
  skill: 'Skill',
  accessory: 'Accessory',
  coolDown: 'Cool Down',
  workoutOfTheDay: 'Workout of the Day',

  // Workout wizard — steps 3-4: configure section (type, then rounds/scheme)
  configureSectionTitle: 'Configure Section',
  configureSectionSubtitle: 'Set the type and structure for your section.',
  sectionProgress: (current: number, total: number, label: string) => `Section ${current} of ${total} · ${label}`,
  workoutType: 'Workout Type',
  workoutTypeEmom: 'EMOM',
  workoutTypeAmrap: 'AMRAP',
  workoutTypeForTime: 'For Time',
  workoutTypeTabata: 'Tabata',
  workoutTypePartnerWod: 'Partner WOD',
  workoutTypeCustom: 'Custom / Mix',
  roundsStructure: 'Rounds / Structure',
  structureFixedRounds: 'Fixed Rounds',
  structureRepScheme: 'Rep Scheme (e.g. 21-15-9)',
  structureTimeBased: 'Time Based (e.g. 10 min)',
  structureCustom: 'Custom',
  roundsSchemeTitle: 'Rounds / Scheme',
  roundsSchemeSubtitle: 'Set how the workout is structured.',
  fixedRoundsLabel: 'Fixed number of rounds',
  repSchemeLabel: 'Rep scheme (e.g. 21-15-9)',
  repSchemeHint: 'Enter numbers separated by dashes',
  repSchemePlaceholder: '21-15-9',
  timeBasedLabel: 'Time based',
  totalTime: 'Total time',
  customStructureLabel: 'Custom / Mix',
  customStructurePlaceholder: 'e.g. 3 rounds for time, then 3 min rest, then AMRAP 7',
  min: 'min',
  sec: 'sec',

  // Workout wizard — step 5: add exercises
  addExercisesTitle: 'Add Exercises',
  addExercisesSubtitle: 'Add the exercises for this section.',
  exerciseLibrary: 'Exercise Library',
  searchExercisesPlaceholder: 'Search exercises...',

  // Workout wizard — step 6: exercise details
  exerciseDetailsTitle: 'Exercise Details',
  exerciseDetailsSubtitle: 'Set the target and units for this exercise.',
  exerciseName: 'Exercise Name',
  exerciseNamePlaceholder: 'Exercise name',
  targetReps: 'Reps',
  targetWeight: 'Weight',
  targetTime: 'Time',
  targetDistance: 'Distance',
  targetCalories: 'Calories',
  targetRounds: 'Rounds',
  targetCustom: 'Custom',
  repetitions: 'Repetitions',
  weightOptional: 'Weight (optional)',
  eachArm: 'Each arm',
  total: 'Total',
  saveExercise: 'Save Exercise',

  // Workout wizard — step 7: preview & save
  workoutPreviewTitle: 'Workout Preview',
  workoutPreviewSubtitle: 'Check your workout before saving.',

  // Workout wizard — step 8: save & continue
  workoutSavedTitle: 'Workout Saved!',
  workoutSavedSubtitle: 'Great work. Keep showing up.',
  duration: 'Duration',
  durationOptional: 'Duration (optional)',
  totalVolume: 'Total Volume',
  totalVolumeOptional: 'Total Volume (optional)',
  addResults: 'Add Results',
  saveAsTemplate: 'Save as Template',
  share: 'Share',
  comingSoon: 'Coming soon',
} as const;
