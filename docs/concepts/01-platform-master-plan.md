# Platform Master Plan — Multi-Role Athlete Intelligence

## 1. Executive summary

Build a modular training and wellness platform for (1) individual athletes, (2) coaches, (3) physiotherapists, and (4) training studios. It unifies structured workouts for CrossFit, triathlon disciplines, yoga, HIIT, strength and other modalities; activity tracking; wearable measurements; food logging and nutrition planning; rehab programs; personal goals; and qualified professional workflows. AI adds extraction, adaptation, planning, recovery interpretation, coaching, progress explanation, and optional video-based movement review. No AI agent owns unrestricted access to all data.

## 2. Product surfaces

| Surface | Main jobs | Visibility limits |
|---|---|---|
| Athlete app (mobile/web) | Log and execute workouts, sync devices, track meals and recovery, review goals, grant access | Entire self-controlled account; professional record sharing is explicit |
| Coach workspace | Plan workouts, review assigned athletes, comment, manage teams/classes, approve suggestions | Only athlete-authorized training/performance views |
| Physiotherapist workspace | Assess/document externally established restrictions, assign rehab routines, monitor logged progress, oversee return-to-training | Only explicitly shared rehabilitation and clinically relevant views |
| Studio admin | Classes, spaces, memberships, instructor schedules, attendance, optional programming | Operational records only by default; health data access is not implied |
| Super-admin/security | Platform health, abuse, billing, audits and service reliability | Minimal content visibility; break-glass access controlled, justified and audited |

## 3. Existing capability domains to integrate

- **Workout Core:** templates, planned sessions, completed sessions, blocks/steps/prescriptions, session outcomes, exercise catalog, timestamps, scoring and personal records.
- **Workout AI:** import, adaptation, generation, training planning, analysis; validation as deterministic service.
- **Health & Wearables:** Apple Health/HealthKit and Garmin data ingestion, source provenance, quality flags, de-duplication and synchronization.
- **Nutrition:** food catalog, recipes, meal logging, macro/micro tracking, hydration, fueling, planning and trend analysis.
- **Rehabilitation:** injury-related records, restrictions, prescribed rehab, session outcomes, professional review and return-to-training checkpoints.
- **Platform Operations:** performance observability, security monitoring, incident management, agents with limited privileges.

## 4. Recommended system architecture

```text
Athlete App   Coach Portal   Physio Portal   Studio Portal
        \          |             |             /
            API Gateway / BFF / Identity
                        |
            Policy & Consent Service
                        |
  ----------------------------------------------------
  | Workout | Calendar | Goals | Health | Nutrition  |
  | Rehab   | Org/CRM  | Media | Analytics | Billing |
  ----------------------------------------------------
                        |
    Event Bus + Background Jobs + Integration Adapters
                        |
             Agent Orchestration Service
     (tool ACLs, prompt policies, evals, approval gates)
                        |
      AI proposals -> Validators -> Authorized actions
                        |
   Audit + Observability + Security + Data Governance
```

Prefer a modular monolith initially, with boundaries that can later split into services. Avoid premature distributed-agent coordination. Separate transactional data from time-series telemetry and large video objects.

## 5. Canonical concepts

- **Identity:** `user`, `identity_provider`, `session`, `device`.
- **Tenancy:** `organization`, `organization_member`, `facility`, `team`, `class_session`, `organization_role`.
- **Professional relationships:** `athlete_professional_relationship`, `care_team`, `assignment`, `data_share_grant`.
- **Training:** `exercise`, `workout_definition`, `workout_version`, `workout_block`, `workout_step`, `workout_prescription`, `scheduled_workout`, `completed_session`, `session_result`.
- **Wellness:** `health_observation`, `wearable_connection`, `daily_checkin`, `personal_baseline`, `recovery_insight`.
- **Food:** `food_item`, `meal_log`, `recipe`, `nutrition_target`, `hydration_log`.
- **Rehab:** `rehab_case`, `functional_restriction`, `rehab_plan`, `rehab_exercise_log`, `professional_review`.
- **Intelligence:** `goal`, `milestone`, `insight`, `agent_run`, `agent_proposal`, `approval`, `evaluation`.
- **Governance:** `consent_record`, `access_grant`, `audit_event`, `data_export_job`, `deletion_request`, `retention_policy`.

Use immutable or append-only historical event records where provenance matters. Store both *planned* and *actual* values; preserve source identifiers, source time, ingestion time, timezone and measurement units.

## 6. Explicit sharing model

The athlete is the primary principal for personal fitness and wellness records. A coach may receive workout/performance access without viewing nutrition. A physiotherapist may receive rehab data without viewing unrelated studio history. A studio manager can schedule classes and see attendance without seeing HRV, injury details or personal meals. A professional's own notes may have additional access rules that must be defined contractually and legally.

A grant is scoped by **recipient + athlete + data category + purpose + operation + expiry**. Revocation stops future access, but cannot necessarily undo copies lawfully exported before revocation; communicate that clearly. Consider guardian workflows separately for minors; do not infer minor consent from studio enrollment.

## 7. Intelligence architecture

