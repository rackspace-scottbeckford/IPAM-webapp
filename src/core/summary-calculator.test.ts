import { describe, it, expect } from 'vitest';
import { computeSummary } from './summary-calculator';
import type { SubnetNode, CloudProviderProfile, UseCaseTag } from './types';

// Helper to create a minimal AWS-like profile
function createProfile(overrides: Partial<CloudProviderProfile> = {}): CloudProviderProfile {
  return {
    cloudId: 'aws',
    displayName: 'Amazon Web Services',
    reservedIPs: 5,
    reservedReasons: ['Network', 'Router', 'DNS', 'Future', 'Broadcast'],
    subnetLimit: 200,
    defaultTags: [],
    accentColor: '#FF9900',
    iconPath: '/icons/aws.svg',
    ...overrides,
  };
}

// Helper to create a leaf node
function createLeaf(overrides: Partial<SubnetNode> = {}): SubnetNode {
  return {
    id: 'leaf-1',
    cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 24 }, // 10.0.0.0/24
    children: null,
    tags: [],
    workloadAccount: null,
    availabilityZone: null,
    label: null,
    ...overrides,
  };
}

function createTag(name: string, id?: string): UseCaseTag {
  return {
    id: id || `tag-${name}`,
    name,
    isCustom: false,
    color: '#FF0000',
  };
}

