# Injury Rehabilitation & Return-to-Training Module

**Product and Technical Concept | Version 1.0 | 13 October 2026**

## 1. Executive Summary

Build a standalone **Injury Rehabilitation & Return-to-Training** module that integrates with the existing Workout Core, AI Agents, Health/Wearables, Nutrition, and Training Planning systems. It supports documenting injuries, recording clinician-approved restrictions, following rehabilitation exercise programs, tracking symptoms and functional progress, and returning to training in a gradual, criteria-based manner.

**Product boundary:** This is a tracking, education, coordination, and training-support product—not an autonomous diagnostic or treatment system. It must never claim that wearable metrics alone diagnose an injury or establish readiness to return to sport. Injury-specific treatment, post-operative protocols, clinical clearance, and red-flag assessment belong to qualified healthcare professionals.

### Primary product outcomes

- Record the history and status of an injury episode without requiring a self-diagnosis.
- Track symptoms, prescribed rehabilitation activities, adherence, and function over time.
- Manage an injury-specific exercise plan and clinician-defined restrictions.
- Suggest **draft** adaptations to the user's regular workouts, subject to safety checks and approval.
- Integrate completed rehab sessions into the overall training calendar and load history.
- Support clinician-athlete collaboration and milestone-based return-to-sport (RTS).
- Respect privacy, consent, provenance, and medical-data retention requirements.

## 2. Users and Roles

| Role | Capabilities | Restrictions |
|---|---|---|
| Athlete | Log symptoms and rehab sessions; review plans; request adaptations; share selected records | Cannot self-assign clinician approval or override locked restrictions through AI |
| Physiotherapist | Create or modify rehabilitation programs; define criteria, restrictions and checkpoints | Access only to explicitly shared cases and information |
| Physician / qualified clinician | Record clinical decisions and clearance when relevant | Identity and professional permissions must be verified before displaying clinician status |
| Coach | View athlete-approved training modifications and relevant participation limits | No default access to detailed diagnoses or private notes |
| Platform administrator | Operate system, permissions and audit controls | No routine access to clinical content |
| AI assistant | Draft summaries, plans from clinician instructions, exercise mappings and alerts | No autonomous diagnosis, treatment prescription, clearance or restriction removal |

## 3. Supported Use Cases

1. **Injury intake:** User logs body region, onset, context, symptoms and current impact; may attach a clinician's assessment.
2. **Rehab plan tracking:** A therapist provides exercises, dosage, frequency and allowed progression rules; athlete records completion and responses.
3. **Training adjustments:** The application proposes alternative activities or reduced exposure for conflicting workouts without silently changing the original.
4. **Symptom monitoring:** User records pain/discomfort, swelling, perceived function, tolerance and symptom changes, with time and context.
5. **Wearable context:** Sleep, HRV, resting heart rate, training minutes and external load are displayed as contextual signals, not injury tests.
6. **Return to participation:** Athlete follows documented checkpoints and progresses only when clinician-defined criteria and approvals are met.
7. **Coach/clinician collaboration:** Selected reports can be shared with expiry, revocation and an access log.
8. **Recurrence prevention:** Optional maintenance exercises and workload-management reminders after an episode closes.

## 4. Functional Domains

### 4.1 Injury Episode Registry

Each `InjuryEpisode` is a time-bounded record, not necessarily a verified medical diagnosis. Recommended fields:

| Field | Meaning |
|---|---|
| `id`, `athlete_id` | Stable identity and owner |
| `body_region`, `laterality` | Body area and left/right/bilateral |
| `onset_date`, `onset_type` | Approximate date and sudden/gradual/unknown |
| `reported_problem` | User-described issue in their words |
| `clinical_diagnosis` | Optional; with author, date and provenance |
| `status` | `reported`, `under_assessment`, `rehabilitating`, `returning_to_training`, `resolved`, `paused` |
| `affected_activities` | Running, squatting, swimming, etc. |
| `restrictions` | Time-bounded, provenance-tagged limitations |
| `care_team`, `attachments` | Authorized clinicians and documents |
| `created_at`, `updated_at` | Auditable timestamps |

Do not infer a definitive diagnosis from symptom entries, images, or wearables.

### 4.2 Rehab Plan Builder and Tracker

