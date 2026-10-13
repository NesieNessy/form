# Training-Aware Nutrition & Food Tracking — Product and Technical Concept

**Standalone specification · Version 1.0 · October 2026**  
**Related modules:** Universal Workout Data Model, AI Workout Agents, Health & Wearable Data Integration

## Executive Summary

Build an **opt-in nutrition module** that connects an athlete's nutrition to their training goals, planned workouts, completed sessions, and (where authorized) wearable observations. The system serves two complementary jobs:

1. **Plan and recommend:** generate explainable, individualized food, fueling, and hydration suggestions that vary with sport, training phase, workload, schedule, and dietary preferences.
2. **Track and learn:** log meals, ingredients, drinks, supplements, and training fuel with consistent quantities, nutrient data, timestamps, sources, and uncertainty, then compare actual intake against flexible plans and trends.

The module supports CrossFit/functional fitness, strength sessions, running, cycling, swimming, triathlon/brick sessions, HIIT, yoga, and recovery days. Users can track food without importing health information, and can use health information without enabling automated nutrition recommendations.

**Product boundary:** This is training-oriented wellness support, not a diagnostic or therapeutic nutrition service. Energy expenditure and dietary intake are uncertain estimates. The system must avoid prescriptive advice for eating disorders, pregnancy, children, diabetes management, kidney disease, or other situations needing personalized clinical care; offer qualified professional review instead. Do not make rigid energy deficits, aggressive weight-loss targets, or wearable-derived calorie compensation the default.

---

## 1. Product Goals, Users, and Non-Goals

### Goals

- Track energy, protein, carbohydrate, fat, fiber, fluid, and selected micronutrients accurately enough for actionable everyday use.
- Support low-friction logging: food search, barcode scan, saved meals, recipes, quick entry, manual entry, text parsing, and optionally photo-assisted estimation.
- Adapt nutrition suggestions to **specific workouts** (type, duration, intensity, start time), **training blocks** (base, build, competition, recovery), and explicit athlete goals.
- Present daily/weekly trends, fueling adherence, and practical insights without moralizing food or presenting estimated values as facts.
- Enable optional integrations with Apple Health/HealthKit and approved external nutrition providers; integrate Garmin-derived activity context where access allows.
- Preserve original entries, attribution, correction history, consent, and user control.

### Personas

- **CrossFit athlete:** wants appropriate meal timing and consistent protein intake across strength/metcon days.
- **Triathlete:** needs long-session carbohydrate/fueling and hydration planning across swim/bike/run/brick days.
- **Runner/cyclist/swimmer:** wants support for endurance training and event-day fueling.
- **HIIT athlete:** wants practical intake guidance around intense but often short workouts.
- **Yoga practitioner:** wants regular balanced meals and optional gentle hydration reminders, not unnecessary high-calorie workout fueling.
- **Coach/dietitian (future):** reviews plans and evidence with athlete permission.

### Non-Goals (MVP)

- No disease diagnosis, treatment, insulin dosing, or interpretation of clinical test results.
- No default weight-loss coaching based solely on steps, wearable calories, or a single day's weight.
- No autonomous supplement prescriptions, megadoses, or claims that supplements are required.
- No guaranteed accuracy of photo or restaurant nutrient estimates.

---

## 2. Nutrition Is Driven by Training Context

A nutrition recommendation should use a **context vector** rather than only a static calorie target.

| Context dimension | Example inputs | Product use |
|---|---|---|
| Sport and workout structure | AMRAP, strength sets, 90-min bike, long run, yoga flow | Select fueling pattern and meal timing |
| Session duration and intensity | planned/actual duration, heart-rate zones, power, RPE | Contextual carbohydrate and fluid considerations |
| Training schedule | start time, two-a-day, next session | Meal scheduling and between-session recovery |
| Training phase | base, build, taper, race, rest | Day-to-day nutrition priorities |
| Athlete goals | performance, consistency, muscle gain, general wellbeing | Plan priorities, not automatic medical targets |
| Preferences | vegan, vegetarian, allergies, disliked foods, budget, cuisine | Food selection and substitutions |
| Personal observations | appetite, GI tolerance, fatigue, weight trend if voluntarily tracked | User-confirmed personalization |
| Wearable metrics (optional) | completed sessions, duration, sleep, HR trend | Supporting context only; never authoritative calorie truth |

