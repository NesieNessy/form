/**
 * Recovery and readiness (docs/concepts/04-stage-2-recovery-and-readiness.md).
 *
 * A daily view of recovery context built from the athlete's own baselines,
 * their check-in and their recent training. It is never a diagnosis, never a
 * percentage, and it says so when there is too little or conflicting data.
 */

export type SignalKey = 'resting_hr' | 'hrv' | 'sleep' | 'fatigue' | 'soreness' | 'stress' | 'energy' | 'load';

export type Signal = {
  key: SignalKey;
  /** Relative to the athlete's own normal or, for the check-in, to the middle of the scale. */
  direction: 'worse' | 'usual' | 'better';
  strength: 'mild' | 'strong';
  source: 'measurement' | 'check_in' | 'training_log';
  /** For the athlete only, e.g. "58 bpm, your normal 51". Never shared. */
  detail: string;
};

export type RecoveryStatus =
  /** The athlete reported feeling ill or injured. */
  | 'unwell'
  /** Too little data to say anything. */
  | 'limited_data'
  /** Measurements and how the athlete feels point in different directions. */
  | 'conflicting'
  /** Several signals, or one strong one, suggest taking it easier. */
  | 'attention'
  | 'steady';

export type OptionKind = 'keep' | 'shorten' | 'lighter' | 'reschedule' | 'rest';

export type Insight = {
  version: string;
  localDate: string;
  status: RecoveryStatus;
  signals: Signal[];
  /** What could not be used, in plain words ("no resting heart rate today"). */
  missing: string[];
  /** Options for today's planned workout, at most three; empty when nothing should be suggested. */
  options: OptionKind[];
  /** The planned workout the options refer to. */
  scheduledId?: string;
};

/** What is kept per day and may be shared with a coach: no values, only what the athlete chose. */
export type RecoveryDay = {
  id: string;
  localDate: string;
  status: RecoveryStatus;
  signals: { key: SignalKey; direction: Signal['direction'] }[];
  ruleVersion: string;
  decision?: { option: OptionKind; scheduledId?: string; decidedAt: number };
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

export type CheckIn = { fatigue?: number; soreness?: number; stress?: number; energy?: number; unwell?: boolean };