A `RehabPlan` consists of phases, sessions and prescribed steps. Reuse the universal Workout Core (`Workout` → `Block` → `Step` → `Prescription`) wherever possible, with rehab-specific extensions for restrictions, laterality, symptom-response instructions, clinician provenance and milestones.

Supported activities include mobility, isometrics, controlled strength, balance/proprioception, graded cardio, sport-specific drills, breathing/relaxation, and functional tests **when entered or authorized by a clinician**.

A prescription can specify `sets`, `repetitions`, `hold_seconds`, `time_under_tension`, `resistance`, `tempo`, `side`, `rest_seconds`, `frequency`, and optional response/stop conditions. Do not use universal pain thresholds for automatic progression; thresholds and decision rules should be individualized and clinician-set.

### 4.3 Symptom & Function Tracking

Track a minimal, user-friendly daily or session-based check-in:

- Symptom location, intensity on an explicitly labelled subjective scale, character and timing.
- Activity associated with symptoms and changes during or after the session.
- Self-reported ability to perform relevant daily and sport-specific tasks.
- Optional swelling, stiffness, sleep disruption, confidence and fatigue.
- Clinician-selected patient-reported outcome measures only where appropriate and correctly licensed.
- Changes from baseline displayed descriptively rather than as a diagnosis.

Avoid overprompting or implying every symptom fluctuation is clinically significant. Support user control over reminders and longitudinal charts.

### 4.4 Restrictions and Activity Conflict Detection

Represent restrictions as scoped, time-bound, authored rules:

```json
{
  "restriction_id": "restriction_001",
  "episode_id": "injury_001",
  "scope": {"activity_tags": ["running", "jumping"]},
  "rule": "review_required_before_participation",
  "reason": "clinician_documented_limit",
  "issued_by": {"role": "physiotherapist", "id": "provider_001"},
  "effective_from": "2026-10-13",
  "expires_at": null,
  "status": "active"
}
```

When a planned workout conflicts with a restriction, show an explicit warning and offer a draft alternative. Do not let the AI remove clinician restrictions or unilaterally resume contraindicated activities.

### 4.5 Return-to-Sport Continuum

Use three broad statuses derived from the sports physiotherapy consensus framework:

1. **Return to participation:** Modified activity below the user's intended sport level.
2. **Return to sport:** Participation in the target sport, not necessarily at prior performance.
3. **Return to performance:** Gradual restoration of the desired performance level.

These are tracking states, **not automatic medical clearances**. Phases must be supported by individualized functional, symptom, task and clinical criteria; document both the evidence and the person who authorized each progression. Do not use a fixed number of days, a single HRV reading, or arbitrary limb-symmetry cutoffs to grant clearance.

## 5. AI Agent Concepts

### 5.1 Injury Intake & Documentation Assistant — P1

**Purpose:** Structure athlete-reported details and clinician-authored notes into an editable injury record.

**Inputs:** User text, forms, consented documents, affected sport activities.

**Tools:** `createInjuryDraft`, `extractDocumentText`, `mapBodyRegion`, `getExistingEpisodes`, `validateInjuryRecord`.

**Output:** A draft with explicit distinctions between *reported symptoms*, *suspected concerns* (if reported), and *clinician-confirmed findings*.

**Guardrails:** No AI diagnosis; do not invent injury dates, severity or clinician instructions. For possible emergencies, direct the user toward urgent professional evaluation rather than suggesting exercises.

### 5.2 Rehab Plan Assistant — P2

**Purpose:** Convert an authorized clinician's program into trackable workout blocks, reminders and session logs.

**Inputs:** Clinician-authored plan, current plan version, equipment and schedule.

**Tools:** `getAuthorizedPlan`, `searchRehabExerciseCatalog`, `buildRehabWorkoutDraft`, `validatePrescription`, `requestClinicianReview`.

**Output:** Structured, source-linked rehabilitation sessions and adherence schedule.

**Guardrails:** AI may clarify ambiguous prescriptions but must not guess dosage or invent medical progressions. New therapeutic plans require qualified clinician review where care decisions are involved.

### 5.3 Training Modification Assistant — P1

**Purpose:** Identify conflicts between normal workouts and current documented restrictions; propose alternatives.

**Inputs:** Workout, active restrictions, clinician-approved activities, athlete preferences.

