import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateCIDR } from './input-validator';

/**
 * Feature: cloud-ipam-webapp, Property 3: CIDR input validation correctness
 *
 * For any input string, the CIDR validator SHALL accept it if and only if it matches
 * the format of four decimal octets (each 0–255) separated by dots, followed by a
 * forward slash and a numeric prefix length between 8 and 30 inclusive. All other
 * strings SHALL be rejected with an appropriate error classification.
 *
 * **Validates: Requirements 2.3, 2.4, 2.6**
 */
describe('Property 3: CIDR input validation correctness', () => {
  // --- Generators ---

  /** Valid CIDR: four octets 0-255 and prefix 8-30 */
  const validCIDR = fc.tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 8, max: 30 })
  ).map(([a, b, c, d, prefix]) => `${a}.${b}.${c}.${d}/${prefix}`);

  /** Invalid prefix: valid IP but prefix outside 8-30 */
  const invalidPrefixCIDR = fc.tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.oneof(fc.integer({ min: 0, max: 7 }), fc.integer({ min: 31, max: 128 }))
  ).map(([a, b, c, d, prefix]) => `${a}.${b}.${c}.${d}/${prefix}`);

  /** Invalid octet: at least one octet > 255, with valid prefix */
  const invalidOctetCIDR = fc.tuple(
    fc.integer({ min: 256, max: 999 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 8, max: 30 }),
    fc.integer({ min: 0, max: 3 }) // which octet position to make invalid
  ).map(([badOctet, b, c, d, prefix, pos]) => {
    const octets = [b, b, c, d]; // start with valid octets
    octets[pos] = badOctet; // replace one with the bad value
    return `${octets[0]}.${octets[1]}.${octets[2]}.${octets[3]}/${prefix}`;
  });

  /** Random strings that are unlikely to match CIDR format */
  const randomNonCIDR = fc.oneof(
    fc.string(), // completely random strings
    fc.string().filter(s => !s.includes('/') || !s.includes('.')), // strings without slash or dot
    fc.constantFrom('', ' ', 'hello', '10.0.0', '10.0.0.0', '//16', '.../', 'abc.def.ghi.jkl/16')
  );

  // --- Property Tests ---

  it('any valid CIDR string (octets 0-255, prefix 8-30) should be accepted', () => {
    fc.assert(
      fc.property(validCIDR, (cidr) => {
        const result = validateCIDR(cidr);
        expect(result.valid).toBe(true);
        if (result.valid) {
          // Verify the parsed prefix matches what we generated
          const expectedPrefix = parseInt(cidr.split('/')[1], 10);
          expect(result.cidr.prefixLength).toBe(expectedPrefix);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('any string with an octet > 255 should be rejected with octet_out_of_range', () => {
    fc.assert(
      fc.property(invalidOctetCIDR, (cidr) => {
        const result = validateCIDR(cidr);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.type).toBe('octet_out_of_range');
        }
      }),
      { numRuns: 100 }
    );
  });

  it('any string with prefix < 8 or > 30 should be rejected with prefix_out_of_range', () => {
    fc.assert(
      fc.property(invalidPrefixCIDR, (cidr) => {
        const result = validateCIDR(cidr);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.type).toBe('prefix_out_of_range');
        }
      }),
      { numRuns: 100 }
    );
  });

  it('random strings that do not match CIDR format should be rejected', () => {
    fc.assert(
      fc.property(randomNonCIDR, (input) => {
        // Skip inputs that happen to be valid CIDRs
        const parts = input.split('/');
        if (parts.length === 2) {
          const octets = parts[0].split('.');
          if (octets.length === 4) {
            const allOctetsValid = octets.every(o => /^\d+$/.test(o) && Number(o) >= 0 && Number(o) <= 255);
            const prefixValid = /^\d+$/.test(parts[1]) && Number(parts[1]) >= 8 && Number(parts[1]) <= 30;
            if (allOctetsValid && prefixValid) {
              return; // This is actually a valid CIDR, skip
            }
          }
        }

        const result = validateCIDR(input);
        expect(result.valid).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});