### 2.1 Sport-specific strategy templates

| Training scenario | Primary nutrition emphasis | Example capabilities |
|---|---|---|
| CrossFit strength | Adequate total intake and protein distributed through the day | Protein distribution prompts; practical pre-/post-training options |
| CrossFit metcon / HIIT | Available carbohydrate when needed, convenient meal timing | Meal suggestions around session timing; do not overfuel short sessions automatically |
| Long run / long ride | Carbohydrate availability, fluids, optional electrolyte strategy | Fueling plan with intervals, tolerance notes, and recorded consumption |
| Swim training | Practical pre-/post-swim meals; pool-session timing | Breakfast timing, between-session meal suggestions |
| Triathlon brick | Multi-hour and multi-discipline fueling | Single cross-discipline fueling plan including transitions |
| Yoga / mobility | Overall dietary quality and hydration without performance-fuel inflation | Balanced-meal suggestions; gentle hydration logging |
| Recovery day | Consistent adequate nutrition and recovery support | No automatic drastic calorie cuts when workout duration decreases |
| Event or race | Individual rehearsal and logistics | Race-day schedule with aid-station and food-tolerance notes |

### 2.2 Recommendation modes

1. **General wellness mode:** habits, meal regularity, food variety, fluids; optional macro tracking.
2. **Performance mode:** training-day carbohydrate strategy, protein distribution, event/session fueling.
3. **Body-composition support (restricted):** opt-in, safety screened, requires adequate fueling safeguards; no extreme targets or automatic deficits.
4. **Professional plan mode (future):** registered dietitian/qualified professional establishes targets, app tracks adherence without silently modifying prescription.

### 2.3 Example training-day fueling plan (illustrative, not individualized advice)

**Example:** 2-hour cycling workout starting at 09:00.

- **Before:** offer breakfast options using athlete preferences and known GI tolerance.
- **During:** configurable carbohydrate/fluid reminders based on the chosen strategy, workout conditions, and established tolerance.
- **After:** present regular meal options that help replace fuel and provide protein and fluid.
- **Record:** what was planned, what was actually consumed, when, and any GI/tolerance notes.

The system must distinguish **recommended**, **planned**, **logged**, and **observed** quantities. Never claim that a plan represents a clinical prescription.

---

## 3. Nutrition Tracking and Logging Experiences

### 3.1 Logging methods

| Method | UX | Reliability considerations |
|---|---|---|
| Food search | Search a curated product/food database and select serving | Require clear brand, portion, locale, and data source |
| Barcode scan | Identify packaged food via barcode lookup | Multiple regional variants; validate label and pack size |
| Recipe builder | Add ingredients, yields, portions, preparation | Cooking yields and nutrient retention affect estimates |
| Saved meal / repeat | One-tap reuse of prior meals | Portions must be editable each time |
| Quick-add | Enter energy and optional macros | Missing macros explicitly remain unknown |
| Natural language | “Oats 80 g with yogurt and berries” | Extract ingredients/weights; ask user to confirm ambiguity |
| Photo-assisted estimate | Suggest possible foods and approximate portions | Never silently record inferred grams or energy |
| Drink logging | Water, beverages, training bottles | Record fluid volume and separate nutrient/electrolyte content |
| Training fuel logging | Gels, chews, bars, sports drink during activity | Associate timestamp and workout/session |
| Imported nutrition | Sync eligible authorized records | Deduplicate by provider-specific identity and provenance |

**Principle:** optimize for *correctable convenience*. Every estimated entry should be reviewable and editable.

### 3.2 Daily tracking dashboard