**Tools:** `getWorkout`, `getActiveRestrictions`, `searchExerciseAlternatives`, `estimateWorkoutLoad`, `validateWorkout`, `createWorkoutVariant`.

**Output:** Proposed modified workout, change list, preserved training objective, unresolved risks and approval state.

**Guardrails:** A proposal is not a clearance. If safety cannot be established under available instructions, block the substitution and recommend clinical review.

### 5.4 Rehab Progress & Adherence Assistant — P2

**Purpose:** Explain trends in completed exercises, symptoms, activity tolerance and documented milestones.

**Inputs:** Rehab session results, check-ins, prescribed milestones, data coverage.

**Tools:** `getRehabSessions`, `computeAdherence`, `compareSelfReportedFunction`, `getMilestones`, `createProgressReport`.

**Output:** Factual progress report with source dates, missing data, and questions to discuss with a clinician.

**Guardrails:** Do not assert healing from declining pain scores alone or predict exact recovery dates.

### 5.5 Return-to-Training Coordination Assistant — P3

**Purpose:** Coordinate calendars, approved rehabilitation milestones and tentative increases in training exposure.

**Inputs:** Clinician-set criteria, clearance records, planned workouts, training history and athlete goals.

**Tools:** `getReturnToSportPlan`, `getClearanceStatus`, `detectRestrictionConflicts`, `createScheduleDraft`, `requestClinicalApproval`.

**Output:** Criteria-based progression proposal and explicit unmet checkpoints.

**Guardrails:** No automated clearance, competitive return, or lifting of restrictions. Any change to medical decision status needs an authorized professional action.

### 5.6 Safety & Escalation Service — P0

**Purpose:** Deterministically enforce permissions, schema validity, contraindication rules and escalation pathways.

It should **not** be an LLM-only agent. Use structured rules and explicit human review. Clinical red flags require jurisdictionally appropriate escalation guidance. Examples warranting urgent assessment may include major deformity, inability to bear weight after significant trauma, new significant neurological deficits, or systemic illness with severe symptoms; the exact triage rules and wording must be developed and reviewed by qualified clinicians, not hardcoded from a generic AI response.

**Tools:** `validateRehabSchema`, `enforceAccessPolicy`, `checkActiveRestrictions`, `checkProgressionAuthorization`, `flagSafetyReview`, `recordAuditEvent`.

## 6. Cross-Module Integrations

| Existing module | Rehab integration |
|---|---|
| Workout Core | Reuse blocks, exercises and sessions with rehab-specific metadata |
| Workout Import Agent | Parse clinician documents while preserving provenance and requiring review |
| Workout Adaptation Agent | Generate restriction-aware *draft* variants |
| Workout Generation Agent | Generate only non-clinical fitness content within verified restrictions; do not prescribe rehabilitation treatment |
| Training Planning Agent | Reserve rehab sessions, identify conflicts, respect clearance states |
| Workout Analysis Agent | Show participation, adherence and performance trends without diagnosis |
| Health & Wearables | Use sleep, HRV, pulse and activity as contextual information; display device provenance and quality |
| Nutrition | Track dietary intake and support general nutrition goals; no injury-healing claims or clinical diet prescriptions without qualified oversight |

### Wearable-specific caution

Apple Health and Garmin metrics vary by device, permissions, firmware and integration. Sleep scores, HRV, stress metrics, readiness, VO2max and estimated training load are not interchangeable across vendors, and they are not substitutes for clinical rehabilitation assessments. Normalize units and timestamps, **not** proprietary meaning. Store each metric's source, method, freshness and coverage.

## 7. Data Architecture

Recommended additional entities:

| Entity | Key relationships |
|---|---|
| `injury_episodes` | Athlete; optional clinician diagnosis |
| `injury_symptom_logs` | Injury episode; timestamp; context |
| `rehab_plans` | Injury episode; author; version |
| `rehab_phases` | Plan; milestones and authorized transitions |
| `rehab_sessions` | Plan phase; underlying Workout Session |
| `rehab_session_results` | Session; completed steps and responses |
| `activity_restrictions` | Episode; issuer; status; effective dates |
| `functional_assessments` | Episode; test type; method; assessor; result |
| `return_to_sport_decisions` | Episode; criteria; clinician; authorization |
| `care_team_access_grants` | Athlete; principal; scopes; expiry; revocation |
| `rehab_attachments` | Episode; secure references and metadata |
| `rehab_audit_events` | Actor, action, time, record, decision outcome |

