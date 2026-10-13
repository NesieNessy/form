# Stage 4 — Goal & Progress Agent

## Objective

Give athletes and authorized professionals transparent goal tracking, meaningful milestones, and evidence-backed plan reviews across strength, endurance, technique, consistency, nutrition and rehabilitation support.

## Goal types

| Category | Example | Primary evidence |
|---|---|---|
| Strength | 100 kg clean | Verified session result with movement, load, date and standard |
| Running | Half marathon under 1:45 | Race result or comparable verified effort |
| Triathlon | Finish an Olympic-distance event | Event completion, multisport logs |
| Training consistency | 3 sessions/week for 12 weeks | Completed sessions and attendance |
| Nutrition | Log regular meals or meet an agreed fueling routine | Meal log adherence, not punitive compliance |
| Mobility | Follow a prescribed routine | Session adherence and self-reported progress |
| Rehab | Meet clinician-defined functional checkpoint | Authorized professional evaluation, not AI clearance |

## Domain model

```json
{
  "goal_id": "goal_101",
  "owner_athlete_id": "ath_42",
  "category": "endurance",
  "metric": "half_marathon_finish_time_seconds",
  "target_value": 6300,
  "target_date": "2027-05-16",
  "baseline": {"value": 6900, "measured_at": "2026-09-30"},
  "milestone_ids": ["ms_1", "ms_2"],
  "visibility": "private",
  "review_owner_id": "coach_8",
  "status": "active"
}
```

Avoid assuming progress is linear. The agent must differentiate a goal from a statistical forecast or implied guarantee.

## Core workflow

1. Athlete or authorized coach sets a goal with measurable unit, target date and source of validation.
2. Establish a baseline or explicitly note missing measurement.
3. Define interim milestones and an associated training plan, with athlete approval.
4. Ingest completed sessions, outcomes and appropriate health/nutrition/rehab context as permissioned.
5. Calculate progress deterministically, including sample size and comparability.
6. Explain trends, barriers and missing evidence in plain language.
7. Draft plan adjustment or revised milestone and request approval.
8. Keep chronological revisions and original targets for historical integrity.

## Agent tools

`createGoalDraft`, `getGoal`, `getEvidenceForGoal`, `calculateProgress`, `getTrainingPlan`, `getAuthorizedContext`, `proposeMilestone`, `proposePlanRevision`, `saveProgressReview`.

## Professional views

**Coach:** assigned goals, adherence, comparable session trends, check-in comments, future milestone review.  
**Physiotherapist:** only goals connected to rehab case and authorized data. Functional goal completion must be reviewed by qualified staff.  
**Studio:** program participation and aggregated challenge results; personal outcomes available only where the athlete opts in.  
**Athlete:** complete control of personal goal visibility and goal revisions.

## Progress scoring and uncertainty

Metrics use explicit units and event types. Only compare equivalent CrossFit WOD variations when standards and scaling are comparable. Cycling FTP estimates from different protocols require method labels. Swimming pace comparisons should note pool length and workout type. Route/conditions affect running paces. Cross-device discrepancies should be surfaced rather than averaged without policy.

## Example insight

“You completed 9 of 12 planned sessions in the last four weeks. Your two recent 5 km efforts used different routes, so a pace improvement is possible but not yet confirmed. Consider repeating a comparable benchmark session.”

## Safety and behavior

- Support flexible, user-defined priorities and recovery periods.
- Avoid shaming language, coercive streaks, or automatic restrictive nutrition targets.
- Injury-related milestones do not confer medical clearance.
- An authorized human reviews significant plan changes affecting rehab restrictions or high training loads.

## MVP deliverables

Goal wizard, KPI configuration, baseline and evidence service, milestone timeline, periodic progress review, shared coach review view, audit of changed targets.

## Acceptance tests

- Goal results cite actual source sessions or benchmark measurements.
- Athlete changing target does not erase historical revisions.
- CrossFit scaled and RX sessions are not silently treated as identical.
- Studio challenges cannot expose private nutrition or health metrics.
- Physiotherapist-defined rehab completion cannot be set by the agent alone.