- Today's meals grouped by breakfast/lunch/dinner/snack/pre-workout/during-workout/post-workout.
- Energy and macro totals; a separate indicator for incomplete or estimated logging.
- Food and fluid totals; optionally caffeine, fiber, sodium, potassium, iron, calcium, vitamins when available.
- Flexible target bands where appropriately configured; avoid treating one-day deviations as failure.
- Training timeline overlay with planned/actual sessions and fueling events.
- Free-text notes: appetite, digestive tolerance, perceived energy, recovery.
- Weekly trends with data-coverage indicator (e.g., 5 of 7 days logged) to avoid misleading averages.

### 3.3 Food, recipe, and measurement requirements

- Support per-100-g, per-100-ml, per-serving and per-item nutrition declarations.
- Maintain canonical units: `g`, `ml`, `kcal`, `kJ`, `mg`, `µg`; store the original unit and conversion source.
- Model edible portion, recipe yield, cooked/raw state, serving count, and optional density.
- Preserve both vendor-label energy and optionally calculated macro energy instead of assuming they are identical.
- Track known allergens as product facts with source and warnings; do not make unsupported allergen-free guarantees.
- Separate zero from `null`/unknown; avoid summing missing nutrients as if measured zero.

---

## 4. Tracking Model: Planned vs. Actual Nutrition

Use the same architecture pattern as `Workout` vs. `WorkoutSession`.

- **NutritionPlan:** intended targets and/or meal schedule over a period; versioned.
- **PlannedMeal / PlannedFuelEvent:** optional concrete scheduled foods and nutrient targets.
- **FoodLogEntry:** what the athlete actually reports consuming; immutable revisions or audit history.
- **DailyNutritionSummary:** calculated projection of logged entries, not the underlying source of truth.
- **WorkoutFuelingPlan:** fueling linked to one workout or multisport session.
- **WorkoutFuelEvent:** planned vs. logged ingestion during the workout, timestamped.

A meal can be linked to a workout without being required to have a workout association. A workout can exist without a nutrition plan. The system must function with missing data.

---

## 5. Data Model and Database Entities

| Entity | Key fields | Notes |
|---|---|---|
| `NutritionProfile` | athlete_id, goals, preferences, unit_system, consent_flags | Dietary restrictions/medical sensitivities require stricter access |
| `FoodItem` | food_id, names, brand, barcode, country, source, version | Normalize regional variants |
| `FoodNutrient` | food_id, nutrient_code, amount, basis, unit, confidence | Per 100 g/100 ml/serving, not just macros |
| `ServingDefinition` | food_id, label, gram_equivalent, ml_equivalent | Portion conversion |
| `Recipe` / `RecipeIngredient` | yield, ingredient_amounts, cooking_method | Version recipes when changed |
| `Meal` / `MealItem` | athlete_id, logged_at, food_id, amount, source | A meal groups log items; portions editable |
| `FoodLogEntry` | id, athlete_id, consumed_at, amount, food_snapshot, status | Preserve original food snapshot for historical consistency |
| `FluidLogEntry` | beverage, volume_ml, timestamp, optional nutrients | Distinct from general food and sports drinks as appropriate |
| `NutritionTarget` | scope/day, energy, protein, carbs, fat, fluid, provenance | Manual / professional / algorithm-derived, optional ranges |
| `NutritionPlan` | id, version, days, goal, approval_status | Draft, active, archived |
| `WorkoutFuelingPlan` | workout_id, schedule, planned totals | Cross-sport and long-session support |
| `FuelingEvent` | workout_session_id, timestamp, item, macros, fluid | Link to actual session |
| `NutritionObservation` | symptom/tolerance/appetite note, timestamp | Voluntary, minimize sensitive data |
| `NutritionImport` | provider, external_id, payload_hash, sync_cursor | Deduplication and traceability |
| `AgentNutritionProposal` | version, reason, inputs, limitations, approval | Human-in-the-loop |

### 5.1 Example: food log entry