| Capability | Primary design | Approval posture |
|---|---|---|
| Workout import | LLM extraction + deterministic schema checking | User verifies ambiguities |
| Workout adaptation | Rules + retrieval + model draft | User / coach approval before assignment |
| Workout generation | Model drafts from controlled catalog | User review |
| Planning | Calendar and constraints engine + model explanations | User / coach approval |
| Workout analysis | Deterministic statistics + model narrative | Read-only insight |
| Recovery/readiness | Baseline & feature service + constrained narrative | Suggestions only, never diagnosis |
| Conversational coach | Tool-calling router with policy | High-impact writes require confirmation |
| Goals & progress | Goal engine + KPI computations + review assistant | Plan changes need confirmation |
| Movement analysis | Video processing + qualified review where needed | No automatic clearance, diagnosis or rehab progression |
| Performance/security | Operational detection and controlled incident tools | Read-only first; privileged remediation gated |

## 8. Integration strategy

- Apple Health: permissioned data access through supported Apple platform flows; data availability varies by device, app and permissions.
- Garmin: investigate appropriate approved developer APIs and commercial terms; do not assume access to all Garmin-only scores, historical depth or write capabilities.
- Optional later: standardized activity file imports (FIT, TCX, GPX), other wearable vendors, exercise and food databases, calendar providers, payment processing.
- Each connector must expose capabilities, freshness, consent, known limitations, backfill behavior, rate limits and revocation handling.
- Wearable measurements and inferred risk indicators must not be presented as clinical fact.

## 9. Safety and regulatory posture

- Treat health/rehab information as sensitive data, with data minimization, explicit consent where required, encryption, audit access, configurable retention, export/deletion processes and jurisdiction review.
- EU/EEA deployments require GDPR-focused design and a legal review of controller/processor roles across studios, clinics, coaches and the platform. Whether any feature qualifies as regulated medical software depends on intended use, claims and actual behavior; obtain specialist review before clinical marketing.
- Do not let a general-purpose AI system diagnose injuries, determine readiness-to-return, approve medical treatment, or automatically overwrite clinician-defined restrictions.
- Escalation: sudden severe symptoms, acute injury signals or ambiguous high-risk requests are directed to qualified care rather than confident prescriptive changes.

## 10. Cross-cutting quality attributes

- Availability and reliability: define SLOs for workout entry and logging separately from AI generation and external sync; degrade gracefully.
- Security: tenant isolation, least privilege, robust session controls, secrets management, secure media handling, signed webhooks, anomaly monitoring.
- Data quality: source priority rules, provenance, units, timestamp normalization, duplicate detection, missingness and freshness flags.
- Accessibility: screen-reader support, large timer visuals, localization, contrast, reduced motion, disability-aware activity alternatives.
- Portability: clear export format for workouts, sessions, measurements, food logs and data sharing decisions.
- AI quality: curated evaluations by sport, repeated regression tests, refusal/safety evaluations, monitored costs and latency.

## 11. Five expansion stages

| Stage | Name | Foundation | First demonstrable outcome |
|---|---|---|---|
| 1 | Athlete Intelligence Foundation | Identity, consent, data linkage, role-ready domain model, shared rules/tools | An athlete can view connected workout/health data and share selected training info with a coach |
| 2 | Recovery & Readiness | Baseline analytics, daily check-ins, recovery suggestions | Explainable suggestion to adjust a planned session with explicit confirmation |
| 3 | AI Coaching | Conversational orchestration and professional handoff | Athlete requests advice; agent retrieves permitted context, proposes an action and awaits approval |
| 4 | Goal & Progress | Structured goals, milestone engine, objective measures, coach reviews | Athlete and coach track progress against a race or strength goal |
| 5 | Movement Analysis | Video pipeline, pose review, human feedback and consent controls | Athlete uploads exercise clip; gets bounded technique observations and optional coach/physio review |

## 12. Launch and rollout strategy

**Wave A: Individual athlete MVP.** Workout Core, food logging basics, wearable connection, simple goals, and secure sessions.  
**Wave B: Coach beta.** Consent-driven athlete linking, assignments, comments, progress view, simple programming and invoicing integration as needed.  
**Wave C: Physio beta.** Rehab record segregation, restrictions, controlled plans and clinician review workflow.  
**Wave D: Studio beta.** Organizations, classes, memberships, instructor permission models, location resources and attendance.  
**Wave E: Intelligence and scale.** Recovery, coaching, goal intelligence, movement analysis and advanced organization reporting.

## 13. Critical product decisions / ADR queue

1. Personal records under athlete control vs organization-generated records and their respective contractual ownership.
2. Scope of physiotherapy: wellness coordination only or intended medical use (regulatory impact).
3. Data tenancy strategy (shared DB with tenant isolation vs high-assurance tenant segregation).
4. Organization roles and professional license verification policies.
5. Granularity of consent categories and purpose-based grants.
6. Video retention defaults and human review contracts.
7. Offline-first workout/session logging model.
8. Integration licensing and wearable provider constraints.
9. Country launch order, hosting locations and cross-border transfers.
10. Business pricing: individual subscription, per-coach seat, per-studio location, professional add-ons.

## 14. Definition of product success

Measure activation (first recorded workout), meaningful use (repeat workouts and food logs), data sync reliability, coach assignment completion, physiotherapist review cycle time, studio class attendance operations, user-controlled sharing adoption, safety incidents, AI acceptance/correction rates and paid retention. Never optimize for training intensity or total exercise volume as the sole proxy for success.
