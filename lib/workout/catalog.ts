import { ACTIVITY_NAMES_DE } from '../i18n/catalogNames';
import { language } from '../strings';
import type { Sport } from './model';

export type DefaultTarget =
  | { kind: 'reps'; reps: number }
  | { kind: 'distance'; meters: number }
  | { kind: 'calories'; calories: number }
  | { kind: 'duration'; seconds: number };

export type Activity = {
  id: string;
  name: string;
  synonyms: string[];
  sports: Sport[];
  /** Everything listed is needed, unless `equipmentAny` is set, in which case any one of them will do. */
  equipment: string[];
  equipmentAny?: boolean;
  defaultTarget: DefaultTarget;
  /** Loaded movements are the ones whose results feed strength trends. */
  loadable: boolean;
};

const reps = (n: number): DefaultTarget => ({ kind: 'reps', reps: n });
const dist = (meters: number): DefaultTarget => ({ kind: 'distance', meters });
const cal = (calories: number): DefaultTarget => ({ kind: 'calories', calories });
const dur = (seconds: number): DefaultTarget => ({ kind: 'duration', seconds });

function a(
  id: string,
  name: string,
  defaultTarget: DefaultTarget,
  sports: Sport[],
  equipment: string[],
  loadable: boolean,
  synonyms: string[] = []
): Activity {
  return { id, name, synonyms, sports, equipment, defaultTarget, loadable };
}

/**
 * The canonical activity catalog. Ids are stable and are what workouts,
 * results and analytics reference; names and synonyms are only for matching
 * and display. supabase/migrations/0002_workout_core.sql seeds the same rows
 * (scripts/gen-activity-seed.ts regenerates that block).
 */