```json
{
  "id": "foodlog_001",
  "athlete_id": "athlete_123",
  "meal_type": "breakfast",
  "consumed_at": "2026-10-13T07:30:00+02:00",
  "food": {
    "food_id": "food_oats_001",
    "display_name": "Rolled oats",
    "source": "verified_food_database",
    "source_version": "2026-10"
  },
  "quantity": { "value": 80, "unit": "g" },
  "nutrients": {
    "energy_kcal": 304,
    "protein_g": 10.4,
    "carbohydrate_g": 53.6,
    "fat_g": 5.6,
    "fiber_g": 8.0
  },
  "values_are_illustrative": true,
  "entry_method": "manual_search",
  "quality": "database_estimate",
  "confirmed_by_user": true
}
```

*Numbers in this and subsequent examples are illustrative mock data, not verified nutritional values.*

### 5.2 Example: daily nutrition target

```json
{
  "athlete_id": "athlete_123",
  "date": "2026-10-13",
  "goal": "training_performance",
  "training_context": {
    "planned_session_ids": ["session_plan_bike_004"],
    "day_type": "endurance"
  },
  "targets": {
    "protein_g": { "min": 115, "max": 145 },
    "carbohydrate_g": { "min": 280, "max": 360 },
    "fluid_ml": null,
    "energy_kcal": null
  },
  "status": "proposal",
  "basis": "illustrative_non_clinical_configuration",
  "requires_user_approval": true
}
```

Targets should not be generated without appropriate profile context, and ranges are preferred to false precision.

### 5.3 Example: workout fueling event

```json
{
  "event_id": "fuel_event_018",
  "workout_session_id": "session_bike_004",
  "event_type": "consumed",
  "occurred_at": "2026-10-13T10:05:00+02:00",
  "relative_session_seconds": 3900,
  "item": "sports_drink",
  "consumed": {
    "volume_ml": 500,
    "carbohydrate_g": 30,
    "sodium_mg": 250
  },
  "entry_method": "manual",
  "estimated": true
}
```

---

## 6. Deterministic Nutrition Calculation Engine

Nutrition arithmetic and aggregation are software responsibilities, **not LLM calculations**.

- Convert portion to per-100-g/ml nutrient values with unit-aware formulas.
- Calculate recipes from ingredients, edible yields and declared servings.
- Calculate daily totals from deduplicated, confirmed log entries; avoid double-counting full meal imports and individual food components.
- Calculate `logged_macro_total`, `planned_macro_total`, `observed_training_activity`, and `logging_coverage` separately.
- Maintain an uncertainty flag for estimated portions and incomplete nutrient data.
- Expose calculated metrics through typed APIs to the AI layer.

### Energy expenditure caveats

Wearable calorie expenditure is an **estimate**. Do not automatically set `nutrition_target = baseline_target + device_active_calories`, especially when multiple devices or activity sources may double-count activity. Use bounded, explainable adjustments only when enabled, with user review and periodic calibration against longer-term trends, not a single day.

### Goals and safety controls

- Avoid automatically recommending large deficits or "earning" food via exercise.
- Recognize that sustained low energy availability can impair health and performance; do not diagnose relative energy deficiency in sport (REDs) from food logs alone.
- No universally safe single-number calorie recommendation can be inferred from wearable measurements alone.
- Allow the user to hide calories or body-weight metrics while still tracking meals, protein or hydration.
- Do not penalize missing days; make goal adherence optional and non-judgmental.

---

## 7. Nutrition AI Capabilities and Agent Architecture

Recommend a **Nutrition Intelligence capability group** that reuses the existing orchestration layer rather than another isolated agent ecosystem.

### 7.1 Nutrition Logging / Parsing Agent — P0

**Purpose:** Convert food notes or supported images into editable food-log drafts.

**Input:** text, photo, food selection, portion hints, meal time.  
**Tools:** `searchFoods`, `lookupBarcode`, `resolveServing`, `parseMeal`, `createFoodLogDraft`, `validateFoodLog`.  
**Output:** candidate foods, quantities, nutrient provenance, uncertainty flags, draft awaiting confirmation.

