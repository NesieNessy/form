# Stage 1 — Athlete Intelligence Foundation

## Objective

Create the shared data, identity, policy, event and AI tool foundation on which recovery, coaching, goals and movement analysis depend. Build role-ready access from the beginning, even if the first release is athlete-only.

## Product scope

**Athlete:** profile, preferences, sport disciplines, performance reference values, equipment, calendar availability, session history and wearable connection status.  
**Coach:** relationship invite, scoped workout assignment, selected progress overview.  
**Physiotherapist:** model care relationship and protected restrictions; defer full clinical workspace.  
**Studio:** organization, facility and basic membership models; defer payments/classes as needed.

## Minimum product modules

1. Identity, registration, sessions, organization memberships and account linking.
2. Workout Core compatibility (versions, planned vs completed sessions, exercise catalog).
3. Personal profile and sport-specific benchmarks (e.g., FTP, 1RM, threshold pace), with measurement date and source.
4. Health/wearable observation ingestion, units, provenance and data quality.
5. Consent and Data Sharing Center, professional invitations and revocation.
6. Activity/meal/rehab references with strict compartmentalized data categories.
7. Notifications and an event bus; audit trail; asynchronous connector jobs.
8. Deterministic workout validation, explicit AI draft and approval states.

## Canonical athlete context

```json
{
  "athlete_id": "ath_42",
  "sports": ["crossfit", "running", "cycling"],
  "goals": ["goal_101"],
  "equipment_profile_id": "eq_4",
  "benchmark_refs": ["benchmark_9"],
  "connection_refs": ["connection_7"],
  "data_policy_version": "v1"
}
```

Store sensitive data in dedicated stores/tables and provide only filtered context views to agent tools. Avoid one universally readable `athlete_profile` blob containing everything.

## Core service APIs

- `POST /v1/relationships/invitations`
- `POST /v1/data-grants` and `DELETE /v1/data-grants/{grantId}`
- `GET /v1/athletes/me/context?scope=training`
- `GET /v1/athletes/{id}/shared-context` (authorization enforced)
- `POST /v1/workout-drafts`, `POST /v1/workout-drafts/{id}/validate`
- `POST /v1/wearable-connections`, `GET /v1/sync-jobs/{id}`
- `GET /v1/audit/my-data-access`

## Shared events

`WorkoutScheduled`, `WorkoutCompleted`, `WearableObservationImported`, `DataGrantCreated`, `DataGrantRevoked`, `RelationshipEnded`, `AthleteBenchmarkUpdated`, `AgentProposalCreated`, `AgentProposalApproved`, `AgentProposalRejected`.

Events carry IDs and references, not raw medical or sensitive text unless an explicitly secured consumer needs it.

## Core agents / tools

- Tool gateway accepts effective end-user identity, recipient/organization context, consent scopes and action type.
- Audit every agent proposal, retrieval scope and privileged tool call.
- Structured tool results have freshness and provenance metadata.
- Implement read-only context retrieval before write-capable agent tools.
- Add model output validation and scenario test suites for each supported sport.

## Quality / non-functional gates

- Tenant isolation enforced through automated integration tests.
- No client-side authorization-only checks.
- Recorded consent provenance and immediate server-side enforcement on revocation.
- Wearable import idempotency and duplicate-source precedence rules.
- Inability of AI tools to access non-shared rehab and nutrition data.
- Offline session queue with conflict resolution if mobile logging is in MVP.

## Example user journey

Athlete creates an account -> logs two workouts -> connects a wearable -> reviews data categories -> invites a coach with workout data only -> coach assigns a session -> athlete completes it -> coach reviews performance while remaining unable to see private HRV or meals.

## Deliverables

Schema migrations; API specification; permission matrix and enforcement middleware; UI flows for account setup and grants; audit reports; exercise catalog mapping; contract and integration tests; operational alerts; privacy documentation.

## Acceptance criteria

- Athletes can see exactly which professional has access to each data category.
- Individual and professional workspaces show the same authorized workout truth without sharing forbidden context.
- A revoked grant takes effect for new requests.
- All stored observations have unit, event timestamp, ingestion timestamp, source and quality marker.
- Agent tool calls cannot bypass direct API authorization.

## Exclusions

No health diagnosis, automated readiness score without adequate baselines, full studio CRM, clinical decision automation, technique assessment, or personalized long-range recovery prescriptions in this stage.

## Dependencies

Existing Workout Data Model, AI Workout Agent Concepts, Health/Wearable, Nutrition, Rehabilitation and Platform Security concept documents. Resolve schema compatibility and entity identifiers before coding.
