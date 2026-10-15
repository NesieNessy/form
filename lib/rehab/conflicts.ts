import { tr } from '../i18n/tr';
import { exerciseSteps, type WorkoutContent } from '../workout/model';
import { ACTIVITY_TAGS, RED_FLAGS, type ActivityTag, type InjuryEpisode, type RedFlag, type Restriction, type RestrictionRule, type SymptomLog } from './model';

/**
 * The deterministic restriction engine and the escalation rule. No model is
 * involved: a workout's exercises are mapped to movement tags and compared
 * with the restrictions in force on the workout's date.
 */

export type Limit = {
  /** A clinician's restriction, or the athlete's own note on an episode. */
  source: 'clinician' | 'self';
  rule: RestrictionRule;
  tags: ActivityTag[];
  restrictionId?: string;
  episodeId: string;
};

export type Conflict = {
  blockIndex: number;
  stepId: string;
  stepName: string;
  tags: ActivityTag[];
  limit: Limit;
};

export type CheckResult = {
  conflicts: Conflict[];
  /** Exercises not in the catalog, which cannot be checked. */
  unchecked: { stepId: string; stepName: string }[];
  /** The most serious rule among the conflicts. */
  worst?: RestrictionRule;
};

const SEVERITY: Record<RestrictionRule, number> = { limit: 1, review_required: 2, avoid: 3 };

/** The limits in force on a date: active clinician restrictions in their date range, and open episodes' own notes. */
export function limitsOn(date: string, restrictions: Restriction[], episodes: InjuryEpisode[]): Limit[] {
  const clinician = restrictions
    .filter((r) => r.status === 'active' && r.effectiveFrom <= date && (!r.expiresOn || r.expiresOn >= date))
    .map((r): Limit => ({ source: 'clinician', rule: r.rule, tags: r.tags, restrictionId: r.id, episodeId: r.episodeId }));
  const self = episodes
    .filter((e) => !e.deletedAt && e.status !== 'resolved' && e.affectedActivities.length)
    .map((e): Limit => ({ source: 'self', rule: 'limit', tags: e.affectedActivities, episodeId: e.id }));
  return [...clinician, ...self];
}

export function tagsOf(activityId: string | null, sport?: string): ActivityTag[] | undefined {
  if (!activityId) return undefined;
  const tags = ACTIVITY_TAGS[activityId];
  if (!tags) return undefined;
  // A generic step in a swim or ride workout carries the sport's own movement.
  return sport === 'swimming' && !tags.includes('swimming') ? [...tags, 'swimming'] : tags;
}

export function checkWorkout(content: WorkoutContent, limits: Limit[]): CheckResult {
  const conflicts: Conflict[] = [];
  const unchecked: CheckResult['unchecked'] = [];
  if (!limits.length) return { conflicts, unchecked };
  content.blocks.forEach((block, blockIndex) => {
    for (const step of exerciseSteps(block.steps)) {
      const tags = tagsOf(step.activityId, content.sport);
      if (!tags) {
        unchecked.push({ stepId: step.id, stepName: step.name });
        continue;
      }
      for (const limit of limits) {
        const hit = tags.filter((t) => limit.tags.includes(t));
        if (hit.length) conflicts.push({ blockIndex, stepId: step.id, stepName: step.name, tags: hit, limit });
      }
    }
  });
  const worst = conflicts.reduce<RestrictionRule | undefined>((w, c) => (!w || SEVERITY[c.limit.rule] > SEVERITY[w] ? c.limit.rule : w), undefined);
  return { conflicts, unchecked, ...(worst ? { worst } : {}) };
}

/**
 * The draft alternative: the same workout without the conflicting exercises.
 * Sections left empty are dropped. Returns undefined when nothing would be
 * left; the athlete then needs a different workout, not a smaller one.
 */
export function withoutConflicts(content: WorkoutContent, check: CheckResult): WorkoutContent | undefined {
  const drop = new Set(check.conflicts.map((c) => c.stepId));
  if (!drop.size) return undefined;
  const prune = (steps: WorkoutContent['blocks'][number]['steps']): WorkoutContent['blocks'][number]['steps'] =>
    steps
      .filter((s) => !(s.kind === 'exercise' && drop.has(s.id)))
      .map((s) => (s.kind === 'group' ? { ...s, steps: prune(s.steps) } : s))
      .filter((s) => s.kind !== 'group' || s.steps.length > 0);
  const blocks = content.blocks.map((b) => ({ ...b, steps: prune(b.steps) })).filter((b) => exerciseSteps(b.steps).length > 0);
  return blocks.length ? { ...content, blocks } : undefined;
}

/** The escalation rule: any red flag means "get it checked promptly", and no exercise suggestion is made. */
export function needsPromptCare(log: Pick<SymptomLog, 'redFlags'>): boolean {
  return log.redFlags.length > 0;
}

export const ESCALATION_MESSAGE =
  tr('Please get this checked by a doctor promptly, or by emergency services if it is severe. FORM cannot assess this and will not suggest exercises for it. (Placeholder wording, pending review by a clinician.)', 'Bitte lass das zeitnah ärztlich abklären, bei starken Beschwerden über den Notruf. FORM kann das nicht beurteilen und schlägt dafür keine Übungen vor. (Vorläufige Formulierung, wird noch von einer Fachperson geprüft.)');

export const redFlagLabel = (f: RedFlag) => RED_FLAGS[f];
