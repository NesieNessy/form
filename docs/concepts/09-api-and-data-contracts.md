# API, Event and Data Contract Blueprint

## 1. Standards

- JSON over authenticated HTTP for synchronous calls; version all externally published APIs.
- UUID/ULID identifiers; ISO 8601 timestamps with offsets stored consistently; metric units normalized and explicitly labeled.
- Use consistent state transitions for draft, approved, published, revoked, completed and archived entities.
- Introduce tenant/actor/purpose context at authentication and propagate it to all downstream tool calls.
- Schema validation must be deterministic and implemented server-side.

## 2. API groups

| Group | Example endpoints | Access |
|---|---|---|
| Identity/tenancy | `GET /v1/me`; `POST /v1/organizations`; `POST /v1/relationships/invitations` | Authenticated, role-scoped |
| Consent | `GET /v1/data-grants`; `POST /v1/data-grants`; `DELETE /v1/data-grants/{id}` | Athlete-controlled, policy-enforced |
| Workouts | `POST /v1/workout-drafts`; `POST /v1/workouts/{id}/assign`; `POST /v1/sessions` | Owner or authorized coach |
| Health | `GET /v1/health/observations`; `GET /v1/health/baselines`; `POST /v1/wearable-connections` | Sensitive read scope required |
| Nutrition | `POST /v1/meals`; `GET /v1/nutrition/summary` | Nutrition scope required |
| Rehab | `POST /v1/rehab/cases`; `POST /v1/rehab/reviews` | Case-specific professional access |
| Recovery | `POST /v1/checkins`; `GET /v1/recovery/insights`; `POST /v1/recovery/proposals` | Athlete / explicit summary scope |
| AI coaching | `POST /v1/assistant/turns`; `GET /v1/assistant/proposals/{id}` | Effective actor permissions |
| Goals | `POST /v1/goals`; `GET /v1/goals/{id}/progress`; `POST /v1/goals/{id}/reviews` | Owner or authorized professional |
| Movement | `POST /v1/media/upload-sessions`; `POST /v1/movement/analyses`; `POST /v1/movement/reviews` | Explicit media scope |
| Studio | `POST /v1/classes`; `POST /v1/classes/{id}/bookings`; `GET /v1/attendance` | Operational org permission |
| Audit/export | `GET /v1/me/data-access`; `POST /v1/me/data-export` | Athlete; compliance operations as needed |

## 3. Agent proposal contract

```json
{
  "proposal_id": "prop_88",
  "type": "workout_adaptation",
  "actor_id": "ath_42",
  "subject_athlete_id": "ath_42",
  "organization_context_id": null,
  "source_refs": [{"type": "scheduled_workout", "id": "sw_21", "version": 3}],
  "changes": [{"path": "blocks[0].duration_seconds", "old": 2400, "new": 1800}],
  "reason": "User requested a 30-minute session",
  "validation": {"valid": true, "warnings": []},
  "state": "pending_approval",
  "created_at": "2026-10-13T12:00:00Z",
  "expires_at": "2026-10-20T12:00:00Z"
}
```

The approval endpoint checks current scope and resource version again; proposals are not an authorization bypass. Use idempotency keys and optimistic locking.

## 4. Health observation contract

```json
{
  "observation_id": "obs_77",
  "subject_athlete_id": "ath_42",
  "metric": "resting_heart_rate",
  "value": 54,
  "unit": "beats_per_minute",
  "observed_at": "2026-10-13T05:30:00+02:00",
  "ingested_at": "2026-10-13T06:15:00Z",
  "source": {"provider": "wearable_provider", "device_id": "dev_18", "external_id": "source_abc"},
  "quality": {"status": "accepted", "flags": []},
  "derivation": "provider_reported"
}
```

Never merge incompatible measurement definitions just because their display names match; keep algorithm/protocol version where known.

## 5. Professional relationship contract

```json
{
  "relationship_id": "rel_12",
  "athlete_id": "ath_42",
  "professional_user_id": "coach_8",
  "relationship_type": "training_coach",
  "organization_id": "studio_3",
  "status": "active",
  "authorized_grant_ids": ["grant_91"]
}
```

Role affiliation alone never implies the contents of `authorized_grant_ids`.

## 6. Event envelope

```json
{
  "event_id": "evt_991",
  "event_type": "WorkoutCompleted",
  "schema_version": 1,
  "occurred_at": "2026-10-13T17:30:00Z",
  "producer": "workout-service",
  "subject_id": "ath_42",
  "entity": {"type": "completed_session", "id": "sess_91"},
  "trace_id": "trace_17"
}
```

The event bus should not contain full raw health observations or therapy notes by default. Authorized consumers fetch them using a short-lived service identity, then enforce the user's current permissions.

## 7. Core end-to-end flows

### Athlete-to-coach assignment

Athlete consents to workout sharing -> coach selects assignment -> policy service verifies relationship/action -> workout version pinned -> athlete accepts/receives schedule -> session completed -> training-only event -> coach dashboard fetches authorized result.

### Recovery-informed adaptation

Wearable import -> de-duplication and baseline computation -> recovery insight -> agent produces proposed workout adjustment -> athlete approves -> validator checks no restriction conflicts -> scheduled workout version updated -> optional coach notification under grant.

### Therapist-led return-to-training

Therapist records functional restrictions -> athlete authorizes sharing a narrow training restriction view with coach -> workout adaptation honors restriction -> athlete executes -> progress log shared to clinician when consented -> clinician evaluates milestone and records decision. AI does not sign off.

### Studio class

Studio manager schedules class -> instructor programs class template -> member books -> operational attendance logged -> optional personal completed session written to member account with confirmation. Individual biometric readings are not sent to studio dashboards without purpose-specific consent.

### Movement review

Athlete authorizes video capture -> secure upload -> quality check -> bounded AI draft -> athlete elects to share with coach or therapist -> professional adds attributed review -> clip expires/deleted under policy.

## 8. Authorization matrix tests

Use automated test fixtures for each actor, organization and data category. Assert both API and agent tool gateway restrictions. Test revoked grants, expired grants, changed roles, old signed URLs, background jobs running after relationship termination, and metadata leaks through search/autocomplete.

## 9. Data lifecycle

Define ingest -> validate -> store -> use -> share -> archive -> delete/export for every category. Include lineage for model-generated inferences, retention rules for raw video, data reconciliation on wearable disconnect, and appropriate retention exceptions for legitimate professional records where applicable. Policies vary by jurisdiction and require legal review.

## 10. Observability and evaluations

Track API p95 latency, workout save success, offline replay conflicts, device sync completion, proposal rejection rates, access-denied audit volume, organization isolation tests, recovery insight abstention, AI source grounding, clinical safety escalations, video quality failures and median professional review time. Do not log raw health payloads in general tracing.