**Example input:** “Greek yogurt with a banana and a handful of walnuts.”  
**Behavior:** identify three ingredients; propose editable serving sizes; do not invent certainty about yogurt brand, walnut weight, or fat content.

### 7.2 Training-Aware Nutrition Planning Agent — P1

**Purpose:** Propose nutritional priorities or a meal/fueling plan matched to workouts and stated preferences.

**Input:** planned workouts, available times, goals, food preferences, manually confirmed relevant athlete information.  
**Tools:** `getTrainingPlan`, `getWorkoutDetails`, `getNutritionPreferences`, `getFoodCatalog`, `calculateNutritionTargets`, `createNutritionPlanDraft`, `validateNutritionPlan`.  
**Output:** optional macro ranges, meal/fuel timing, meal suggestions, rationale, assumptions and a draft plan.

**Important:** the recommendation engine should use configurable evidence-reviewed rules for baseline estimates; the LLM expresses, assembles and explains options but does not invent quantitative targets.

### 7.3 Session Fueling Agent — P1

**Purpose:** Prepare food/drink timing for longer or demanding sessions, including triathlon races and bricks.

**Input:** workout duration, intensity, climate information if available, tolerances, food availability, event logistics.  
**Tools:** `getWorkout`, `getFuelingPreferences`, `getFuelProducts`, `buildFuelingSchedule`, `validateFuelingPlan`.  
**Output:** proposed pre-/during-/post-session fueling events, packaging counts, reminders and tracking fields.

Do not prescribe untested race-day carbohydrate amounts or electrolyte plans as universally appropriate. Let athletes log GI responses and rehearse strategies during training.

### 7.4 Nutrition Analysis Agent — P2

**Purpose:** Explain longitudinal nutrition and training patterns.

**Input:** authorized nutrition summaries, logging coverage, workouts/sessions and relevant permitted health observations.  
**Tools:** `getNutritionSummaries`, `getTrainingHistory`, `calculateAdherenceTrends`, `compareTrainingDays`, `getHealthBaselines`.  
**Output:** sourced insights with time window, observations, limitations, no unsupported causal conclusions.

**Example insight:** “On three of your four long-ride days you recorded no during-session fuel. This may reflect missing logging rather than missing intake. Would you like to review those rides?”

### 7.5 Shared Nutrition Validation Service — P0

Check schema; timestamps; valid units; product and serving identity; macro values; allergens when properly sourced; recipe yields; cross-link references; improbable quantities; duplicate imports. Flag ambiguity and unverified image estimates. The deterministic service controls whether data can be persisted.

### 7.6 Relationship to existing workout agents

| Existing capability | Nutrition integration |
|---|---|
| Workout Import | Attach food/fuel notes as structured supplements to workout metadata, with confirmation |
| Workout Adaptation | Show nutrition implications when intensity/duration changes; never silently alter logged meals |
| Workout Generation | Provide workout timing and duration to Nutrition Planning; avoid coupling generation to diet compliance |
| Training Planning | Propose aligned weekly meal/fueling schedules with meal-prep considerations |
| Workout Analysis | Compare nutrition logging and performance conservatively; avoid causal claims from sparse data |
| Workout Validation | Verify workout–fuel links and session identities; defer nutrient math to Nutrition Engine |

---

## 8. Wearable and Health Data Integration

### Data flow

```text
Apple Health / approved Garmin activity connector / manual workout logs
                                 |
                                 v
                Workout + Health Normalization Layer
                                 |
                                 v
                         Training Context
                                 |
 Food search / barcode / manual / photo -> Food Logging -> Nutrition Engine
                                 |                 |
                                 +--------+--------+
                                          v
                             Nutrition Context API
                                          |
                                          v
                   Nutrition AI Drafts + User Confirmation
                                          |
                                          v
                     Versioned Plans / Confirmed Food Logs
```

### Provider boundaries