const BASE_ACTIVITIES: Activity[] = [
  // Barbell / loaded strength
  a('back_squat', 'Back Squat', reps(5), ['strength', 'crossfit'], ['barbell', 'rack'], true, ['squat', 'bs']),
  a('front_squat', 'Front Squat', reps(5), ['strength', 'crossfit'], ['barbell', 'rack'], true, ['fs']),
  a('overhead_squat', 'Overhead Squat', reps(5), ['strength', 'crossfit'], ['barbell'], true, ['ohs']),
  a('deadlift', 'Deadlift', reps(5), ['strength', 'crossfit'], ['barbell'], true, ['dl']),
  a('bench_press', 'Bench Press', reps(5), ['strength'], ['barbell', 'bench'], true, ['bench']),
  a('overhead_press', 'Overhead Press', reps(5), ['strength', 'crossfit'], ['barbell'], true, [
    'strict press',
    'shoulder press',
    'ohp',
    'press',
  ]),
  a('push_press', 'Push Press', reps(5), ['strength', 'crossfit'], ['barbell'], true),
  a('push_jerk', 'Push Jerk', reps(3), ['crossfit'], ['barbell'], true, ['jerk']),
  a('clean', 'Clean', reps(3), ['crossfit'], ['barbell'], true, ['squat clean', 'power clean']),
  a('clean_and_jerk', 'Clean & Jerk', reps(3), ['crossfit'], ['barbell'], true, ['c&j', 'clean and jerk']),
  a('snatch', 'Snatch', reps(3), ['crossfit'], ['barbell'], true, ['squat snatch', 'power snatch']),
  a('thruster', 'Thruster', reps(10), ['crossfit'], ['barbell'], true, ['barbell thruster']),
  a('barbell_row', 'Bent-Over Row', reps(8), ['strength'], ['barbell'], true, ['bent over row', 'barbell row']),
  a('hip_thrust', 'Hip Thrust', reps(8), ['strength'], ['barbell', 'bench'], true),

  // Dumbbell / kettlebell
  a('dumbbell_thruster', 'Dumbbell Thruster', reps(10), ['crossfit', 'hiit'], ['dumbbell'], true, ['db thruster']),
  a('dumbbell_snatch', 'Dumbbell Snatch', reps(10), ['crossfit', 'hiit'], ['dumbbell'], true, ['db snatch']),
  a('dumbbell_hang_clean', 'Dumbbell Hang Squat Clean', reps(10), ['crossfit'], ['dumbbell'], true, [
    'db hang squat clean',
    'dumbbell hang clean',
  ]),
  { ...a('goblet_squat', 'Goblet Squat', reps(10), ['strength', 'hiit'], ['dumbbell', 'kettlebell'], true), equipmentAny: true },
  a('kettlebell_swing', 'Kettlebell Swing', reps(15), ['crossfit', 'hiit'], ['kettlebell'], true, ['kb swing', 'kbs']),
  a('wall_ball', 'Wall Ball', reps(15), ['crossfit'], ['medicine ball'], true, ['wall ball shot', 'wb']),
  a('walking_lunge', 'Walking Lunge', reps(20), ['crossfit', 'hiit'], [], false, ['lunge', 'walking lunges']),

  // Gymnastics / bodyweight
  a('pull_up', 'Pull Up', reps(10), ['crossfit', 'strength'], ['pull-up bar'], false, ['pullup', 'pull-up']),
  a('chest_to_bar', 'Chest-to-Bar Pull Up', reps(8), ['crossfit'], ['pull-up bar'], false, ['c2b', 'chest to bar']),
  a('ring_row', 'Ring Row', reps(10), ['crossfit'], ['rings'], false),
  { ...a('muscle_up', 'Muscle Up', reps(3), ['crossfit'], ['rings', 'pull-up bar'], false, ['bar muscle up', 'ring muscle up']), equipmentAny: true },
  a('toes_to_bar', 'Toes-to-Bar', reps(10), ['crossfit'], ['pull-up bar'], false, ['t2b', 'toes to bar']),
  a('push_up', 'Push Up', reps(10), ['crossfit', 'hiit', 'strength'], [], false, ['pushup', 'push-up']),
  a('handstand_push_up', 'Handstand Push Up', reps(5), ['crossfit'], [], false, ['hspu']),
  a('dip', 'Dip', reps(8), ['strength', 'crossfit'], ['dip bars'], false, ['ring dip']),
  a('air_squat', 'Air Squat', reps(15), ['crossfit', 'hiit'], [], false, ['bodyweight squat']),
  a('pistol', 'Pistol Squat', reps(6), ['crossfit'], [], false, ['pistol']),
  a('burpee', 'Burpee', reps(10), ['crossfit', 'hiit'], [], false),
  a('box_jump', 'Box Jump', reps(10), ['crossfit', 'hiit'], ['box'], false),
  a('double_under', 'Double Under', reps(50), ['crossfit', 'hiit'], ['jump rope'], false, ['du']),
  a('single_under', 'Single Under', reps(100), ['crossfit', 'hiit'], ['jump rope'], false),
  a('sit_up', 'Sit Up', reps(15), ['crossfit', 'hiit'], [], false, ['situp', 'sit-up', 'abmat sit up']),
  a('v_up', 'V-Up', reps(15), ['crossfit', 'hiit'], [], false, ['v up']),
  a('tuck_crunch', 'Tuck Crunch', reps(15), ['hiit'], [], false),
  a('mountain_climber', 'Mountain Climber', reps(20), ['hiit'], [], false),
  a('jumping_jack', 'Jumping Jack', reps(30), ['hiit'], [], false),
  a('plank', 'Plank', dur(60), ['hiit', 'yoga', 'strength'], [], false, ['plank hold']),
  a('side_plank', 'Side Plank', dur(30), ['hiit', 'yoga'], [], false, ['side plank lift']),
  a('hollow_hold', 'Hollow Hold', dur(30), ['crossfit'], [], false),
  a('handstand_hold', 'Handstand Hold', dur(30), ['crossfit'], [], false, ['handstand practice']),

  // Monostructural / endurance
  a('run', 'Run', dist(400), ['running', 'crossfit', 'triathlon', 'endurance'], [], false, ['running', 'jog']),
  a('row', 'Row', dist(500), ['crossfit', 'endurance'], ['rower'], false, ['rowing', 'rower']),
  a('ski_erg', 'Ski Erg', dist(400), ['crossfit', 'endurance'], ['ski erg'], false, ['skierg']),
  a('bike', 'Bike', cal(20), ['crossfit', 'endurance'], ['bike erg'], false, ['assault bike', 'echo bike', 'bike erg']),
  a('cycling', 'Cycling', dur(3600), ['cycling', 'triathlon', 'endurance'], ['bike'], false, ['ride', 'cycle']),
  a('swim', 'Swim', dist(400), ['swimming', 'triathlon', 'endurance'], ['pool'], false, ['swimming']),
  a('walk', 'Walk', dur(600), ['endurance', 'other'], [], false, ['walking']),

  // Yoga / mobility / mental
  a('downward_dog', 'Downward Dog', dur(60), ['yoga'], ['mat'], false, ['downward facing dog']),
  a('warrior_1', 'Warrior I', dur(30), ['yoga'], ['mat'], false, ['warrior 1']),
  a('warrior_2', 'Warrior II', dur(30), ['yoga'], ['mat'], false, ['warrior 2']),
  a('childs_pose', "Child's Pose", dur(120), ['yoga'], ['mat'], false, ['childs pose']),
  a('pigeon_pose', 'Pigeon Pose', dur(90), ['yoga'], ['mat'], false, ['pigeon']),
  a('cat_cow', 'Cat-Cow', dur(60), ['yoga'], ['mat'], false, ['cat cow']),
  a('couch_stretch', 'Couch Stretch', dur(120), ['yoga', 'other'], [], false),
  a('pranayama', 'Pranayama', dur(300), ['yoga'], [], false, ['breathwork', 'breathing']),
  a('meditation', 'Meditation', dur(600), ['yoga', 'other'], [], false),
];

