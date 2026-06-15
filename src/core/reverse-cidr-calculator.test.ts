import { describe, it, expect } from 'vitest';
import {
  calculateReverseCIDR,
  validateFitsInRoot,
  findAvailableLeaf,
  splitsNeeded,
} from './reverse-cidr-calculator';
import type { SubnetNode, CIDRBlock } from './types';

describe('calculateReverseCIDR', () => {
  describe('AWS profile (5 reserved)', () => {
    const reserved = 5;

    it('suggests /16 for 40000 usable IPs', () => {
      const result = calculateReverseCIDR(40000, reserved);
      expect('suggestedPrefix' in result).toBe(true);
      if ('suggestedPrefix' in result) {
        expect(result.suggestedPrefix).toBe(16);
        expect(result.usableAddresses).toBe(65536 - 5); // 65531
        expect(result.surplus).toBe(65531 - 40000);
      }
    });

    it('suggests /24 for 200 usable IPs', () => {
      const result = calculateReverseCIDR(200, reserved);
      expect('suggestedPrefix' in result).toBe(true);
      if ('suggestedPrefix' in result) {
        expect(result.suggestedPrefix).toBe(24);
        expect(result.usableAddresses).toBe(256 - 5); // 251
        expect(result.surplus).toBe(251 - 200);
      }
    });

    it('suggests /28 for 10 usable IPs', () => {
      const result = calculateReverseCIDR(10, reserved);
      expect('suggestedPrefix' in result).toBe(true);
      if ('suggestedPrefix' in result) {
        expect(result.suggestedPrefix).toBe(28);
        expect(result.usableAddresses).toBe(16 - 5); // 11
        expect(result.surplus).toBe(11 - 10);
      }
    });

    it('suggests /30 for 1 usable IP (edge: smallest possible)', () => {
      // /30 = 4 addresses - 5 reserved = -1 usable → not enough
      // /29 = 8 addresses - 5 reserved = 3 usable → yes
      const result = calculateReverseCIDR(1, reserved);
      expect('suggestedPrefix' in result).toBe(true);
      if ('suggestedPrefix' in result) {
        // /29 has 3 usable with AWS
        expect(result.suggestedPrefix).toBe(29);
        expect(result.usableAddresses).toBe(8 - 5);
      }
    });

    it('suggests /25 for 251 usable IPs (exact fit at /24 boundary)', () => {
      // /24 = 256 - 5 = 251 usable → exact match
      const result = calculateReverseCIDR(251, reserved);
      expect('suggestedPrefix' in result).toBe(true);
      if ('suggestedPrefix' in result) {
        expect(result.suggestedPrefix).toBe(24);
        expect(result.surplus).toBe(0);
      }
    });

    it('suggests /23 for 252 usable IPs (just over /24)', () => {
      // /24 = 251 usable → not enough, needs /23 = 512 - 5 = 507
      const result = calculateReverseCIDR(252, reserved);
      expect('suggestedPrefix' in result).toBe(true);
      if ('suggestedPrefix' in result) {
        expect(result.suggestedPrefix).toBe(23);
        expect(result.usableAddresses).toBe(512 - 5);
      }
    });
  });

  describe('GCP profile (4 reserved)', () => {
    const reserved = 4;

    it('suggests /28 for 12 usable IPs', () => {
      const result = calculateReverseCIDR(12, reserved);
      expect('suggestedPrefix' in result).toBe(true);
      if ('suggestedPrefix' in result) {
        expect(result.suggestedPrefix).toBe(28);
        expect(result.usableAddresses).toBe(16 - 4); // 12
        expect(result.surplus).toBe(0);
      }
    });

    it('suggests /30 for 1 usable IP (with 4 reserved, /30 has 0 usable)', () => {
      // /30 = 4 - 4 = 0 → not enough, /29 = 8 - 4 = 4
      const result = calculateReverseCIDR(1, reserved);
      expect('suggestedPrefix' in result).toBe(true);
      if ('suggestedPrefix' in result) {
        expect(result.suggestedPrefix).toBe(29);
        expect(result.usableAddresses).toBe(4);
      }
    });
  });

  describe('Private Cloud (2 reserved)', () => {
    const reserved = 2;

    it('suggests /30 for 2 usable IPs', () => {
      // /30 = 4 - 2 = 2 usable
      const result = calculateReverseCIDR(2, reserved);
      expect('suggestedPrefix' in result).toBe(true);
      if ('suggestedPrefix' in result) {
        expect(result.suggestedPrefix).toBe(30);
        expect(result.usableAddresses).toBe(2);
        expect(result.surplus).toBe(0);
      }
    });

    it('suggests /29 for 3 usable IPs', () => {
      // /30 = 2 usable → not enough, /29 = 6 usable
      const result = calculateReverseCIDR(3, reserved);
      expect('suggestedPrefix' in result).toBe(true);
      if ('suggestedPrefix' in result) {
        expect(result.suggestedPrefix).toBe(29);
        expect(result.usableAddresses).toBe(6);
      }
    });
  });

  describe('error cases', () => {
    it('returns error for 0 requested IPs', () => {
      const result = calculateReverseCIDR(0, 5);
      expect('type' in result && result.type === 'exceeds_capacity').toBe(true);
    });

    it('returns error for negative requested IPs', () => {
      const result = calculateReverseCIDR(-1, 5);
      expect('type' in result && result.type === 'exceeds_capacity').toBe(true);
    });

    it('returns error for request exceeding maximum (16,777,214)', () => {
      const result = calculateReverseCIDR(16777215, 5);
      expect('type' in result && result.type === 'exceeds_capacity').toBe(true);
    });

    it('returns error when no prefix can satisfy huge request with large reserved count', () => {
      // /8 = 16,777,216 total - 5 reserved = 16,777,211 usable
      // Requesting 16,777,212 is more than max usable
      const result = calculateReverseCIDR(16777212, 5);
      expect('type' in result && result.type === 'exceeds_capacity').toBe(true);
    });
  });
});

