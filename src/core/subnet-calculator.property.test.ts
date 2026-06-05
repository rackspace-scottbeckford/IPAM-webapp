import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  ipToNumber,
  numberToIp,
  prefixToMask,
  adjustToNetworkAddress,
  computeSubnetInfo,
} from './subnet-calculator';

/**
 * Feature: cloud-ipam-webapp, Property 5: Host-bit auto-adjustment
 * Validates: Requirements 2.5
 *
 * For any IPv4 address and prefix length P (8–30), adjustToNetworkAddress SHALL
 * produce an address where all (32-P) host bits are zero, and the resulting
 * network address bitwise-ANDed with the subnet mask equals itself.
 */
describe('Property 5: Host-bit auto-adjustment', () => {
  // Generator for valid prefix lengths (8-30)
  const prefixArb = fc.integer({ min: 8, max: 30 });

  // Generator for any 32-bit unsigned integer (representing an IP)
  const ipArb = fc.integer({ min: 0, max: 0xFFFFFFFF });

  it('adjustToNetworkAddress zeroes all host bits', () => {
    fc.assert(
      fc.property(ipArb, prefixArb, (ip, prefix) => {
        const result = adjustToNetworkAddress(ip, prefix);
        const mask = prefixToMask(prefix);

        // The network address ANDed with mask should equal itself
        expect((result.networkAddress.bits & mask) >>> 0).toBe(
          result.networkAddress.bits
        );

        // Host bits should all be zero
        const hostMask = (~mask) >>> 0;
        expect((result.networkAddress.bits & hostMask) >>> 0).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('preserves the prefix length in the returned CIDRBlock', () => {
    fc.assert(
      fc.property(ipArb, prefixArb, (ip, prefix) => {
        const result = adjustToNetworkAddress(ip, prefix);
        expect(result.prefixLength).toBe(prefix);
      }),
      { numRuns: 100 }
    );
  });

  it('network address is always less than or equal to the input IP', () => {
    fc.assert(
      fc.property(ipArb, prefixArb, (ip, prefix) => {
        const result = adjustToNetworkAddress(ip, prefix);
        // Network address has host bits zeroed, so it's <= original IP (unsigned)
        expect(result.networkAddress.bits).toBeLessThanOrEqual(ip >>> 0);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: cloud-ipam-webapp, Property 5: Host-bit auto-adjustment (round-trip)
 * Validates: Requirements 2.5
 *
 * Round-trip property tests for ipToNumber/numberToIp conversions that underpin
 * the host-bit auto-adjustment logic.
 */
describe('IPv4 conversion round-trip properties', () => {
  // Generator for valid dotted-decimal IPs
  const dottedIpArb = fc
    .tuple(
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 })
    )
    .map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

  // Generator for any 32-bit unsigned integer
  const uint32Arb = fc.integer({ min: 0, max: 0xFFFFFFFF });

  it('numberToIp(ipToNumber(ip)) === ip for any valid dotted-decimal IP', () => {
    fc.assert(
      fc.property(dottedIpArb, (ip) => {
        expect(numberToIp(ipToNumber(ip))).toBe(ip);
      }),
      { numRuns: 100 }
    );
  });

  it('ipToNumber(numberToIp(n)) === n for any 32-bit unsigned int', () => {
    fc.assert(
      fc.property(uint32Arb, (n) => {
        expect(ipToNumber(numberToIp(n))).toBe(n >>> 0);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: cloud-ipam-webapp, Property 4: Subnet arithmetic correctness
 * Validates: Requirements 2.2
 *
 * For any valid CIDR block with prefix length P, the SubnetCalculator SHALL compute:
 * network address with all host bits zeroed, broadcast address with all host bits set,
 * subnet mask with P leading 1-bits, and total addresses equal to 2^(32-P).
 */
describe('Property 4: Subnet arithmetic correctness', () => {
  // Generator for valid CIDR blocks with host bits already zeroed
  const validCIDRArb = fc.integer({ min: 8, max: 30 }).chain(prefix => {
    const mask = prefixToMask(prefix);
    return fc.integer({ min: 0, max: 0xFFFFFFFF }).map(ip => ({
      networkAddress: { bits: (ip & mask) >>> 0 },
      prefixLength: prefix,
    }));
  });

  it('network address matches the input network address (host bits zeroed)', () => {
    fc.assert(
      fc.property(validCIDRArb, (cidr) => {
        const result = computeSubnetInfo(cidr, 0);
        const expectedNetwork = numberToIp(cidr.networkAddress.bits);
        expect(result.networkAddress).toBe(expectedNetwork);
      }),
      { numRuns: 100 }
    );
  });

  it('broadcast address has all host bits set to 1', () => {
    fc.assert(
      fc.property(validCIDRArb, (cidr) => {
        const result = computeSubnetInfo(cidr, 0);
        const broadcastBits = ipToNumber(result.broadcastAddress);
        const mask = prefixToMask(cidr.prefixLength);
        const hostMask = (~mask) >>> 0;

        // Network portion should match the network address
        expect((broadcastBits & mask) >>> 0).toBe(cidr.networkAddress.bits);
        // Host portion should be all 1s
        expect((broadcastBits & hostMask) >>> 0).toBe(hostMask);
      }),
      { numRuns: 100 }
    );
  });

  it('subnet mask has exactly P leading 1-bits', () => {
    fc.assert(
      fc.property(validCIDRArb, (cidr) => {
        const result = computeSubnetInfo(cidr, 0);
        const maskBits = ipToNumber(result.subnetMask);
        const expectedMask = prefixToMask(cidr.prefixLength);
        expect(maskBits).toBe(expectedMask);

        // Verify the mask has exactly P leading 1-bits by counting
        let count = 0;
        let m = maskBits;
        while (m & 0x80000000) {
          count++;
          m = (m << 1) >>> 0;
        }
        expect(count).toBe(cidr.prefixLength);
        // Remaining bits should all be 0
        expect(m).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('total addresses equals 2^(32-P)', () => {
    fc.assert(
      fc.property(validCIDRArb, (cidr) => {
        const result = computeSubnetInfo(cidr, 0);
        const expected = Math.pow(2, 32 - cidr.prefixLength);
        expect(result.totalAddresses).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: cloud-ipam-webapp, Property 10: Usable host calculation with provider reservations
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.6
 *
 * For any valid subnet with prefix length P and any cloud provider profile with
 * reserved count R, the computed usable host count SHALL equal max(0, 2^(32-P) - R).
 */
describe('Property 10: Usable host calculation with provider reservations', () => {
  // Generator for valid CIDR blocks with proper network addresses
  const validCIDRArb = fc.integer({ min: 8, max: 30 }).chain(prefix => {
    const mask = prefixToMask(prefix);
    return fc.integer({ min: 0, max: 0xFFFFFFFF }).map(ip => ({
      networkAddress: { bits: (ip & mask) >>> 0 },
      prefixLength: prefix,
    }));
  });

  // Generator for provider reserved counts (2-10 covers all cloud profiles)
  const reservedCountArb = fc.integer({ min: 2, max: 10 });

  it('usableHosts === max(0, 2^(32-prefix) - reserved) for any valid CIDR and reserved count', () => {
    fc.assert(
      fc.property(validCIDRArb, reservedCountArb, (cidr, reserved) => {
        const result = computeSubnetInfo(cidr, reserved);
        const totalAddresses = Math.pow(2, 32 - cidr.prefixLength);
        const expected = Math.max(0, totalAddresses - reserved);
        expect(result.usableHosts).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  it('when total addresses <= reserved count, usableHosts === 0', () => {
    // Use prefix lengths where 2^(32-P) is small enough to be <= reserved
    // /30 has 4 addresses, /29 has 8 addresses
    const smallSubnetArb = fc.integer({ min: 28, max: 30 }).chain(prefix => {
      const mask = prefixToMask(prefix);
      return fc.integer({ min: 0, max: 0xFFFFFFFF }).map(ip => ({
        networkAddress: { bits: (ip & mask) >>> 0 },
        prefixLength: prefix,
      }));
    });

    // Reserved count that exceeds or equals total addresses
    const largeReservedArb = fc.integer({ min: 4, max: 10 });

    fc.assert(
      fc.property(smallSubnetArb, largeReservedArb, (cidr, reserved) => {
        const totalAddresses = Math.pow(2, 32 - cidr.prefixLength);
        // Only test cases where total <= reserved
        fc.pre(totalAddresses <= reserved);
        const result = computeSubnetInfo(cidr, reserved);
        expect(result.usableHosts).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('usableHosts is never negative', () => {
    fc.assert(
      fc.property(validCIDRArb, reservedCountArb, (cidr, reserved) => {
        const result = computeSubnetInfo(cidr, reserved);
        expect(result.usableHosts).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 }
    );
  });
});