/** In German the display name is German and the English one stays a search synonym. */
export const ACTIVITIES: Activity[] =
  language === 'de'
    ? BASE_ACTIVITIES.map((act) => (ACTIVITY_NAMES_DE[act.id] ? { ...act, name: ACTIVITY_NAMES_DE[act.id], synonyms: [act.name, ...act.synonyms] } : act))
    : BASE_ACTIVITIES;

const BY_ID = new Map(ACTIVITIES.map((act) => [act.id, act]));

export function getActivity(id: string | null | undefined): Activity | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function normalizeActivityName(raw: string): string {
  let s = raw.toLowerCase();
  // "Min 1: 20 Push-ups" / "50 Sit-Ups" / "Dumbbell Snatches, 50/35 lbs"
  s = s.replace(/^\s*min(?:ute)?\s*\d+\s*:\s*/, '');
  s = s.replace(/^\s*\d+\s+/, '');
  s = s.split(',')[0];
  s = s.replace(/\([^)]*\)/g, ' ');
  s = s.replace(/&/g, ' and ');
  s = s.replace(/[^a-z0-9]+/g, ' ').trim();
  // Fold simple plurals so "sit ups" and "burpees" match their singular entries.
  s = s
    .split(' ')
    .map((w) => (w.length > 3 && w.endsWith('es') && /(ch|sh|x|ss)es$/.test(w) ? w.slice(0, -2) : w))
    .map((w) => ((w.length > 3 || w === 'ups') && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .join(' ');
  return s;
}

const BY_NAME = new Map<string, Activity>();
for (const act of ACTIVITIES) {
  for (const label of [act.name, ...act.synonyms]) {
    const key = normalizeActivityName(label);
    if (!BY_NAME.has(key)) BY_NAME.set(key, act);
  }
}

/** Exact match on a normalized name or synonym. Unknown names stay unresolved rather than guessed. */
export function resolveActivity(name: string): Activity | undefined {
  const key = normalizeActivityName(name);
  return key ? BY_NAME.get(key) : undefined;
}

/** The equipment an activity still lacks, given what is available. Empty means it can be done. */
export function missingEquipment(activity: Activity, available: string[]): string[] {
  const have = new Set(available.map((e) => e.toLowerCase()));
  const lacking = activity.equipment.filter((e) => !have.has(e.toLowerCase()));
  if (activity.equipmentAny) return lacking.length < activity.equipment.length ? [] : [activity.equipment.join(' or ')];
  return lacking;
}

export function searchActivities(query: string): Activity[] {
  const q = normalizeActivityName(query);
  if (!q) return ACTIVITIES;
  return ACTIVITIES.filter(
    (act) =>
      normalizeActivityName(act.name).includes(q) || act.synonyms.some((syn) => normalizeActivityName(syn).includes(q))
  );
}
