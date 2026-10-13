import { useMemo } from 'react';
import { useTrainingLog } from './useWorkouts';
import {
  buildInsights,
  completedSessions,
  enduranceEfforts,
  liftSeries,
  performanceSummary,
  strengthProgressPct,
  weekSummary,
  type RangeKey,
} from './workout/analytics';

/** Everything the home, trends and insight screens derive from the athlete's logged sessions. */
export function useTrainingStats(range: RangeKey = 'all') {
  const { sessions, scheduled } = useTrainingLog();
  return useMemo(() => {
    const now = Date.now();
    const lifts = liftSeries(sessions, range, now);
    return {
      now,
      hasSessions: completedSessions(sessions).length > 0,
      week: weekSummary(sessions, scheduled, now),
      lifts,
      strengthPct: strengthProgressPct(lifts),
      efforts: enduranceEfforts(sessions),
      performance: performanceSummary(sessions, scheduled, range, now),
      insights: buildInsights(sessions, scheduled, now),
    };
  }, [sessions, scheduled, range]);
}
