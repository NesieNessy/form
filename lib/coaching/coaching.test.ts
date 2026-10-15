import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { newUuid } from '../id';
import type { RosterRow } from '../sharing/api';
import { exerciseSteps, withFreshIds, type WorkoutContent } from '../workout/model';
import { rosterNotes, sortRoster } from './roster';

const NOW = Date.UTC(2026, 9, 14, 12);
const row = (patch: Partial<RosterRow>): RosterRow => ({
  relationship_id: 'r',
  athlete_id: 'a',
  athlete_name: 'Alex',
  relationship_type: 'training_coach',
  granted: [],
  pending_assignments: 0,
  declined_assignments_28d: 0,
  summary: null,
  ...patch,
});

describe('roster notes', () => {
  it('says nothing about training when no summary is shared', () => {
    assert.deepEqual(rosterNotes(row({}), NOW), [{ text: 'Does not share a training summary', tone: 'info' }]);
  });

  it('points out a long gap and a low share of planned workouts done', () => {
    const notes = rosterNotes(
      row({ summary: { sessions_7d: 0, sessions_28d: 2, planned_28d: 8, planned_done_28d: 2, last_session_at: new Date(NOW - 10 * 86_400_000).toISOString() }, declined_assignments_28d: 1 }),
      NOW
    );
    assert.deepEqual(notes.map((n) => [n.text, n.tone]), [
      ['No session in 10 days', 'attention'],
      ['2 of 8 planned workouts done (28 days)', 'attention'],
      ['Declined 1 in the last 28 days', 'attention'],
    ]);
  });

  it('reports a steady week plainly and lists who needs a look first', () => {
    const steady = row({ athlete_name: 'Bea', summary: { sessions_7d: 3, sessions_28d: 12, planned_28d: 12, planned_done_28d: 11, last_session_at: new Date(NOW - 86_400_000).toISOString() }, pending_assignments: 1 });
    assert.deepEqual(rosterNotes(steady, NOW).map((n) => n.text), ['3 sessions in the last 7 days', '11 of 12 planned workouts done (28 days)', '1 sent workout not answered yet']);
    const quiet = row({ athlete_name: 'Zed', summary: { sessions_7d: 0, sessions_28d: 0, planned_28d: 0, planned_done_28d: 0, last_session_at: new Date(NOW - 20 * 86_400_000).toISOString() } });
    assert.deepEqual(sortRoster([steady, quiet, row({ athlete_name: 'Ann' })], NOW).map((r) => r.athlete_name), ['Zed', 'Ann', 'Bea']);
  });
});

describe('copying a workout from a coach', () => {
  it('gives every block and step a new id and changes nothing else', () => {
    const original: WorkoutContent = {
      title: 'Copy me',
      sport: 'crossfit',
      blocks: [
        {
          id: newUuid(),
          type: 'conditioning',
          config: { format: 'for_time', rounds: 3 },
          steps: [
            { kind: 'group', id: newUuid(), rounds: 2, steps: [{ kind: 'exercise', id: newUuid(), name: 'Burpee', activityId: 'burpee', prescription: { reps: 10 } }] },
            { kind: 'rest', id: newUuid(), durationSeconds: 60 },
          ],
        },
      ],
    };
    const copy = withFreshIds(original, newUuid);
    const ids = (c: WorkoutContent) => {
      const out: string[] = [];
      const walk = (steps: WorkoutContent['blocks'][0]['steps']) => steps.forEach((s) => (out.push(s.id), s.kind === 'group' && walk(s.steps)));
      c.blocks.forEach((b) => (out.push(b.id), walk(b.steps)));
      return out;
    };
    assert.equal(ids(copy).length, 4);
    assert.equal(ids(copy).filter((id) => ids(original).includes(id)).length, 0);
    const strip = (c: WorkoutContent) => JSON.parse(JSON.stringify(c, (k, v) => (k === 'id' ? undefined : v)));
    assert.deepEqual(strip(copy), strip(original));
    assert.equal(exerciseSteps(copy.blocks[0].steps)[0].name, 'Burpee');
  });
});
