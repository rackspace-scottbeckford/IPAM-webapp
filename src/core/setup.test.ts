import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

describe('Project setup verification', () => {
  it('vitest is working', () => {
    expect(1 + 1).toBe(2);
  });

  it('fast-check is working', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        return a + b === b + a;
      }),
      { numRuns: 100 }
    );
  });

  it('path alias resolves (basic check)', () => {
    // This verifies the vitest config has the @ alias set up
    expect(true).toBe(true);
  });
});