describe('computeSummary', () => {
  describe('totalSubnets', () => {
    it('returns 1 for a single leaf tree', () => {
      const tree = createLeaf();
      const profile = createProfile();
      const summary = computeSummary(tree, profile);
      expect(summary.totalSubnets).toBe(1);
    });

    it('returns correct count for a tree with multiple leaves', () => {
      const tree: SubnetNode = {
        id: 'root',
        cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 23 }, // 10.0.0.0/23
        children: [
          createLeaf({ id: 'left', cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 24 } }),
          createLeaf({ id: 'right', cidr: { networkAddress: { bits: 0x0A000100 }, prefixLength: 24 } }),
        ],
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };
      const profile = createProfile();
      const summary = computeSummary(tree, profile);
      expect(summary.totalSubnets).toBe(2);
    });
  });

  describe('allocationPercentage', () => {
    it('returns 100.0 for a single leaf tree (root is the leaf)', () => {
      const tree = createLeaf({
        cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 16 },
      });
      const profile = createProfile();
      const summary = computeSummary(tree, profile);
      expect(summary.allocationPercentage).toBe(100.0);
    });

    it('returns 100.0 when all space is allocated via splits', () => {
      const tree: SubnetNode = {
        id: 'root',
        cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 24 }, // 10.0.0.0/24
        children: [
          createLeaf({ id: 'left', cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 25 } }),
          createLeaf({ id: 'right', cidr: { networkAddress: { bits: 0x0A000080 }, prefixLength: 25 } }),
        ],
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };
      const profile = createProfile();
      const summary = computeSummary(tree, profile);
      expect(summary.allocationPercentage).toBe(100.0);
    });

    it('rounds to 1 decimal place', () => {
      // Root is /16 (65536 addresses), one leaf is /17 (32768 addresses) = 50.0%
      // But if we have a deeper split where only some leaves exist:
      // Root /24 (256 addresses), one leaf /26 (64 addresses) = 25.0%
      const tree: SubnetNode = {
        id: 'root',
        cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 24 }, // 256 addresses
        children: [
          {
            id: 'left',
            cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 25 }, // 128 addresses
            children: [
              createLeaf({ id: 'll', cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 26 } }), // 64 addresses
              createLeaf({ id: 'lr', cidr: { networkAddress: { bits: 0x0A000040 }, prefixLength: 26 } }), // 64 addresses
            ],
            tags: [],
            workloadAccount: null,
            availabilityZone: null,
            label: null,
          },
          createLeaf({ id: 'right', cidr: { networkAddress: { bits: 0x0A000080 }, prefixLength: 25 } }), // 128 addresses
        ],
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };
      const profile = createProfile();
      const summary = computeSummary(tree, profile);
      // Leaves: /26 (64) + /26 (64) + /25 (128) = 256 / 256 = 100%
      expect(summary.allocationPercentage).toBe(100.0);
    });
  });

  describe('subnetsByTag', () => {
    it('returns empty map when no leaves have tags', () => {
      const tree = createLeaf();
      const profile = createProfile();
      const summary = computeSummary(tree, profile);
      expect(summary.subnetsByTag.size).toBe(0);
    });

    it('counts subnets per tag correctly', () => {
      const tag1 = createTag('workload');
      const tag2 = createTag('transit-gateway');

      const tree: SubnetNode = {
        id: 'root',
        cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 23 },
        children: [
          createLeaf({ id: 'left', cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 24 }, tags: [tag1, tag2] }),
          createLeaf({ id: 'right', cidr: { networkAddress: { bits: 0x0A000100 }, prefixLength: 24 }, tags: [tag1] }),
        ],
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };
      const profile = createProfile();
      const summary = computeSummary(tree, profile);

      expect(summary.subnetsByTag.get('workload')).toBe(2);
      expect(summary.subnetsByTag.get('transit-gateway')).toBe(1);
    });
  });

  describe('subnetsByAZ', () => {
    it('returns empty map when no leaves have AZ assignments', () => {
      const tree = createLeaf();
      const profile = createProfile();
      const summary = computeSummary(tree, profile);
      expect(summary.subnetsByAZ.size).toBe(0);
    });

    it('counts subnets per AZ correctly', () => {
      const tree: SubnetNode = {
        id: 'root',
        cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 23 },
        children: [
          createLeaf({ id: 'left', cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 24 }, availabilityZone: 'us-east-1a' }),
          createLeaf({ id: 'right', cidr: { networkAddress: { bits: 0x0A000100 }, prefixLength: 24 }, availabilityZone: 'us-east-1b' }),
        ],
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };
      const profile = createProfile();
      const summary = computeSummary(tree, profile);

      expect(summary.subnetsByAZ.get('us-east-1a')).toBe(1);
      expect(summary.subnetsByAZ.get('us-east-1b')).toBe(1);
    });

    it('groups multiple subnets in the same AZ', () => {
      const tree: SubnetNode = {
        id: 'root',
        cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 22 },
        children: [
          {
            id: 'left',
            cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 23 },
            children: [
              createLeaf({ id: 'll', cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 24 }, availabilityZone: 'us-east-1a' }),
              createLeaf({ id: 'lr', cidr: { networkAddress: { bits: 0x0A000100 }, prefixLength: 24 }, availabilityZone: 'us-east-1a' }),
            ],
            tags: [],
            workloadAccount: null,
            availabilityZone: null,
            label: null,
          },
          createLeaf({ id: 'right', cidr: { networkAddress: { bits: 0x0A000200 }, prefixLength: 23 }, availabilityZone: 'us-east-1b' }),
        ],
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };
      const profile = createProfile();
      const summary = computeSummary(tree, profile);

      expect(summary.subnetsByAZ.get('us-east-1a')).toBe(2);
      expect(summary.subnetsByAZ.get('us-east-1b')).toBe(1);
    });
  });

  describe('totalUsableIPs', () => {
    it('computes usable IPs for a single /24 leaf with AWS profile (5 reserved)', () => {
      const tree = createLeaf({
        cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 24 },
      });
      const profile = createProfile({ reservedIPs: 5 });
      const summary = computeSummary(tree, profile);
      // 2^(32-24) - 5 = 256 - 5 = 251
      expect(summary.totalUsableIPs).toBe(251);
    });

    it('sums usable IPs across multiple leaves', () => {
      const tree: SubnetNode = {
        id: 'root',
        cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 23 },
        children: [
          createLeaf({ id: 'left', cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 24 } }),
          createLeaf({ id: 'right', cidr: { networkAddress: { bits: 0x0A000100 }, prefixLength: 24 } }),
        ],
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };
      const profile = createProfile({ reservedIPs: 5 });
      const summary = computeSummary(tree, profile);
      // 2 * (256 - 5) = 502
      expect(summary.totalUsableIPs).toBe(502);
    });
  });

  describe('limitWarning', () => {
    it('returns null when subnet count is within limit', () => {
      const tree = createLeaf();
      const profile = createProfile({ subnetLimit: 200 });
      const summary = computeSummary(tree, profile);
      expect(summary.limitWarning).toBeNull();
    });

    it('returns warning when subnet count exceeds limit', () => {
      // Create a tree with 3 leaves but limit of 2
      const tree: SubnetNode = {
        id: 'root',
        cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 22 },
        children: [
          {
            id: 'left',
            cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 23 },
            children: [
              createLeaf({ id: 'll', cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 24 } }),
              createLeaf({ id: 'lr', cidr: { networkAddress: { bits: 0x0A000100 }, prefixLength: 24 } }),
            ],
            tags: [],
            workloadAccount: null,
            availabilityZone: null,
            label: null,
          },
          createLeaf({ id: 'right', cidr: { networkAddress: { bits: 0x0A000200 }, prefixLength: 23 } }),
        ],
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };
      const profile = createProfile({ subnetLimit: 2 });
      const summary = computeSummary(tree, profile);

      expect(summary.limitWarning).not.toBeNull();
      expect(summary.limitWarning!.currentCount).toBe(3);
      expect(summary.limitWarning!.maxAllowed).toBe(2);
      expect(summary.limitWarning!.providerName).toBe('Amazon Web Services');
    });

    it('returns null when subnet count equals limit', () => {
      const tree: SubnetNode = {
        id: 'root',
        cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 23 },
        children: [
          createLeaf({ id: 'left', cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 24 } }),
          createLeaf({ id: 'right', cidr: { networkAddress: { bits: 0x0A000100 }, prefixLength: 24 } }),
        ],
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };
      const profile = createProfile({ subnetLimit: 2 });
      const summary = computeSummary(tree, profile);
      expect(summary.limitWarning).toBeNull();
    });
  });

  describe('accountBreakdown', () => {
    it('returns empty array when no leaves have workload accounts', () => {
      const tree = createLeaf();
      const profile = createProfile();
      const summary = computeSummary(tree, profile);
      expect(summary.accountBreakdown).toEqual([]);
    });

    it('correctly partitions by workload account', () => {
      const tree: SubnetNode = {
        id: 'root',
        cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 22 },
        children: [
          {
            id: 'left',
            cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 23 },
            children: [
              createLeaf({ id: 'll', cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 24 }, workloadAccount: 'account-a' }),
              createLeaf({ id: 'lr', cidr: { networkAddress: { bits: 0x0A000100 }, prefixLength: 24 }, workloadAccount: 'account-b' }),
            ],
            tags: [],
            workloadAccount: null,
            availabilityZone: null,
            label: null,
          },
          createLeaf({ id: 'right', cidr: { networkAddress: { bits: 0x0A000200 }, prefixLength: 23 }, workloadAccount: 'account-a' }),
        ],
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };
      const profile = createProfile({ reservedIPs: 5 });
      const summary = computeSummary(tree, profile);

      // account-a: 2 subnets, /24 (251 usable) + /23 (507 usable) = 758 usable
      // account-b: 1 subnet, /24 (251 usable)
      // total usable: 251 + 251 + 507 = 1009
      const accountA = summary.accountBreakdown.find((a) => a.account === 'account-a');
      const accountB = summary.accountBreakdown.find((a) => a.account === 'account-b');

      expect(accountA).toBeDefined();
      expect(accountA!.subnetCount).toBe(2);
      expect(accountA!.usableIPs).toBe(758);

      expect(accountB).toBeDefined();
      expect(accountB!.subnetCount).toBe(1);
      expect(accountB!.usableIPs).toBe(251);
    });

    it('computes percentageOfTotal correctly', () => {
      const tree: SubnetNode = {
        id: 'root',
        cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 23 },
        children: [
          createLeaf({ id: 'left', cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 24 }, workloadAccount: 'acct-1' }),
          createLeaf({ id: 'right', cidr: { networkAddress: { bits: 0x0A000100 }, prefixLength: 24 }, workloadAccount: 'acct-1' }),
        ],
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };
      const profile = createProfile({ reservedIPs: 5 });
      const summary = computeSummary(tree, profile);

      // Both leaves assigned to same account, so percentage should be 100%
      const acct = summary.accountBreakdown.find((a) => a.account === 'acct-1');
      expect(acct).toBeDefined();
      expect(acct!.percentageOfTotal).toBe(100.0);
    });
  });
});
