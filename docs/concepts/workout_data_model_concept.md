# Concept: Universal Workout Data Model

## 1. Objective

The goal is to develop a flexible system for **storing, displaying, editing, and analyzing workouts across different sports in a consistent way**.

The initial scope includes:

- **CrossFit / Functional Fitness:** AMRAP, EMOM, For Time, strength, Hero WODs, skills, and more.
- **Triathlon:** Swimming, cycling, running, and multisport/brick sessions.
- **Yoga:** Flows, asanas, breathwork, and meditation.
- **HIIT:** Intervals, circuits, Tabata, and work/rest formats.

The central principle is:

> **A workout consists of one or more blocks, and each block describes a training structure.**

This avoids creating a completely separate data model for every sport.

---

## 2. Types of Workouts to Support

### 2.1 CrossFit and Functional Fitness

CrossFit is especially complex because a single workout can combine different training formats.

| Workout format | Description | Example |
|---|---|---|
| For Time | Complete prescribed work as quickly as possible | 21-15-9 thrusters and pull-ups |
| AMRAP | Complete as many rounds/reps as possible within a time limit | 12-minute AMRAP |
| EMOM | Perform a task at the start of every minute | EMOM 10: 5 burpees |
| E2MOM / E3MOM | Perform a task every two or three minutes | 5 deadlifts every 2 minutes |
| Rounds for Time | Finish a specified number of rounds for time | 5 rounds of 3 exercises |
| Chipper | Work through a longer sequence of exercises | 50-40-30-20-10 reps |
| Strength | Strength training using sets, reps, and weight | 5 × 5 back squat |
| Skill | Technical practice | Handstand practice |
| Interval | Work periods separated by planned recovery | 5 × 3 minutes, 1-minute rest |
| Tabata | Standardized work/rest intervals | 8 × 20 seconds on / 10 seconds off |
| Max Effort | Determine maximum performance | 1RM clean |
| Death By | Progressively increasing repetitions | Add 1 burpee each minute |
| Buy-in / Cash-out | Additional work before/after the main segment | 800 m run + AMRAP + 800 m run |

A full CrossFit session may contain multiple formats.

### 2.2 Triathlon and Individual Disciplines

| Discipline | Workout formats | Relevant metrics |
|---|---|---|
| Swimming | Endurance, technique, intervals, pace, CSS | Distance, time, pace/100 m, heart rate, stroke rate |
| Cycling | Base endurance, intervals, FTP, tempo, recovery | Distance, duration, power, cadence, heart rate, elevation gain |
| Running | Easy run, long run, tempo, intervals, recovery | Distance, pace, heart rate, elevation gain, cadence |
| Triathlon | Multisport, brick, race simulation | Sequential disciplines and transition times |

**Example: Bike-to-run brick workout**

1. **Cycling — 60 minutes:** 15-minute warm-up, 3 × 10 minutes at 90% FTP with 5 minutes easy recovery, followed by a cool-down. The exact total duration needs to be reconciled when configuring the block.
2. **Transition — 5 minutes:** Change from cycling to running.
3. **Running — 20 minutes:** 10 minutes easy, then 10 minutes at race pace.

### 2.3 Yoga

Yoga needs different dimensions from conventional fitness sessions.

| Workout format | Description |
|---|---|
| Yoga Flow | A sequence of asanas |
| Vinyasa | Dynamic, breath-led flow |
| Hatha | Individual poses held for a defined time |
| Yin Yoga | Longer holds, commonly several minutes |
| Restorative | Relaxation-focused postures |
| Pranayama | Breathing exercises with defined rhythms |
| Meditation | Time-based mental practice |
| Mobility | Flexibility and stretching routines |

Relevant attributes include pose, hold duration, side (left/right), repetitions, breaths, transitions, and optional props.

### 2.4 HIIT

HIIT can be modeled using interval and repetition structures.

| Workout format | Example |
|---|---|
| Fixed Intervals | 30 seconds work / 30 seconds rest |
| Tabata | 20 seconds work / 10 seconds rest × 8 |
| Circuit | 5 exercises × 4 rounds |
| Pyramid | 20 / 30 / 40 / 30 / 20 seconds |
| Ladder | Progressively increasing or decreasing work |
| Every X Seconds | 10 burpees every 90 seconds |
| Variable Intervals | Different work and rest durations |

---

## 3. Universal Workout Structure

Recommended hierarchy:

