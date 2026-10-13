# Stage 3 — AI Coaching & Feedback Agent

## Objective

Provide a conversational interface that safely orchestrates the existing Workout Import, Adaptation, Generation, Planning, Analysis, Recovery, Nutrition and Rehab support capabilities. The agent is a coordinator and explainer, not an all-powerful decision maker or licensed clinician.

## Experiences by role

- **Athlete:** ask training questions, summarize progress, request workout changes, log meals, explain recovery context, obtain suggestions and approve drafts.
- **Coach:** ask for permitted athlete session summaries, create draft microcycles, prepare feedback, assign approved workouts and review athlete questions.
- **Physiotherapist:** summarize authorized rehab logs, draft adherence reports, identify entries needing human review; cannot issue unreviewed medical clearance.
- **Studio:** draft class programs, instructor notes and anonymized class-level reports; cannot retrieve private member health by default.

## Agent roles and routing

Use one orchestration service with modular tools. Map intents to capabilities:

| Intent | Tool family | Confirmation |
|---|---|---|
| “What did I do last week?” | Read session summary | None |
| “Make this EMOM equipment-free” | Adaptation draft | Confirm save/assign |
| “Create a 30-minute workout” | Generation draft | Confirm save/assign |
| “Move Thursday workout” | Scheduling | Confirm calendar write |
| “Why was this session hard?” | Analysis + recovery (if consented) | Read-only interpretation |
| “How should I fuel tomorrow's ride?” | Nutrition suggestion | User choice; no clinical claims |
| “Can I train through this injury?” | Rehab boundaries | Decline to clear medically; route professional review |

## Orchestration states

`received -> authenticated -> intent_classified -> authorized_context_retrieved -> tools_called -> output_validated -> proposed -> approved/rejected -> committed -> audited`.

Unknown intent or ambiguous permissions => ask a targeted question or provide a limited read-only response. Separate instructions from retrieved user data; treat files, OCR results and tool outputs as untrusted content to reduce prompt injection risk.

## Tool security

- Tool tokens scoped to active user, organization, relationship, purpose and action.
- Read tools return the minimum required fields with provenance; avoid dumping complete medical histories into a prompt.
- High-impact writes require confirmation through the app with a visible diff of planned changes.
- No direct SQL, unrestricted file systems, full database browse, cloud credentials, arbitrary HTTP requests or cross-tenant discovery tools.
- Log tool inputs and results with sensitive fields redacted or access-controlled; define retention.

## Example workflow

Athlete: “I missed today's threshold run and have only 25 minutes tomorrow.”  
Agent: retrieves shared calendar, current training plan and restrictions -> calls planning/adaptation service -> drafts two options -> states training impact in plain language -> user selects -> app commits scheduled change -> coach notified only if authorized.

## Suggested response contract

```json
{
  "conversation_id": "conv_123",
  "intent": "reschedule_training",
  "answer": "Two options are available for tomorrow.",
  "citations": [{"entity_type": "scheduled_workout", "entity_id": "sw_21"}],
  "proposals": [{"proposal_id": "prop_88", "type": "calendar_change"}],
  "warnings": [],
  "requires_approval": true
}
```

## Persistent memory policy

Persist explicit athlete preferences only with appropriate product disclosure and controls. Separate conversational memory from health record storage. Do not reuse private client conversations to train organization-wide models without a separate valid basis and agreement. Support deletion/retention and per-organization policy boundaries.

## AI evaluation

Test answer grounding, hallucinated exercises, tool permission bypass, cross-tenant leakage, injection from workout descriptions, unsafe rehab advice, quality of clarifying questions, inappropriate overconfidence, latency, cost and handoff fidelity.

## MVP deliverables

Athlete coach chat, tool gateway, workout draft actions, workout/session explanation, optional coach handoff, approval UI, complete action audit, standardized sources and refusals.

## Acceptance criteria

- Read-only questions do not cause persistent data writes.
- Agent cannot fetch health records on behalf of a studio manager without the required grant.
- User sees a proposed schedule diff before it is committed.
- Rehab escalation routes to human professional review rather than auto-clearance.
- Session answer links to source workouts/observations and indicates when data are stale.
