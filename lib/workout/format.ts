import { strings } from '../strings';
import type { Block, BlockConfig, BlockType, Prescription, Score, Step } from './model';

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    const km = meters / 1000;
    return `${Number.isInteger(km) ? km : km.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')} km`;
  }
  return `${Math.round(meters)} m`;
}

export function formatKg(kg: number): string {
  return `${Number.isInteger(kg) ? kg : kg.toFixed(1)} kg`;
}

const INTENSITY_LABEL: Record<NonNullable<Prescription['intensity']>['type'], (v: number) => string> = {
  rpe: (v) => `RPE ${v}`,
  hr_zone: (v) => `Zone ${v}`,
  pace_sec_per_km: (v) => `${formatClock(v)} /km`,
  ftp_percent: (v) => `${v}% FTP`,
  power_w: (v) => `${v} W`,
};

export function formatPrescription(rx: Prescription): string {
  const parts: string[] = [];
  if (rx.reps === 'max') parts.push(strings.maxReps);
  else if (rx.reps !== undefined) parts.push(`${rx.reps} reps`);
  if (rx.distanceMeters !== undefined) parts.push(formatDistance(rx.distanceMeters));
  if (rx.durationSeconds !== undefined) parts.push(formatClock(rx.durationSeconds));
  if (rx.calories !== undefined) parts.push(`${rx.calories} cal`);
  if (rx.breaths !== undefined) parts.push(`${rx.breaths} breaths`);
  if (rx.load) {
    parts.push(
      rx.load.unit === 'percent_1rm'
        ? `${rx.load.value}% 1RM`
        : `${formatKg(rx.load.value)}${rx.load.per === 'each' ? ' each' : ''}`
    );
  }
  if (rx.intensity) parts.push(INTENSITY_LABEL[rx.intensity.type](rx.intensity.value));
  if (rx.side && rx.side !== 'both') parts.push(rx.side);
  if (rx.restSeconds) parts.push(`rest ${formatClock(rx.restSeconds)}`);
  if (rx.note) parts.push(rx.note);
  return parts.join(' · ');
}

export function formatStep(step: Step): { title: string; detail: string } {
  switch (step.kind) {
    case 'exercise':
      return { title: step.name, detail: formatPrescription(step.prescription) };
    case 'rest':
      return { title: strings.rest, detail: step.durationSeconds ? formatClock(step.durationSeconds) : '' };
    case 'transition':
      return { title: step.name || strings.transition, detail: step.durationSeconds ? formatClock(step.durationSeconds) : '' };
    case 'group':
      return { title: step.label || strings.group, detail: step.rounds ? `${step.rounds} ${strings.roundsLower}` : '' };
  }
}

const BLOCK_TYPE_LABEL: Record<BlockType, string> = {
  warmup: strings.warmup,
  strength: strings.strength,
  skill: strings.skill,
  accessory: strings.accessory,
  conditioning: strings.conditioning,
  endurance: strings.endurance,
  interval: strings.intervals,
  mobility: strings.mobility,
  recovery: strings.recovery,
  transition: strings.transition,
  cooldown: strings.coolDown,
};

export function blockLabel(block: Block): string {
  return block.label || BLOCK_TYPE_LABEL[block.type] || block.type;
}

export function formatLabel(config: BlockConfig): string {
  switch (config.format) {
    case 'for_time':
      return strings.workoutTypeForTime;
    case 'amrap':
      return strings.workoutTypeAmrap;
    case 'repeating_interval': {
      if (config.workSeconds !== undefined) return strings.intervals;
      const iv = config.intervalSeconds;
      if (iv && iv % 60 === 0) return iv === 60 ? strings.workoutTypeEmom : `E${iv / 60}MOM`;
      return strings.intervals;
    }
    case 'sets_reps':
      return strings.setsAndReps;
    case 'continuous':
      return strings.continuous;
    case 'sequence':
      return strings.sequence;
  }
}

function formatConfigDetail(config: BlockConfig): string | undefined {
  switch (config.format) {
    case 'for_time': {
      const parts: string[] = [];
      if (config.repScheme?.length) parts.push(config.repScheme.join('-'));
      else if (config.rounds && config.rounds > 1) parts.push(`${config.rounds} Rounds`);
      if (config.timeCapSeconds) parts.push(`${strings.cap} ${formatClock(config.timeCapSeconds)}`);
      return parts.join(' · ') || undefined;
    }
    case 'amrap':
      return config.durationSeconds ? formatClock(config.durationSeconds) : undefined;
    case 'repeating_interval': {
      const { intervalSeconds: iv, rounds, workSeconds: work } = config;
      if (!iv) return rounds ? `${rounds} ${strings.roundsLower}` : undefined;
      if (work !== undefined) {
        const core = `${formatClock(work)} / ${formatClock(iv - work)}`;
        return rounds ? `${rounds} × ${core}` : core;
      }
      const parts: string[] = [];
      if (rounds) parts.push(formatClock(iv * rounds));
      if (config.alternating) parts.push(strings.alternating);
      return parts.join(' · ') || undefined;
    }
    case 'sets_reps': {
      const parts: string[] = [];
      if (config.sets) parts.push(`${config.sets} ${config.sets === 1 ? strings.setLower : strings.setsLower}`);
      if (config.restSeconds) parts.push(`rest ${formatClock(config.restSeconds)}`);
      return parts.join(' · ') || undefined;
    }
    case 'continuous': {
      const parts: string[] = [];
      if (config.distanceMeters) parts.push(formatDistance(config.distanceMeters));
      if (config.durationSeconds) parts.push(formatClock(config.durationSeconds));
      return parts.join(' · ') || undefined;
    }
    case 'sequence':
      return config.rounds && config.rounds > 1 ? `${config.rounds} Rounds` : undefined;
  }
}

export function formatBlockHeadline(block: Block): string {
  return [formatLabel(block.config), formatConfigDetail(block.config)].filter(Boolean).join(' · ');
}

export function formatScore(score: Score | undefined): string {
  if (!score) return '—';
  switch (score.type) {
    case 'time':
      return formatClock(score.seconds);
    case 'rounds_reps':
      return score.reps > 0 ? `${score.rounds} + ${score.reps}` : `${score.rounds} ${strings.roundsLower}`;
    case 'load':
      return formatKg(score.kg);
    case 'reps':
      return `${score.reps} reps`;
    case 'distance':
      return formatDistance(score.meters);
    case 'completed':
      return strings.completed;
  }
}