**Apple Health/HealthKit:** Apple supports permissioned dietary intake types such as energy, protein, carbohydrate, fat, water, caffeine and selected vitamins/minerals. Actual read/write access is controlled by the user and available device/app data. Apple Watch does not imply that meals or macro nutrients are recorded automatically. The iOS application mediates HealthKit access; the backend cannot simply access a user's Apple Health database as a generic cloud API.

**Garmin:** Use approved Garmin integrations for eligible exercise/activity and wellness context. Do not assume Garmin Connect provides a general public full meal database or detailed dietary intake API. If user-authorized nutrition import is unavailable, keep Garmin as **training context** and use a separate food logger.

**Third-party nutrition services:** Support import/export through official APIs or user-owned files where agreements and formats permit. Map provider IDs, nutrient taxonomy, timestamps, time zones, serving sizes and deletion events. Verify scopes and allowed downstream use before implementation.

### Deduplication and provenance

- Use `(provider, provider_account, external_record_id, revision)` where supplied.
- Detect possible cross-provider duplicate meals conservatively; ask user before merging ambiguous records.
- Retain source names, original units, import time, confidence and any manually modified overrides.
- On disconnect, stop future syncing; offer clear retention/deletion choices according to policy.
- Never combine two sources' "total energy" without detecting potential duplication.

---

## 9. User Journeys and UX Requirements

### Journey A — Everyday logging

1. User searches for a food or describes a meal.
2. App shows serving selection and estimated nutrients.
3. User corrects and confirms a log entry.
4. Daily totals and completeness update deterministically.
5. App may show a non-judgmental, optional relevant insight.

### Journey B — Training-aware meal planning

1. User selects a goal and available food preferences.
2. App reads the authorized upcoming workout schedule.
3. Planner proposes meal ideas with timings and editable portion targets.
4. User approves the plan or rejects/adjusts individual meals.
5. Logged intake stays distinct from planned meals; actual use is never assumed.

### Journey C — Long-session fueling

1. A 3-hour ride is planned.
2. User chooses among proposed and previously tolerated fueling patterns.
3. A session plan generates time-based fuel reminders/targets.
4. User logs consumed drinks, gels or foods during/after the ride.
5. App shows planned vs. recorded consumption and invites a tolerance note.

### Journey D — Progress review

1. Athlete opens weekly nutrition overview.
2. App shows logging completeness, average nutrients over logged days and session alignment.
3. Analysis Agent explains trends with source labels and uncertainty.
4. Athlete chooses whether to adjust a future plan; no automatic changes to historical records.

### UX preferences

- Allow full manual entry and export, even without wearables or AI.
- Offer optional calorie-free view and pauseable reminders.
- Food choice and habit messaging should be neutral, not punitive.
- Accessibility: metric/imperial units, local food labels, time zones, languages, screen-reader support.
- Provide allergen and dietary restriction controls with disclaimers for database incompleteness.

---

## 10. API Contract Sketch

| Endpoint (illustrative) | Method | Purpose |
|---|---|---|
| `/v1/foods/search` | GET | Search reference foods and products |
| `/v1/foods/barcode/{code}` | GET | Product lookup if catalog supports it |
| `/v1/nutrition/logs` | POST | Create confirmed food/drink entry |
| `/v1/nutrition/logs/{id}` | PATCH | Correct an existing entry with revision history |
| `/v1/nutrition/days/{date}` | GET | Summaries, log coverage and targets |
| `/v1/nutrition/plans` | POST | Create approved nutrition plan or draft |
| `/v1/nutrition/plans/{id}/approve` | POST | Explicitly activate a draft |
| `/v1/workouts/{id}/fueling-plan` | POST | Propose workout-linked fueling |
| `/v1/nutrition/imports` | POST | Import provider/file nutrition records |
| `/v1/nutrition/insights` | GET | Query traceable insights |

### Example: propose a nutrition plan