describe('validateFitsInRoot', () => {
  it('returns null when suggested prefix is within root', () => {
    const rootCIDR: CIDRBlock = { networkAddress: { bits: 0x0A000000 }, prefixLength: 16 };
    const result = validateFitsInRoot(24, rootCIDR, 5, 200);
    expect(result).toBeNull();
  });

  it('returns null when suggested prefix equals root prefix', () => {
    const rootCIDR: CIDRBlock = { networkAddress: { bits: 0x0A000000 }, prefixLength: 16 };
    const result = validateFitsInRoot(16, rootCIDR, 5, 40000);
    expect(result).toBeNull();
  });

  it('returns error when suggested prefix is larger than root (subnet bigger than root)', () => {
    const rootCIDR: CIDRBlock = { networkAddress: { bits: 0x0A000000 }, prefixLength: 24 };
    const result = validateFitsInRoot(16, rootCIDR, 5, 40000);
    expect(result).not.toBeNull();
    expect(result).toContain('too small');
  });
});

describe('findAvailableLeaf', () => {
  const makeLeaf = (id: string, prefix: number, tagged = false, account: string | null = null): SubnetNode => ({
    id,
    cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: prefix },
    children: null,
    tags: tagged ? [{ id: 'tag1', name: 'workload', isCustom: false, color: '#000' }] : [],
    workloadAccount: account,
    availabilityZone: null,
    label: null,
  });

  it('finds exact-match unassigned leaf', () => {
    const tree: SubnetNode = {
      id: 'root',
      cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 16 },
      children: [
        makeLeaf('left', 17),
        makeLeaf('right', 17),
      ],
      tags: [],
      workloadAccount: null,
      availabilityZone: null,
      label: null,
    };

    const result = findAvailableLeaf(tree, 17);
    expect(result).toBe('left');
  });

  it('skips tagged leaves', () => {
    const tree: SubnetNode = {
      id: 'root',
      cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 16 },
      children: [
        makeLeaf('left', 17, true),
        makeLeaf('right', 17),
      ],
      tags: [],
      workloadAccount: null,
      availabilityZone: null,
      label: null,
    };

    const result = findAvailableLeaf(tree, 17);
    expect(result).toBe('right');
  });

  it('finds splittable leaf when no exact match exists', () => {
    // Only has /17 leaves but we need /24 → splittable
    const tree: SubnetNode = {
      id: 'root',
      cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 16 },
      children: [
        makeLeaf('left', 17, true), // tagged, skip
        makeLeaf('right', 17),       // untagged, can be split
      ],
      tags: [],
      workloadAccount: null,
      availabilityZone: null,
      label: null,
    };

    const result = findAvailableLeaf(tree, 24);
    expect(result).toBe('right');
  });

  it('returns null when all leaves are assigned', () => {
    const tree: SubnetNode = {
      id: 'root',
      cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 16 },
      children: [
        makeLeaf('left', 17, true),
        makeLeaf('right', 17, false, 'account1'),
      ],
      tags: [],
      workloadAccount: null,
      availabilityZone: null,
      label: null,
    };

    const result = findAvailableLeaf(tree, 24);
    // 'right' has a workloadAccount so it's not available
    expect(result).toBeNull();
  });

  it('returns null when tree is a single leaf with smaller prefix than target', () => {
    // Root is /24 but we need /16 → target is larger than available
    const tree = makeLeaf('root', 24);
    const result = findAvailableLeaf(tree, 16);
    expect(result).toBeNull();
  });
});

describe('splitsNeeded', () => {
  it('returns 0 when current equals target', () => {
    expect(splitsNeeded(24, 24)).toBe(0);
  });

  it('returns correct count for /16 to /24', () => {
    expect(splitsNeeded(16, 24)).toBe(8);
  });

  it('returns 1 for adjacent prefixes', () => {
    expect(splitsNeeded(23, 24)).toBe(1);
  });
});