```text
Workout
├── Metadata (name, sport, goal, planned duration, etc.)
└── Blocks (ordered)
    ├── Warm-up
    ├── Main workout
    └── Cool-down
        └── Each block has:
            ├── Configuration (format, time, rounds, rest, etc.)
            └── Exercises / Steps
                └── Prescriptions / Targets
```

### Level 1: Workout

Stores general information.

| Attribute | Example |
|---|---|
| `id` | `workout_123` |
| `name` | Monday Engine Builder |
| `sport` | `crossfit` |
| `disciplines` | `strength`, `conditioning` |
| `estimated_duration` | 45 minutes |
| `difficulty` | `intermediate` |
| `tags` | `engine`, `legs`, `endurance` |
| `equipment` | `barbell`, `rower` |
| `description` | Focus on endurance and strength |

### Level 2: Workout Block

A workout can contain any number of blocks. Each block has its own flow and training logic.

Possible **block types**:

- `warmup`
- `strength`
- `skill`
- `conditioning`
- `endurance`
- `interval`
- `mobility`
- `recovery`
- `transition`
- `cooldown`

Each block also needs a **format**, such as `amrap`, `emom`, `for_time`, `sets_reps`, `intervals`, `sequence`, or `continuous`.

This distinction is essential: `conditioning` describes the **purpose**; `amrap` describes the **execution logic**.

### Level 3: Exercise / Step

A block contains activities or exercises, such as back squat, burpee, running, cycling, swimming, downward dog, and plank.

Use a shared activity catalog with sport-specific extensions.

### Level 4: Prescription (Training Target)

A prescription specifies **what the athlete should do**.

| Target | Examples |
|---|---|
| Repetitions | 10 reps, max reps |
| Duration | 30 seconds, 5 minutes |
| Distance | 400 m, 5 km |
| Weight | 80 kg, 70% 1RM |
| Intensity | Zone 2, RPE 7 |
| Pace | 5:00 min/km |
| Power | 220 W, 95% FTP |
| Hold | 60 seconds |
| Breaths | 5 breaths |
| Rest | 90 seconds |

A prescription must support combinations such as `5 reps + 80% 1RM` or `1,000 m + target pace`.

---

## 4. Different Ways to Store a Workout

Beyond workout formats, there are five important **storage representations / lifecycle entities**.

### 4.1 Free-Text Workout

Example: “21-15-9 thrusters and pull-ups. For Time.”

Fast to create and useful for imported workouts, but hard to analyze or execute automatically.

### 4.2 Structured Workout

Blocks, exercises, reps, times, distances, and intensities are stored as structured data objects.

Ideal for timers, workout players, scheduling, and analytics.

### 4.3 Workout Template

A reusable blueprint with optional variables.

Example: “5 × 5 squats at 75% of current 1RM.”

### 4.4 Scheduled Workout

A workout assigned to a date and optionally a training plan, without mutating the original template.

### 4.5 Completed Workout (Session)

Stores what actually happened: completion time, weight, rounds, heart rate, RPE, and notes.

Actual performance should be stored independently from the planned workout.

**Architecture decision:** Templates, scheduled workouts, and completed sessions should be separate entities linked by references. Keep a snapshot of prescribed targets in the session so later template edits do not alter historical results.

---

## 5. Example Data Representations

These JSON examples deliberately simplify the hierarchy. In production, format-specific configuration and steps would live within workout blocks rather than directly on the workout.

### CrossFit — AMRAP

```json
{
  "name": "12-Minute AMRAP",
  "sport": "crossfit",
  "format": "amrap",
  "duration": 720,
  "steps": [
    { "name": "Pull-up", "reps": 5 },
    { "name": "Push-up", "reps": 10 },
    { "name": "Air Squat", "reps": 15 }
  ]
}
```

### CrossFit — Strength

```json
{
  "name": "Back Squat 5 × 5",
  "sport": "crossfit",
  "format": "sets_reps",
  "rounds": 5,
  "steps": [
    {
      "name": "Back Squat",
      "reps": 5,
      "intensity": { "type": "percent_1rm", "value": 75 },
      "rest_seconds": 120
    }
  ]
}
```

### Running — Intervals

```json
{
  "name": "Running Intervals",
  "sport": "running",
  "format": "intervals",
  "rounds": 6,
  "steps": [
    {
      "name": "Run",
      "distance_m": 800,
      "intensity": { "type": "pace", "value": "4:30", "unit": "min/km" }
    },
    { "name": "Recovery Jog", "duration_seconds": 120 }
  ]
}
```

