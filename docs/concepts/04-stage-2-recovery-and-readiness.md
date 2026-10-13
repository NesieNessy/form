# Stage 2 — Recovery & Readiness Agent

## Objective

Offer an explainable, non-diagnostic daily view of recovery context and optional workout adjustments. Prioritize the athlete's own baseline and subjective feedback over proprietary one-size-fits-all thresholds.

## User experiences

**Athlete:** sleep, resting HR, HRV and recent training trends; short check-in for perceived fatigue, soreness, stress and energy; review suggested session adjustment.  
**Coach:** may view shared *recovery summary* rather than raw health readings; athlete may approve a training modification.  
**Physiotherapist:** optionally views shared rehab-relevant context, but this must not supersede professional restrictions.  
**Studio:** no individual readiness access by default; studio classes run regardless of private scores.

## Data inputs and caveats

| Input | Use | Limitations |
|---|---|---|
| Overnight HRV | Personal trend context | Device-specific calculation; values not interchangeable without normalization and provenance |
| Resting HR | Deviation from athlete baseline | Illness, environment and measurement conditions can confound |
| Sleep duration/timing | Recovery habit context | Wearable sleep stages can be inaccurate |
| Recent training load | Session frequency, duration and intensity trends | Incomplete when activities aren't logged or synced |
| Athlete check-in | Perceived fatigue, soreness and stress | Subjective but valuable; not a diagnosis |
| Rehab restriction | Exclusion/guardrail | Only authorized, professionally established restrictions |

## Core processing workflow

1. Ingest approved data types and track freshness and missingness.
2. Normalize units and identity of measurement method; merge duplicate records without overwriting provenance.
3. Compute rolling individual baselines only after a documented minimum-data policy is met.
4. Detect deviations; distinguish signal from missing data and measurement inconsistencies.
5. Combine objective metrics with athlete check-ins; generate a constrained insight with supporting factors.
6. Compare with planned workouts, intensity targets and therapist restrictions.
7. Generate at most a few low-risk options (keep, shorten, reduce intensity, reschedule, rest) with uncertainty.
8. Require user approval; notify coach only within granted sharing scope.

## Suggested schema

```json
{
  "insight_id": "rec_51",
  "athlete_id": "ath_42",
  "day": "2026-10-13",
  "status": "limited_data",
  "signals": [
    {"metric": "sleep_duration", "direction": "below_personal_baseline", "source": "wearable", "quality": "moderate"},
    {"metric": "perceived_fatigue", "value": 7, "scale": "0_to_10", "source": "athlete_checkin"}
  ],
  "proposal": {"action": "review_workout_intensity", "workout_id": "workout_21"},
  "confidence": "limited",
  "approval_required": true
}
```

Avoid presenting a readiness percentage as medical truth. If a numeric composite is ever added, document calibration, individual validity, uncertainty and threshold behavior.

## Agent tools

Read: `getRecentMeasurements`, `getPersonalBaseline`, `getRecentSessions`, `getScheduledWorkout`, `getDailyCheckin`, `getRelevantRestrictions`.  
Write to draft only: `createRecoveryInsight`, `proposeWorkoutAdjustment`.  
Explicit approval: `approveWorkoutAdjustment` executed by application user action, not hidden agent automation.

## Safety rules

- No illness or injury diagnosis.
- No return-to-sport clearance.
- Missing or conflicting wearable data => display uncertainty or abstain.
- No pressure to work out when an athlete reports severe symptoms.
- Therapist-established restrictions take precedence over general workout suggestions.
- Professional sharing is opt-in and scoped; organizations get aggregated trends only with privacy safeguards.

## Evaluation

Create retrospective test sets across sports and devices; assess data quality handling, suggestion relevance, rate of excessive warning, misleading certainty and equity across device ownership. Track athlete acceptance and reversals but do not optimize for maximal training volume.

## MVP deliverables

Daily check-in, baseline computation, insight API, suggestion review UI, consent-based coach summary, recovery event audit and a safe fallback (“insufficient data”).

## Acceptance tests

- Mixed Garmin/Apple observations do not silently double-count metrics.
- Agent refuses to infer a health diagnosis from HRV alone.
- Coach without recovery scope cannot read raw measurements or daily check-in.
- Proposed changes are never persisted as confirmed plans until approved.
- With sparse/noisy data, UI displays limited certainty and no forced prescription.
