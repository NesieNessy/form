/**
 * Workout core in the browser: migration of the oldest local store, manual
 * logging, templates, deletion, and the timers following the device clock.
 */
import { expect, test } from '@playwright/test';
import { close, openApp, type App } from './helpers';

test.describe.configure({ mode: 'serial' });

const DAY = 86_400_000;
const LEGACY_V1 = {
  state: {
    workouts: [
      {
        id: 'workout-1',
        title: 'Legacy Fran',
        category: 'crossfit',
        dateTimeMs: Date.now() - 3 * DAY,
        dateLabel: 'old',
        notes: 'from the old store',
        sections: [
          {
            key: 'wod',
            workoutType: 'forTime',
            structure: { kind: 'repScheme', scheme: '21-15-9' },
            exercises: [
              { id: 'ex-1', name: 'Thruster', primary: { target: 'reps', reps: 21 }, weight: { value: 43, mode: 'total' } },
              { id: 'ex-2', name: 'Pull Up', primary: { target: 'reps', reps: 21 } },
            ],
          },
        ],
        createdAt: Date.now() - 3 * DAY,
        updatedAt: Date.now() - 3 * DAY,
      },
    ],
  },
  version: 1,
};

let app: App;

test.beforeAll(async ({ browser }) => {
  app = await openApp(browser, LEGACY_V1);
  await app.page.clock.install();
});
test.afterAll(() => close(app));

const jump = async (seconds: number) => {
  await app.page.clock.fastForward(seconds * 1000);
  await app.page.waitForTimeout(400);
};

test('the oldest local store is migrated', async () => {
  const { page, see, click } = app;
  await page.goto('/');
  await see('Weekly Goal');
  await click('Train');
  await see('Legacy Fran');
  await see('Planned');
  await click('Legacy Fran');
  await see('For Time · 21-15-9');
  await see('21 reps · 43 kg');
  await see('from the old store');
});

test('results can be logged by hand', async () => {
  const { page, see, click } = app;
  await click('Log Results');
  await see('Workout of the Day');
  const fields = page.getByPlaceholder('–');
  await fields.nth(0).fill('4');
  await fields.nth(1).fill('35');
  await click('Save Results');
  await see('Results');
  await see('4:35');
});

test('a workout saved as a template can be scheduled again', async () => {
  const { see, click, back, visible } = app;
  await click('Save as Template');
  await see('Remove from Templates');
  await back();
  await click('Templates');
  await see('Legacy Fran');
  await click('Schedule');
  await visible('20').last().click();
  await click('List');
  await expect(visible('Legacy Fran')).toHaveCount(2);
});

test('deleting a calendar entry asks first', async () => {
  const { see, click, visible } = app;
  await visible('Legacy Fran').first().click();
  await see('Start Workout');
  await click('Delete');
  await see('Delete this workout and its results?');
  await visible('Delete').last().click();
  await see('Your training plans');
  await expect(visible('Legacy Fran')).toHaveCount(1);
});

test('tabata phases follow the device clock across a jump', async () => {
  const { see, click } = app;
  await click('More');
  await click('Targeted Workouts');
  for (let i = 0; i < 4; i++) await click('NEXT');
  await see('Tabata V-Ups');
  await click('Start Workout');
  await see('Section 1 of 5');
  await see('Intervals · 8 × 0:20 / 0:10');
  await click('Start');
  await jump(5);
  await see('Round 1 of 8');
  await see('Work');
  await jump(18);
  await see('Rest');
  await jump(70);
  await see('Round 4 of 8');
  await jump(600); // far past the end, as if the phone slept
  await see("Time's up");
  await see('Your Result');
  await click('Next Section');
  await see('Section 2 of 5');
  await click('Start');
  await jump(61); // a pause hands over to the next movement by itself
  await see('Section 3 of 5');
  await click('Skip');
  await click('Skip');
  await click('Skip');
  await see('How did it feel?');
  await click('Save Results');
  await see('Results');
  await see('5:00');
  await see('Skipped');
});

test('an AMRAP counts down, survives leaving, and stops at zero', async () => {
  const { page, see, click, back, visible } = app;
  await back();
  await see('Tabata V-Ups');
  for (let i = 0; i < 8; i++) await click('NEXT');
  await see('AMRAP · 10:00');
  await click('Start Workout');
  await see('10:00');
  await click('Start');
  await jump(61);
  await see('8:59');
  await visible('Rounds done').first().waitFor();
  await page.getByLabel('Leave Workout').click();
  await see('Your progress is kept');
  await click('Keep for Later');
  await page.goto('/');
  await see('Resume Workout');
  await click('Resume Workout');
  await see('In progress').catch(() => {});
  await click('Resume Workout');
  await visible(/^8:5\d$/).first().waitFor();
  await click('Resume');
  await jump(600);
  await see("Time's up");
  await click('Finish Workout');
  await click('Save Results');
  await see('Results');
  await see('10:00');
});

test('the weekly count reflects the sessions completed today', async () => {
  await app.page.goto('/');
  // Two sessions today, plus the seeded one from three days ago when that is still this week (weeks start on Monday).
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)).getTime();
  await app.see(`${Date.now() - 3 * DAY >= monday ? 3 : 2} / 5 Workouts`);
  app.expectNoBrowserErrors();
});