### Triathlon — Brick

```json
{
  "name": "Bike-to-Run Brick",
  "sport": "triathlon",
  "format": "sequence",
  "steps": [
    {
      "name": "Cycling",
      "duration_seconds": 3600,
      "intensity": { "type": "ftp_percent", "value": 80 }
    },
    { "name": "Transition", "duration_seconds": 300 },
    {
      "name": "Running",
      "duration_seconds": 1200,
      "intensity": { "type": "hr_zone", "value": 3 }
    }
  ]
}
```

### Yoga — Flow

```json
{
  "name": "Yoga Morning Flow",
  "sport": "yoga",
  "format": "sequence",
  "steps": [
    { "name": "Downward Dog", "duration_seconds": 60 },
    { "name": "Warrior II", "side": "left", "breaths": 5 },
    { "name": "Warrior II", "side": "right", "breaths": 5 },
    { "name": "Child's Pose", "duration_seconds": 120 }
  ]
}
```

### HIIT — Tabata

```json
{
  "name": "20/10 Tabata",
  "sport": "hiit",
  "format": "intervals",
  "rounds": 8,
  "steps": [
    { "name": "Burpees", "duration_seconds": 20 },
    { "name": "Rest", "duration_seconds": 10 }
  ]
}
```

---

## 6. Technical Requirements

| Principle | Implementation |
|---|---|
| Flexible workouts | Any number of blocks per workout |
| Flexible block structures | Sequences, loops, intervals, nested groups |
| Cross-sport exercises | Shared activity catalog |
| Flexible performance data | Typed metrics with units |
| Planned vs. actual | Separate prescriptions and results |
| Reusability | Templates and workout versions |
| Scaling | RX, scaled, and personalized alternatives |
| Complex time rules | Time caps, rest periods, interval structures |
| Multiple disciplines | Multisport and transition blocks |
| Extensibility | Add sports without replacing the core model |

CrossFit scoring should include time, rounds + reps, load, distance, and total reps. Yoga may emphasize duration, subjective intensity, and mobility rather than competitive scores.

A relational database is a good foundation, for example:

- `workouts`
- `workout_versions`
- `blocks`
- `steps`
- `activities`
- `sessions`
- `session_results`

Store block-specific configurations in **validated, format-typed JSON structures** where appropriate.

---

## 7. Recommended MVP Scope

For the first version, prioritize six **core execution formats** instead of implementing every named workout variation separately.

| Core format | Covers, among other things |
|---|---|
| `for_time` | CrossFit For Time, Rounds for Time, Chipper |
| `amrap` | AMRAP, maximum rounds/reps |
| `repeating_interval` | EMOM, E2MOM, Tabata, HIIT |
| `sets_reps` | Strength, resistance training, technical work |
| `continuous` | Steady-state running, cycling, swimming, meditation |
| `sequence` | Yoga Flow, warm-up, multisport, brick |

Even in the MVP, support generic **groups with repetitions and nesting**. This makes pyramids, complex WODs, and interval sessions with multiple exercises possible.

### Example: Complete Workout

**Monday Hybrid Workout**  
Sport: CrossFit · Strength + Conditioning  
Estimated duration: 50 minutes

1. **Warm-up — Continuous:** 5-minute row, 10 air squats, 10 lunges.
2. **Strength — Sets & Reps:** 5 × 5 back squat at 75% 1RM, 2-minute rest.
3. **Conditioning — AMRAP 12:** 10 burpees, 15 wall balls, 200 m run.
4. **Cool-down — Sequence:** 2-minute couch stretch per side, 2-minute child's pose.

All four sections use different execution formats while belonging to one workout.

---

## 8. Architecture Recommendation

The most important design principle is to **separate sport, training purpose, execution logic, and result**.

This provides a foundation not only for CrossFit, triathlon, yoga, and HIIT, but also for future support of strength training, HYROX, Pilates, calisthenics, and other disciplines.

Recommended next deliverables:

1. A complete, nestable JSON schema for workout definitions.
2. An entity-relationship model for persistent storage.
3. A workout editor specification that displays the appropriate inputs for each selected format.

**Key product decision:** Is the system primarily a workout library, or should athletes also execute workouts in the app with timers, live tracking, and result entry? If execution is in scope, the workout player should influence the data model from the outset.