### Example: Injury and rehab prescription

```json
{
  "injury_episode": {
    "id": "injury_001",
    "athlete_id": "athlete_123",
    "body_region": "knee",
    "laterality": "left",
    "reported_problem": "Discomfort during running",
    "clinical_diagnosis": null,
    "status": "under_assessment"
  },
  "rehab_plan": {
    "id": "rehab_001",
    "episode_id": "injury_001",
    "status": "draft_pending_clinician_review",
    "source": "clinician_document",
    "phases": [
      {
        "id": "phase_001",
        "label": "Clinician-defined initial phase",
        "exercises": [
          {
            "exercise_id": "exercise_from_clinician_plan",
            "prescription": {"sets": null, "reps": null},
            "requires_clarification": true
          }
        ],
        "progression_criteria": [],
        "requires_clinician_approval": true
      }
    ]
  }
}
```

`null` values intentionally prevent the system from guessing treatment doses.

### Example: Completed rehab session

```json
{
  "session_id": "rehab_session_101",
  "plan_id": "rehab_001",
  "performed_at": "2026-10-13T18:00:00+02:00",
  "completed_steps": [
    {
      "exercise_id": "exercise_from_clinician_plan",
      "completed": true,
      "actual_sets": 2,
      "actual_reps_per_set": [8, 8]
    }
  ],
  "user_report": {
    "symptom_score": 2,
    "scale": "user_reported_0_to_10",
    "comment": "Example data only"
  },
  "clinical_interpretation": null
}
```

These examples demonstrate structure only and do not recommend an exercise dosage.

## 8. API and Tool Contracts

Proposed endpoints (all authenticated, scoped and auditable):

```text
POST   /v1/injuries/drafts
GET    /v1/injuries/{episodeId}
POST   /v1/injuries/{episodeId}/symptoms
GET    /v1/injuries/{episodeId}/restrictions
POST   /v1/rehab-plans/drafts
POST   /v1/rehab-plans/{planId}/approve
GET    /v1/rehab-plans/{planId}/sessions
POST   /v1/rehab-sessions/{sessionId}/results
POST   /v1/workouts/{workoutId}/rehab-compatibility-check
GET    /v1/injuries/{episodeId}/progress
POST   /v1/injuries/{episodeId}/care-team-grants
POST   /v1/injuries/{episodeId}/return-to-sport-decisions
```

Apply role-based authorization to approval endpoints; a user agreeing with an AI suggestion must not be misrepresented as clinician sign-off.

### Standard agent result

```json
{
  "request_id": "req_rehab_001",
  "status": "requires_review",
  "result": {"draft_id": "draft_rehab_001"},
  "validation": {
    "schema_valid": true,
    "restriction_conflicts": [],
    "unresolved_clinical_questions": ["Confirm exercise dosage with treating clinician"]
  },
  "approval": {
    "required_role": "clinician",
    "granted": false
  }
}
```

## 9. Privacy, Security & Regulatory Design

In the EU/EEA, health information is sensitive personal data. Design for GDPR-compliant lawful basis and additional conditions for special-category processing, purpose limitation, data minimization, encryption in transit/at rest, deletion/export rights where applicable, access logging and retention policies. Perform an appropriate privacy and security review, including DPIA where warranted.

- Make health-data import and care-team sharing separate, granular choices.
- Use revocable scopes for providers and coaches; do not give coaches broad access to diagnosis details.
- Partition tenant data and enforce least-privilege access to attachments and clinical notes.
- Keep clinician-authored records distinct from AI-generated drafts; preserve author and revisions.
- Do not silently use intimate health data for model training or unrelated personalization.
- Design safety-event reporting, human escalation and incident response before release.
- **Medical-device boundary:** If the product claims diagnosis, treatment planning, clinical decision support or risk prediction, assess EU MDR/IVDR and applicable national requirements with specialist regulatory counsel. A disclaimer alone does not determine classification.

## 10. User Experience

Recommended screens:

