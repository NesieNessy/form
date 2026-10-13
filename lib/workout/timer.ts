import type { BlockConfig, TimerState } from './model';

/**
 * Timer math for the workout player. Everything is derived from wall-clock
 * timestamps rather than counted ticks, so the clock stays correct when the
 * app is backgrounded, the screen sleeps, or the connection drops.
 */

export const IDLE_TIMER: TimerState = { startedAtMs: null, accumulatedMs: 0 };

export function isRunning(timer: TimerState): boolean {
  return timer.startedAtMs !== null;
}

export function elapsedMs(timer: TimerState, nowMs: number): number {
  const running = timer.startedAtMs === null ? 0 : Math.max(0, nowMs - timer.startedAtMs);
  return timer.accumulatedMs + running;
}

export function startTimer(timer: TimerState, nowMs: number): TimerState {
  return timer.startedAtMs !== null ? timer : { startedAtMs: nowMs, accumulatedMs: timer.accumulatedMs };
}

export function pauseTimer(timer: TimerState, nowMs: number): TimerState {
  return timer.startedAtMs === null ? timer : { startedAtMs: null, accumulatedMs: elapsedMs(timer, nowMs) };
}

export type Clock = {
  /** `up` shows elapsed time, `down` shows time left, `interval` shows time left in the current phase. */
  mode: 'up' | 'down' | 'interval';
  displaySeconds: number;
  /** True once the format's own end is reached (cap hit, countdown at zero, last interval over). */
  finished: boolean;
  /** Elapsed time clamped to the format's total, i.e. what counts as the block's duration. */
  countedSeconds: number;
  totalSeconds?: number;
  round?: number;
  totalRounds?: number;
  phase?: 'work' | 'rest';
  /** For alternating intervals: which step is up this interval. */
  activeStepIndex?: number;
};

export function describeClock(config: BlockConfig, elapsedSeconds: number, stepCount = 0): Clock {
  const elapsed = Math.max(0, elapsedSeconds);

  const countUp = (cap?: number): Clock => {
    const finished = cap !== undefined && elapsed >= cap;
    const counted = cap !== undefined ? Math.min(elapsed, cap) : elapsed;
    return { mode: 'up', displaySeconds: counted, finished, countedSeconds: counted, totalSeconds: cap };
  };

  const countDown = (total: number): Clock => {
    const counted = Math.min(elapsed, total);
    return { mode: 'down', displaySeconds: total - counted, finished: elapsed >= total, countedSeconds: counted, totalSeconds: total };
  };

  switch (config.format) {
    case 'for_time':
      return countUp(config.timeCapSeconds);

    case 'amrap':
      return config.durationSeconds ? countDown(config.durationSeconds) : countUp();

    case 'continuous':
      return config.durationSeconds ? countDown(config.durationSeconds) : countUp();

    case 'sets_reps':
    case 'sequence':
      return countUp();

    case 'repeating_interval': {
      const interval = config.intervalSeconds;
      const rounds = config.rounds;
      if (!interval || !rounds) return countUp();

      const total = interval * rounds;
      if (elapsed >= total) {
        return {
          mode: 'interval',
          displaySeconds: 0,
          finished: true,
          countedSeconds: total,
          totalSeconds: total,
          round: rounds,
          totalRounds: rounds,
          phase: config.workSeconds !== undefined && config.workSeconds < interval ? 'rest' : 'work',
          activeStepIndex: config.alternating && stepCount > 0 ? (rounds - 1) % stepCount : undefined,
        };
      }

      const index = Math.floor(elapsed / interval);
      const within = elapsed - index * interval;
      const work = config.workSeconds;
      const inRest = work !== undefined && within >= work;
      return {
        mode: 'interval',
        displaySeconds: inRest || work === undefined ? interval - within : work - within,
        finished: false,
        countedSeconds: elapsed,
        totalSeconds: total,
        round: index + 1,
        totalRounds: rounds,
        phase: inRest ? 'rest' : 'work',
        activeStepIndex: config.alternating && stepCount > 0 ? index % stepCount : undefined,
      };
    }
  }
}
