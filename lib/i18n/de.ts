import type { Strings } from '../strings';
import { part1 } from './de/part1';
import { part2 } from './de/part2';
import { part3 } from './de/part3';
import { part4 } from './de/part4';
import { part5 } from './de/part5';

/** German. Every key of en.ts must be here; the compiler checks it. */
export const de: Strings = { ...part1, ...part2, ...part3, ...part4, ...part5 };

