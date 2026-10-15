import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { palettes, type ThemeMode } from './colors';

/** WCAG 2.2 contrast ratio between two #RRGGBB colours. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = ['text', 'textSecondary', 'textTertiary', 'action', 'success', 'warning', 'danger', 'info', 'blue', 'purple', 'pink', 'orange', 'teal', 'red', 'green', 'amber'] as const;
const SURFACES = ['bg', 'bgElevated', 'card', 'cardAlt'] as const;

describe('design token contrast', () => {
  for (const mode of ['dark', 'light'] as ThemeMode[]) {
    const p = palettes[mode];
    it(`${mode}: all text colours reach 4.5:1 on every surface`, () => {
      const failures: string[] = [];
      for (const fg of TEXT) for (const bg of SURFACES) if (contrast(p[fg], p[bg]) < 4.5) failures.push(`${fg} on ${bg}: ${contrast(p[fg], p[bg]).toFixed(2)}`);
      assert.deepEqual(failures, []);
    });
    it(`${mode}: button labels reach 4.5:1 and controls 3:1`, () => {
      assert.ok(contrast(p.onAction, p.action) >= 4.5, `onAction on action ${contrast(p.onAction, p.action).toFixed(2)}`);
      assert.ok(contrast(p.onAction, p.danger) >= 4.5, `onAction on danger ${contrast(p.onAction, p.danger).toFixed(2)}`);
      for (const bg of ['card', 'cardAlt'] as const) assert.ok(contrast(p.borderStrong, p[bg]) >= 3, `borderStrong on ${bg} ${contrast(p.borderStrong, p[bg]).toFixed(2)}`);
      assert.ok(contrast(p.focus, p.bg) >= 3);
    });
  }
});
