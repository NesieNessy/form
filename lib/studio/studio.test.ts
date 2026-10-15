import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bookingAction, byDay, formatPrice, reportCell, seriesStarts } from './model';

const NOW = new Date(2026, 9, 14, 12).getTime();
const at = (hours: number) => new Date(NOW + hours * 3_600_000).toISOString();

describe('studio helpers', () => {
  it('offers the one booking action that fits the class', () => {
    const c = { status: 'scheduled' as const, starts_at: at(24), capacity: 2, booked: 1, my_booking: null };
    assert.equal(bookingAction(c, NOW), 'book');
    assert.equal(bookingAction({ ...c, booked: 2 }, NOW), 'join_waitlist');
    assert.equal(bookingAction({ ...c, my_booking: { id: 'b', status: 'booked', attended: null, waitlist_position: null } }, NOW), 'cancel');
    assert.equal(bookingAction({ ...c, my_booking: { id: 'b', status: 'waitlisted', attended: null, waitlist_position: 1 } }, NOW), 'leave_waitlist');
    assert.equal(bookingAction({ ...c, starts_at: at(-1) }, NOW), 'started');
    assert.equal(bookingAction({ ...c, status: 'cancelled' }, NOW), 'cancelled');
  });

  it('previews a weekly series at the same local time, at most 26 weeks', () => {
    const starts = seriesStarts(new Date(2026, 9, 20, 7, 30), 3);
    assert.deepEqual(starts.map((d) => [d.getDate(), d.getHours(), d.getMinutes()]), [[20, 7, 30], [27, 7, 30], [3, 7, 30]]);
    assert.equal(seriesStarts(new Date(NOW), 99).length, 26);
  });

  it('formats prices and hidden report cells', () => {
    assert.equal(formatPrice(6000, 'EUR'), '60 EUR');
    assert.equal(formatPrice(1250, 'CHF'), '12.50 CHF');
    assert.equal(reportCell(null, true, 5), 'fewer than 5');
    assert.equal(reportCell(12, false, 5), '12');
  });

  it('groups classes by local day in time order', () => {
    const days = byDay([{ starts_at: at(26) }, { starts_at: at(1) }, { starts_at: at(2) }]);
    assert.deepEqual(days.map((d) => d.items.length), [2, 1]);
  });
});
