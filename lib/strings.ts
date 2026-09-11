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
  replaceImage: 'Replace Image',
  addExercise: 'Add Exercise',

  // Common field labels
  current: 'Current',
  target: 'Target',
  start: 'Start',
  notes: 'Notes',
  exercises: 'Exercises',
  title: 'Title',
  date: 'Date',
  intervals: 'Intervals',
  workouts: 'Workouts',

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

  // Workout wizard — step 1: choose method
  newWorkoutSubtitle: 'How would you like to create it?',
  uploadScreenshot: 'Upload Screenshot',
  uploadScreenshotSubtitle: 'PNG, JPG or HEIC',
  chooseFromGallery: 'Choose from Gallery',
  chooseFromGallerySubtitle: 'Pick a photo from your library',
  enterManually: 'Enter Manually',
  enterManuallySubtitle: 'Type in the details yourself',

  // Workout wizard — step 2: screenshot preview
  screenshotCaption: "We'll scan this screenshot for exercises, sets, and intervals.",

  // Workout wizard — step 3: analyzing
  analyzingTitle: 'Analyzing your workout…',
  analyzingSubtitle: 'This only takes a few seconds.',
  detectingText: 'Detecting text',
  identifyingExercises: 'Identifying exercises',
  detectingIntervals: 'Detecting sets & intervals',
  extractingDetails: 'Extracting additional details',

  // Workout wizard — step 4: edit workout
  editWorkoutTitle: 'Edit Workout',
  titlePlaceholder: 'e.g. Squat Snatch',
  intervalsPlaceholder: 'e.g. 5 Rounds: 2:00 on / 1:00 off',
  exerciseNamePlaceholder: 'Exercise name',
  exerciseDetailPlaceholder: 'Detail (optional)',
  notesPlaceholder: 'Anything else worth remembering about this workout',

  // Workout wizard — step 5: body data
  addBodyDataTitle: 'Add Body Data',
  addBodyDataSubtitle: 'Optional — heart rate, calories, or performance data.',
  sourceAutomatic: 'Automatic',
  sourceScreenshot: 'From Screenshot',
  sourceManual: 'Manual',
  sourceAutomaticCaption: 'Synced from your smartwatch, once connected.',
  sourceScreenshotCaption: 'Detected from your fitness app screenshot.',
  sourceManualCaption: 'Enter your data by hand below.',
  calories: 'Calories',
  duration: 'Duration',
  zones: 'Zones',
  avgHeartRatePlaceholder: 'e.g. 156 bpm',
  caloriesPlaceholder: 'e.g. 324 kcal',
  durationPlaceholder: 'e.g. 28:14',
  zonesPlaceholder: 'e.g. 68%',
  addMoreData: 'Add More Data',
  distance: 'Distance',
  pace: 'Pace',
  power: 'Power (Watts)',
  avgSpeed: 'Avg Speed',
  maxHeartRate: 'Max Heart Rate',
  device: 'Device',
  distancePlaceholder: 'e.g. 5 km',
  pacePlaceholder: 'e.g. 4:56 min/km',
  powerPlaceholder: 'e.g. 210 W',
  avgSpeedPlaceholder: 'e.g. 12.4 km/h',
  maxHeartRatePlaceholder: 'e.g. 178 bpm',
  devicePlaceholder: 'e.g. Apple Watch',

  // Workout wizard — step 6: preview & save
  workoutPreviewTitle: 'Workout Preview',
  workoutPreviewSubtitle: 'Review everything before saving.',
} as const;
