import { describe, expect, it } from 'vitest';
import { splitQuantityAmongClients } from './supplier-loadings';

const sum = (a: number[]) => Math.round(a.reduce((s, x) => s + x, 0) * 100) / 100;

describe('splitQuantityAmongClients', () => {
  it.each([
    [30, 1],
    [31, 3],
    [20, 2],
    [30.5, 2],
    [1.5, 2],
    [1, 3],
    [32.75, 4],
    [0.05, 3],
  ])('total %s sur %s clients : somme exacte, parts ≥ 0', (total, n) => {
    const parts = splitQuantityAmongClients(total, n);
    expect(parts).toHaveLength(n);
    expect(sum(parts)).toBe(total);
    parts.forEach((p) => expect(p).toBeGreaterThanOrEqual(0));
  });

  it('répartit équitablement', () => {
    expect(splitQuantityAmongClients(31, 3)).toEqual([11, 10, 10]);
    expect(splitQuantityAmongClients(30.5, 2)).toEqual([15.25, 15.25]);
  });
});
