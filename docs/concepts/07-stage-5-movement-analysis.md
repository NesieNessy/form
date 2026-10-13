# Stage 5 — Movement & Technique Analysis Agent

## Objective

Enable optional analysis of exercise videos for coaching-oriented form observations and collaborative reviews. Limit claims to what is visible and measurable; do not present video inference as injury diagnosis, medical clearance, or certified motion capture.

## Supported MVP contexts

Start with a narrow set of movements, fixed camera guidance and quality checks (e.g., bodyweight squat from side/front views, simple mobility sequences). Expand later to barbell lifts, running form, yoga pose sequences and multi-angle motion, with separate evaluations for each motion and viewpoint.

## Roles and experiences

- **Athlete:** record/upload clip, choose movement and consent scope, receive bounded form observations, annotate and request coach/physio review.
- **Coach:** comment with timestamp/frames, annotate suggested cues, compare clips over time with athlete consent.
- **Physiotherapist:** may review shared footage in rehab context, but AI does not prescribe therapy or certify return to activity.
- **Studio:** optional in-class filming governed by participant consent and privacy policies; membership alone does not enable filming or video reuse.

## Video processing architecture

```text
Explicit upload/consent
 -> Signed secure media upload
 -> Malware / content / file validation
 -> Transcoding and quality assessment
 -> Movement identification and landmark estimation
 -> Task-specific feature generation
 -> Rule/model interpretation with uncertainty
 -> Human-review-optional draft
 -> Athlete-visible feedback and source clip references
 -> Retention expiry / deletion workflow
```

Treat uncertain landmark estimates, occlusion and camera perspective as critical quality constraints. Never generate precise joint angles from unsuitable footage without uncertainty; do not imply causal injury risk from a single clip.

## Suggested record

```json
{
  "analysis_id": "ma_122",
  "athlete_id": "ath_42",
  "movement_id": "bodyweight_squat",
  "video_asset_id": "vid_52",
  "camera_view": "side",
  "quality": {"usable": true, "limitations": ["partial_heel_occlusion"]},
  "observations": [
    {"label": "depth_consistency", "summary": "Varies across repetitions", "confidence": "moderate", "timestamps_seconds": [4.2, 7.9]}
  ],
  "diagnosis": null,
  "professional_review_status": "not_requested"
}
```

## AI agent tools

`checkVideoConsent`, `getMovementProtocol`, `createUploadSession`, `assessVideoQuality`, `extractMotionFeatures`, `generateBoundedObservation`, `requestCoachReview`, `requestPhysioReview`, `attachApprovedFeedback`, `deleteVideoAsset`.

## Security and privacy

- Explicit and clear recording/sharing consent; special rules for third parties appearing in footage.
- Signed time-limited upload/download URLs; encrypted storage; minimal previews.
- Separate permission for model inference, professional sharing and optional research/training use.
- Default limited retention with configurable review period; deletion propagation to derived artifacts according to a defined policy.
- Human footage must not appear in organization-wide demo datasets or AI training by default.
- Enforce per-asset access checks and prevent predictable media URLs.

## Evaluation and clinical boundaries

Build annotated test sets stratified by body variation, camera quality, clothing, lighting, mobility and movement style. Evaluate observation validity, false alarms, inter-rater agreement with qualified professionals, robustness to occlusion and representation bias. Clinical features require their own validation and regulatory review.

## MVP outputs

Upload flow, two camera-guide templates, clip scrubber, limited feedback vocabulary, timestamped annotations, coach request, manual professional notes and safe deletion. Avoid live corrective feedback or automated injury predictions at launch.

## Acceptance tests

- No inference runs before required processing authorization.
- Low-quality clips produce “cannot assess reliably” rather than confident feedback.
- Coach without video grant cannot open a direct asset URL.
- Professional annotations are attributed to the professional and never passed off as AI-generated.
- Revoked sharing prevents subsequent video viewing by former recipients.
- No model output asserts diagnosis, future injury probability or return-to-play clearance.
