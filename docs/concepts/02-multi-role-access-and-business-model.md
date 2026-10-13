# Multi-Role Operating Model, Tenancy, Permissions and Business Workflows

## 1. Four user audiences

### Athlete
- Own account; configure goals, workouts, diet, wearables, rehab context and sharing permissions.
- View which individual or organization can access each data category; revoke and export where legally appropriate.
- Receive and accept/reject proposed changes; keep personal logs separate from professional assessments.

### Coach
- Personal programming library, roster, workouts, schedules, assigned sessions, performance review, comments, messaging.
- Invite athletes; only see scopes granted to the coaching relationship; cannot independently expand sharing.
- Optional teams, coach-to-coach collaboration, planned vs actual reporting, standardized goal review.

### Physiotherapist
- Scoped intake, rehab cases, prescribed exercises, symptom diaries, review checkpoints and return-to-training coordination.
- Care notes and exercise restrictions carry author attribution, version and appropriate access boundaries.
- Clinical sign-off is a human decision and should not be fabricated by AI.

### Training studio
- Multiple facilities, staff, groups, class timetables, memberships, attendance, exercise programming and equipment/room resource management.
- Managers see class attendance and billing status by default, **not** members' HRV, injuries, diet or detailed medical information.
- Coaches working at the studio only inherit scoped operational privileges, not blanket private athlete data access.

## 2. Tenant and identity modeling

Use a global identity (`user_id`) plus memberships in one or more organizations. Athlete accounts persist when changing a coach, studio or clinic. `organization_id` is required for organization-owned resources, but personal measurement tables must not become studio-owned just because a user joins a studio.

Supported relationships:

```text
User 1---N OrganizationMembership N---1 Organization
User 1---N AthleteProfessionalRelationship N---1 ProfessionalUser
Athlete 1---N DataShareGrant N---1 Recipient (person or organization)
Organization 1---N Facility 1---N ClassSession
Coach 1---N WorkoutAssignment N---1 Athlete
Physio 1---N RehabCaseAuthorization N---1 RehabCase
```

Design for multiple simultaneous coaches, one athlete belonging to multiple gyms, physiotherapists in separate clinics, and the same person acting as athlete and coach.

## 3. Role hierarchy and permissions

**Roles are not data permissions.** Use RBAC for broad capability classes, plus ABAC / relationship-based checks for the specific athlete, purpose and consent.

| Role | Scheduling/classes | Assign training | View training outcomes | View nutrition | View health observations | Edit rehab program |
|---|---|---|---|---|---|---|
| Athlete (self) | Personal schedule | Self | Self | Self | Self | Self-log only; professional prescriptions protected |
| Independent coach | Own clients | Granted clients | Granted subset | Explicit extra grant | Explicit extra grant | No, unless separately authorized qualified role |
| Physiotherapist | Own care calendar | Rehab only as permitted | Limited clinical relevance | Explicit extra grant | Explicit extra grant | Granted cases, human authorization |
| Studio instructor | Assigned classes | Class content | Attendee completion only if shared | No by default | No by default | No |
| Studio manager | Facility-wide | Studio templates | Operational aggregate / consented client view | No by default | No by default | No |
| Platform operator | Operational metadata | No | No by default | No by default | No by default | No |

All authorization must occur in the backend and at the data-query level, not merely in the user interface. Include tenant isolation tests and negative access tests.

## 4. Consent and sharing contract

Example grant:

```json
{
  "grant_id": "grant_91",
  "athlete_id": "ath_42",
  "recipient": {"type": "user", "id": "coach_8"},
  "purpose": "training_coaching",
  "data_categories": ["workout_plan", "workout_session", "performance_summary"],
  "actions": ["read", "comment"],
  "effective_from": "2026-10-13T00:00:00Z",
  "expires_at": "2027-01-13T00:00:00Z",
  "status": "active",
  "revocable": true
}
```

Distinct categories: workout plans, session logs, wearable raw data, wearable summaries, diet/food logs, nutrition targets, injury/rehab records, video, communications, professional notes. Grouped consent should be understandable and not misleading; sensitive categories need deliberate user action. Log consent version and withdrawal events.

## 5. Primary workflows

1. **Invite/accept coach:** coach sends invite -> athlete accepts relationship -> sees optional data-sharing checklist -> coach receives only the allowed views.
2. **Assign workout:** coach drafts -> athlete notified -> workout becomes scheduled -> athlete logs actual session -> coach reviews shared outcome.
3. **Physio coordination:** athlete invites therapist -> case-scoped data agreement -> therapist publishes prescribed rehab plan -> athlete tracks -> therapist reviews and signs off on case-specific changes.
4. **Studio class:** admin creates class -> member books -> instructor sees operational attendance -> attendance recorded -> no automatic disclosure of private medical data.
5. **Joint care:** athlete may explicitly permit a coach to see a therapist-defined *functional restriction* (e.g., “avoid overhead loading until reviewed”) without exposing diagnosis or treatment notes.
6. **Relationship termination:** remove future access, archive assignments according to applicable retention policies, notify affected stakeholders, record audit event.

## 6. Multi-organization conflicts

If a studio coach also coaches the athlete privately, separate professional relationships and grants. If a member leaves a gym, their personal training history remains available to them; the organization keeps only the operational records it is permitted or required to retain. Document responsibilities before launch.

## 7. Business model options

- **Athlete:** free logging tier; paid intelligence, integrations or advanced analytics.
- **Independent coach:** paid seat + active coached athlete capacity, templates and progress review.
- **Physio/clinic:** practitioner seats + protected rehab workflows, document review and clinic-specific retention controls.
- **Studio:** per-location base fee + staff seats or attendance/class volume, optionally with training programming upgrades.
- **B2B2C:** studio provides a benefit while an athlete retains a personal account and granular data choices.

Pricing must not require surrendering sensitive health data. Operational analytics should favor aggregates and minimum group sizes to prevent reidentification.

## 8. Professional safety and trust

- Establish verification for credentials where professional claims are shown publicly or clinical tooling is enabled.
- Maintain provenance of professional instructions, review dates and responsible clinicians.
- Document response/notification expectations; the platform is not an emergency or continuous clinical-monitoring service by default.
- Expose distinct athlete, coach, therapist and studio UIs; don't use one overloaded permission screen.
- Decide retention, legal basis, controller and processor roles by region and organization type with counsel.

## 9. Acceptance tests

- Studio manager cannot read member sleep, HRV, injury notes or meals absent explicit authorization.
- Revoked coach can no longer fetch a previously accessible session via direct ID.
- Coach A cannot see Coach B's athlete through guessed object identifiers.
- Therapist note visibility is limited to declared professional context.
- Athlete switching studio retains personal account and personal workout history.
- All sensitive reads by a professional generate an auditable record without leaking data into logs.