1. **Injury Overview:** Active episode, status, current restrictions and next approved session.
2. **Rehab Today:** Exercises, demonstrations, prescribed dosage and logging controls.
3. **Symptoms & Function:** Optional quick check-in and trends by activity.
4. **Workout Compatibility:** Conflict explanations and proposed non-prescriptive alternatives.
5. **Return-to-Training Timeline:** Individualized milestones and clear approval status.
6. **Care Team Sharing:** Granular, expiring permissions and report export.

Use plain language. Avoid gamifying pain reduction, punishing missed rehab sessions, or presenting generic readiness scores as medical clearance.

## 11. MVP Roadmap

| Phase | Scope | Exit criteria |
|---|---|---|
| **P0 Foundation** | Injury episodes, symptom logging, clinician restrictions, privacy model, deterministic rules | Accurate tracking, enforceable permissions, basic safety flows |
| **P1 Connected Rehab** | Clinician-program import, structured rehab sessions, workout conflict detection, draft adaptations | Traceable exercise plan and secure session completion |
| **P2 Rehab Intelligence** | Progress summaries, adherence, functional tracking, clinician collaboration | Understandable, auditable longitudinal reports |
| **P3 Return to Training** | Criterion-based milestone workflow, training-plan coordination, provider authorization | No automatic clearance; documented shared decision-making |

### Not in the initial MVP

- Automated injury diagnosis from symptoms or imagery.
- AI-prescribed post-surgical rehabilitation protocols.
- Universal numerical readiness scores or autonomous return-to-play decisions.
- Prediction of exact recovery dates, re-injury odds or medical outcomes.

## 12. Quality Metrics and Testing

Measure:

- Exercise mapping accuracy and number of unresolved clinician instructions.
- Session logging completion and usability (not mandatory adherence targets).
- Precision/recall of **deterministic** conflict detection against a clinician-reviewed test suite.
- No unauthorized change to restrictions, approvals or shared records.
- User understanding of the difference between a workout proposal and medical clearance.
- Timestamp/provenance completeness, duplicate handling and wearable data quality.
- Accessibility, security audits, bias checks and clinical safety review findings.

Test with simulated scenarios across CrossFit (squats, Olympic lifting, jumps), triathlon (run/bike/swim transitions), yoga (range-of-motion variants) and HIIT (impact and plyometrics). Validate workflows with practicing clinicians and representative users before release.

## 13. Example End-to-End Journey

1. A runner records left-knee discomfort and marks running as an affected activity; the app does **not** diagnose the cause.
2. An authorized physiotherapist uploads a program and records temporary restrictions.
3. The import assistant structures the clinician's instructions, flagging missing exercise dosage for review.
4. The athlete logs rehab sessions and optional symptom responses.
5. A planned running workout conflicts with the documented restriction. The system flags the conflict and can propose a draft substitution only if compatible with authorized activities.
6. The progress assistant summarizes adherence, user-reported function and unanswered clinical questions.
7. The clinician documents the relevant functional criteria and makes a return-to-training decision.
8. The planning module updates the future schedule **after** the required approvals, keeping previous plans and decisions auditable.

## 14. Reference and Evidence Notes

This document is a **product architecture concept**, not a clinical practice guideline. Injury-specific protocols should be created and reviewed with suitably qualified specialists and updated against appropriate current guidance.

- Ardern CL et al. **2016 Consensus statement on return to sport from the First World Congress in Sports Physical Therapy, Bern**. *British Journal of Sports Medicine*. https://doi.org/10.1136/bjsports-2016-096278 — supports a gradual, criteria-based and shared return-to-sport model.
- [European Commission — Medical devices](https://health.ec.europa.eu/medical-devices-sector_en) — starting point for assessing applicable medical-device rules and guidance.
- [European Commission — Data protection](https://commission.europa.eu/law/law-topic/data-protection_en) — starting point for EU privacy obligations.

## 15. Architecture Recommendation

**Start with an Injury Registry + Rehab Workout Tracking + Restriction Engine, not an autonomous Rehab Coach.** Reuse the universal Workout Core. Add one AI-powered documentation assistant and one restriction-aware workout modification workflow after the deterministic safety foundation is validated. Introduce clinician-authorized progression and return-to-sport coordination only when robust role management, clinical review and auditability are in place.