```json
{
  "request_id": "req_009",
  "intent": "nutrition_plan_proposal",
  "athlete_id": "athlete_123",
  "period": { "start": "2026-10-19", "days": 7 },
  "goal": "support_triathlon_training",
  "constraints": {
    "diet": "vegetarian",
    "allergens": ["peanut"],
    "max_prep_minutes": 25
  },
  "authorized_context": {
    "training_plan_id": "plan_tri_001",
    "wearable_data_scope": "training_sessions_only"
  }
}
```

**Expected response:** `draft_id`, proposed plan, assumption list, warnings, validation report, `requires_user_approval=true`. Do not persist a finalized plan before approval.

---

## 11. Privacy, Security, and Safety

- **Opt-in processing:** separate permissions for food tracking, nutrition personalization, wearable context, and optional AI analysis.
- **Data minimization:** share only scoped fields with AI tools, not raw physiological series by default.
- **Sensitive information:** allergens, disordered-eating disclosures, weight trends and health-related notes require stronger privacy controls; avoid unnecessary collection.
- **Deletion/export:** provide access, portability, correction and deletion workflows; map provider-specific obligations and applicable law (including GDPR where relevant).
- **Security:** encryption in transit/at rest, tenant isolation, role-based authorization, audited provider tokens, retention schedules, idempotent sync.
- **Human agency:** all proposed nutrition plan changes are drafts; confirmed food entries only reflect user-reported consumption.
- **Escalation:** when a user raises potential clinical nutrition needs or dangerous restriction, recommend appropriate qualified support instead of automated dieting.
- **Supplements:** track product and dose as user-reported data without equating logging with endorsement or prescribing.
- **Minors:** require a separate age-appropriate product and policy assessment; adult-oriented performance/body-composition recommendations are not the default.

### Safety policy examples

| Situation | Agent behavior |
|---|---|
| Incomplete logs | Say intake is unknown; never conclude the athlete ate nothing |
| Device indicates unusually high calories | Treat as estimate; no one-for-one automatic calorie target increase |
| Athlete asks for extreme restriction | Do not generate extreme plan; suggest safer professional support |
| Suspected under-fueling | Give a cautious, non-diagnostic observation with transparent uncertainty |
| User reports diabetes/kidney disease/pregnancy | Avoid prescriptive macros; direct toward clinically appropriate individualized guidance |
| Photo shows ambiguous food | Produce editable candidate matches, not confident exact nutrition figures |

---

## 12. Delivery Roadmap and Priorities

### Phase 0 — Foundations (P0)

- Canonical food catalog and nutrient/serving normalization.
- Meal, food, recipe and fluid log schema; activity-linked fuel logging.
- Food search, manual logging, saved meals, daily summaries.
- Deterministic validators, calculations, clear provenance, privacy controls.

**Exit criterion:** athlete can log a full day, correct entries, track hydration and export entries accurately without any AI or wearable integration.

### Phase 1 — AI Logging and Training Context (P1)

- Natural-language meal parser returning drafts.
- Optional barcode and photo-assisted logging where data quality is adequate.
- Link planned/completed workouts from the Workout Core.
- Basic training-day priorities (strength, endurance, recovery) without automatic extreme numeric targets.

**Exit criterion:** nutrition logs can be associated with workouts; AI-drafted logs require user confirmation and produce the same totals as manual entries.

### Phase 2 — Fueling and Planning (P1/P2)

- Training-aware weekly nutrition plan drafts.
- Pre-/during-/post-session fueling event planning and logging.
- Event-day support, athlete GI tolerance notes, reusable meal plans.
- Optional authorized Apple Health dietary data exchange; approved third-party imports as feasible.

**Exit criterion:** athlete can approve a fueling plan, track actual consumption for a multisport session, and review plan-vs-actual.

### Phase 3 — Insights and Professional Collaboration (P2/P3)

- Longitudinal adherence analysis with logging coverage.
- Training–nutrition comparative insights with documented uncertainty.
- Coach/dietitian permissions, feedback, clinician-configured targets when appropriate.
- Advanced interoperability and user-driven data exports.

**Exit criterion:** every actionable insight identifies its supporting time window, input sources, and limitations.

### Qualitative prioritization

| Feature | Athlete value | Complexity | Priority |
|---|---|---|---|
| Manual food, drink and macro tracking | Very high | Medium | P0 |
| Food catalog + recipe engine | Very high | Medium-high | P0 |
| Workout-linked fuel events | High | Medium | P0/P1 |
| Natural-language meal draft | High | Medium | P1 |
| Barcode scanning | High | Medium | P1 |
| Training-aware nutrition suggestions | Very high | Medium-high | P1 |
| Photo-assisted portion estimate | Medium-high | High | P2 |
| Full weekly meal planning | High | High | P2 |
| Longitudinal nutrition insights | High | High | P2 |
| Registered dietitian collaboration | Contextual | High | P3 |

---

## 13. Test Plan and Acceptance Criteria

1. **Unit accuracy:** grams vs. milligrams vs. milliliters; per-serving vs. per-100-g; kcal vs. kJ.
2. **Completeness:** missing macros are `null`; no manufactured zeros.
3. **Revisions:** editing one food entry updates totals and retains provenance.
4. **Deduplication:** double-importing same record does not double-count totals.
5. **Timezone boundaries:** late-night and travel meal timestamps resolve to intended local days.
6. **Recipe calculations:** quantity scaling and multiple portions are deterministic.
7. **Workout alignment:** recorded fuel links to the correct session and relative timing.
8. **AI evaluation:** food identification accuracy, quantity uncertainty, candidate recall, hallucinated-ingredient rate.
9. **Safety evaluation:** extreme dieting requests, medical contexts, missing data, calorie-free mode and eating-disorder-sensitive phrasing.
10. **Privacy:** revoke permissions, sync stop, delete and export tests.
11. **Usability:** median time-to-log and correction rate; no reliance on a single logging method.
12. **Explainability:** every plan contains assumptions, source of targets, and approval status.

---

## 14. Reference Architecture and Evidence Notes

Nutrition suggestions should be built from a maintained, professionally reviewed rule base, not free-form model improvisation. For healthy exercising adults, sports-nutrition literature supports varying protein and carbohydrate needs with training demands, while emphasizing adequate energy availability. Exact needs are personal and context dependent, especially for race fueling, heat, GI tolerance and clinical conditions.

**Selected references (for product design; not individualized prescriptions):**

1. Apple Developer Documentation — [HealthKit Nutrition Type Identifiers](https://developer.apple.com/documentation/healthkit/nutrition-type-identifiers) (dietary energy, macronutrients, water/caffeine and micronutrient types).
2. International Society of Sports Nutrition — [Position stand: protein and exercise](https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/) (general protein evidence for healthy exercising adults).
3. International Olympic Committee — [2023 consensus statement on Relative Energy Deficiency in Sport](https://bjsm.bmj.com/content/57/17/1073) (importance of adequate energy availability and REDs cautions).
4. [USDA FoodData Central](https://fdc.nal.usda.gov/) — potential reference-food data source; assess API, data license, coverage and locale before choosing production providers.

**Implementation note:** Provider API access, terms, per-device metric availability, and regulations must be verified during implementation. No single provider should be assumed to supply every food, meal, training, or wearable metric.

---

## 15. Final Architecture Recommendation

Build **Nutrition Core** as a first-class module adjacent to Workout Core and Health Core, with:

- a **food and recipe catalog**,
- a **confirmed intake ledger**,
- a **deterministic nutrient and summary engine**,
- a **training-aware planning and fueling service**,
- and an **optional AI layer** for parsing, personalized drafts and explainable analysis.

Use one shared athlete identity, scoped permissions, stable links to workout plans and sessions, and clear separation of **intended intake**, **logged intake**, and **estimated energy expenditure**.

**Recommended product sequence:** first make food and hydration tracking reliable; then link training context; then add AI-assisted meal entry; finally add more sophisticated fueling plans and longitudinal insights. This delivers immediate tracking value without making safe nutrition guidance dependent on AI or wearables.
