import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeSummary } from './summary-calculator';
import { getLeaves } from './tree-operations';
import { computeSubnetInfo, prefixToMask } from './subnet-calculator';
import type { SubnetNode, CloudProviderProfile, UseCaseTag } from './types';

// === Generators ===

/**
 * Generator for an array of unique tags (0 to 5).
 */
const tagsArb: fc.Arbitrary<UseCaseTag[]> = fc.integer({ min: 0, max: 5 }).chain(count =>
  fc.constant(Array.from({ length: count }, (_, i) => ({
    id: `tag-${i}`,
    name: `tag-name-${i}`,
    isCustom: false,
    color: `#${(i * 37 + 100).toString(16).padStart(6, '0').slice(0, 6)}`,
  })))
);

/**
 * Generator for availability zone names.
 */
const azArb: fc.Arbitrary<string | null> = fc.oneof(
  fc.constant(null),
  fc.constantFrom('us-east-1a', 'us-east-1b', 'us-east-1c', 'us-west-2a', 'eu-west-1a')
);

/**
 * Generator for workload account names.
 */
const accountArb: fc.Arbitrary<string | null> = fc.oneof(
  fc.constant(null),
  fc.constantFrom('account-prod', 'account-dev', 'account-staging', 'account-shared')
);

/**
 * Generator for cloud provider profiles with configurable reserved IPs and subnet limits.
 */
const profileArb: fc.Arbitrary<CloudProviderProfile> = fc.record({
  reservedIPs: fc.integer({ min: 2, max: 10 }),
  subnetLimit: fc.integer({ min: 1, max: 500 }),
  displayName: fc.constantFrom('Amazon Web Services', 'Microsoft Azure', 'Google Cloud Platform', 'Private Cloud'),
}).map(({ reservedIPs, subnetLimit, displayName }) => ({
  cloudId: 'aws' as const,
  displayName,
  reservedIPs,
  reservedReasons: Array.from({ length: reservedIPs }, (_, i) => `Reserved ${i + 1}`),
  subnetLimit,
  defaultTags: [],
  accentColor: '#FF9900',
  iconPath: '/icons/aws.svg',
}));

/**
 * Build a random subnet tree by starting with a root leaf and applying random splits.
 * Returns a tree with leaves annotated with random tags, AZs, and workload accounts.
 */
const subnetTreeArb: fc.Arbitrary<SubnetNode> = fc.integer({ min: 8, max: 24 }).chain(rootPrefix => {
  // Limit max splits to keep trees manageable and avoid exceeding /30
  const maxSplits = Math.min(30 - rootPrefix, 6);
  return fc.integer({ min: 0, max: maxSplits }).chain(numSplits => {
    return fc.tuple(
      fc.array(fc.integer({ min: 0, max: 100 }), { minLength: numSplits, maxLength: numSplits }),
      fc.array(tagsArb, { minLength: numSplits + 1, maxLength: numSplits + 1 }),
      fc.array(azArb, { minLength: numSplits + 1, maxLength: numSplits + 1 }),
      fc.array(accountArb, { minLength: numSplits + 1, maxLength: numSplits + 1 })
    ).map(([splitSeeds, tagSets, azSets, accountSets]) => {
      const mask = prefixToMask(rootPrefix);
      const rootNetwork = (0x0A000000 & mask) >>> 0; // 10.0.0.0 aligned

      let tree: SubnetNode = {
        id: 'root',
        cidr: { networkAddress: { bits: rootNetwork }, prefixLength: rootPrefix },
        children: null,
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };

      // Apply splits to random leaves
      let nodeCounter = 0;
      for (let i = 0; i < numSplits; i++) {
        const leaves = getLeaves(tree);
        // Only split leaves that can be split (prefix < 30)
        const splittableLeaves = leaves.filter(l => l.cidr.prefixLength < 30);
        if (splittableLeaves.length === 0) break;

        const targetIndex = splitSeeds[i] % splittableLeaves.length;
        const targetLeaf = splittableLeaves[targetIndex];

        // Split the target leaf
        tree = splitNode(tree, targetLeaf.id, ++nodeCounter);
      }

      // Annotate leaves with tags, AZs, and accounts
      const leaves = getLeaves(tree);
      tree = annotateLeaves(tree, leaves, tagSets, azSets, accountSets);

      return tree;
    });
  });
});

/**
 * Immutably split a node in the tree by ID, producing two children.
 */
function splitNode(tree: SubnetNode, nodeId: string, counter: number): SubnetNode {
  if (tree.id === nodeId && tree.children === null && tree.cidr.prefixLength < 30) {
    const newPrefix = tree.cidr.prefixLength + 1;
    const parentNetwork = tree.cidr.networkAddress.bits;
    const secondOffset = Math.pow(2, 32 - newPrefix);
    const secondNetwork = (parentNetwork + secondOffset) >>> 0;

    const firstChild: SubnetNode = {
      id: `node-${counter}-a`,
      cidr: { networkAddress: { bits: parentNetwork }, prefixLength: newPrefix },
      children: null,
      tags: [],
      workloadAccount: null,
      availabilityZone: null,
      label: null,
    };

    const secondChild: SubnetNode = {
      id: `node-${counter}-b`,
      cidr: { networkAddress: { bits: secondNetwork }, prefixLength: newPrefix },
      children: null,
      tags: [],
      workloadAccount: null,
      availabilityZone: null,
      label: null,
    };

    return {
      ...tree,
      children: [firstChild, secondChild],
    };
  }

  if (tree.children === null) return tree;

  const [left, right] = tree.children;
  return {
    ...tree,
    children: [splitNode(left, nodeId, counter), splitNode(right, nodeId, counter)],
  };
}

/**
 * Annotate leaves with tags, AZs, and workload accounts from generated arrays.
 */
function annotateLeaves(
  tree: SubnetNode,
  leaves: SubnetNode[],
  tagSets: UseCaseTag[][],
  azSets: (string | null)[],
  accountSets: (string | null)[]
): SubnetNode {
  // Build a map of leaf ID -> annotations
  const annotations = new Map<string, { tags: UseCaseTag[]; az: string | null; account: string | null }>();
  for (let i = 0; i < leaves.length; i++) {
    annotations.set(leaves[i].id, {
      tags: tagSets[i % tagSets.length] || [],
      az: azSets[i % azSets.length] || null,
      account: accountSets[i % accountSets.length] || null,
    });
  }

  return applyAnnotations(tree, annotations);
}

function applyAnnotations(
  tree: SubnetNode,
  annotations: Map<string, { tags: UseCaseTag[]; az: string | null; account: string | null }>
): SubnetNode {
  if (tree.children === null) {
    const ann = annotations.get(tree.id);
    if (ann) {
      return {
        ...tree,
        tags: ann.tags,
        availabilityZone: ann.az,
        workloadAccount: ann.account,
      };
    }
    return tree;
  }

  const [left, right] = tree.children;
  return {
    ...tree,
    children: [applyAnnotations(left, annotations), applyAnnotations(right, annotations)],
  };
}

// === Property Tests ===

/**
 * Feature: cloud-ipam-webapp, Property 20: Summary subnet count correctness
 * Validates: Requirements 10.1
 *
 * For any subnet tree, the summary's totalSubnets SHALL equal the count of leaf nodes
 * in the tree, subnetsByTag counts SHALL equal the actual number of leaves with each tag,
 * and subnetsByAZ counts SHALL equal the actual number of leaves assigned to each
 * availability zone.
 */
describe('Property 20: Summary subnet count correctness', () => {
  it('totalSubnets equals the count of leaf nodes in the tree', () => {
    fc.assert(
      fc.property(subnetTreeArb, profileArb, (tree, profile) => {
        const summary = computeSummary(tree, profile);
        const leaves = getLeaves(tree);

        expect(summary.totalSubnets).toBe(leaves.length);
      }),
      { numRuns: 100 }
    );
  });

  it('subnetsByTag counts match actual leaf tag counts', () => {
    fc.assert(
      fc.property(subnetTreeArb, profileArb, (tree, profile) => {
        const summary = computeSummary(tree, profile);
        const leaves = getLeaves(tree);

        // Compute expected tag counts manually
        const expectedTagCounts = new Map<string, number>();
        for (const leaf of leaves) {
          for (const tag of leaf.tags) {
            expectedTagCounts.set(tag.name, (expectedTagCounts.get(tag.name) || 0) + 1);
          }
        }

        // Verify summary matches expected
        expect(summary.subnetsByTag.size).toBe(expectedTagCounts.size);
        for (const [tagName, count] of expectedTagCounts) {
          expect(summary.subnetsByTag.get(tagName)).toBe(count);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('subnetsByAZ counts match actual leaf AZ counts', () => {
    fc.assert(
      fc.property(subnetTreeArb, profileArb, (tree, profile) => {
        const summary = computeSummary(tree, profile);
        const leaves = getLeaves(tree);

        // Compute expected AZ counts manually
        const expectedAZCounts = new Map<string, number>();
        for (const leaf of leaves) {
          if (leaf.availabilityZone) {
            expectedAZCounts.set(leaf.availabilityZone, (expectedAZCounts.get(leaf.availabilityZone) || 0) + 1);
          }
        }

        // Verify summary matches expected
        expect(summary.subnetsByAZ.size).toBe(expectedAZCounts.size);
        for (const [az, count] of expectedAZCounts) {
          expect(summary.subnetsByAZ.get(az)).toBe(count);
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: cloud-ipam-webapp, Property 21: Summary usable IP total correctness
 * Validates: Requirements 10.4
 *
 * For any subnet tree and active cloud provider profile, the summary's totalUsableIPs
 * SHALL equal the sum of max(0, 2^(32-leaf.prefix) - reservedCount) across all leaf subnets.
 */
describe('Property 21: Summary usable IP total correctness', () => {
  it('totalUsableIPs equals sum of max(0, 2^(32-prefix) - reservedCount) for all leaves', () => {
    fc.assert(
      fc.property(subnetTreeArb, profileArb, (tree, profile) => {
        const summary = computeSummary(tree, profile);
        const leaves = getLeaves(tree);

        // Compute expected total usable IPs manually
        let expectedTotal = 0;
        for (const leaf of leaves) {
          const totalAddresses = Math.pow(2, 32 - leaf.cidr.prefixLength);
          expectedTotal += Math.max(0, totalAddresses - profile.reservedIPs);
        }

        expect(summary.totalUsableIPs).toBe(expectedTotal);
      }),
      { numRuns: 100 }
    );
  });

  it('totalUsableIPs matches sum of computeSubnetInfo usableHosts for all leaves', () => {
    fc.assert(
      fc.property(subnetTreeArb, profileArb, (tree, profile) => {
        const summary = computeSummary(tree, profile);
        const leaves = getLeaves(tree);

        // Compute using computeSubnetInfo (same method the implementation uses)
        let expectedTotal = 0;
        for (const leaf of leaves) {
          const info = computeSubnetInfo(leaf.cidr, profile.reservedIPs);
          expectedTotal += info.usableHosts;
        }

        expect(summary.totalUsableIPs).toBe(expectedTotal);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: cloud-ipam-webapp, Property 22: Summary provider limit warning
 * Validates: Requirements 10.2
 *
 * For any subnet tree and cloud provider profile, a limit warning SHALL be produced
 * if and only if the count of leaf subnets exceeds the profile's subnetLimit, and the
 * warning SHALL contain the correct current count and maximum allowed.
 */
describe('Property 22: Summary provider limit warning', () => {
  it('limitWarning is produced iff leaf count > profile.subnetLimit', () => {
    fc.assert(
      fc.property(subnetTreeArb, profileArb, (tree, profile) => {
        const summary = computeSummary(tree, profile);
        const leaves = getLeaves(tree);
        const leafCount = leaves.length;

        if (leafCount > profile.subnetLimit) {
          expect(summary.limitWarning).not.toBeNull();
        } else {
          expect(summary.limitWarning).toBeNull();
        }
      }),
      { numRuns: 100 }
    );
  });

  it('limitWarning contains correct currentCount and maxAllowed', () => {
    fc.assert(
      fc.property(subnetTreeArb, profileArb, (tree, profile) => {
        const summary = computeSummary(tree, profile);
        const leaves = getLeaves(tree);
        const leafCount = leaves.length;

        if (summary.limitWarning !== null) {
          expect(summary.limitWarning.currentCount).toBe(leafCount);
          expect(summary.limitWarning.maxAllowed).toBe(profile.subnetLimit);
          expect(summary.limitWarning.providerName).toBe(profile.displayName);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('no warning when leaf count equals the limit exactly', () => {
    fc.assert(
      fc.property(subnetTreeArb, (tree) => {
        const leaves = getLeaves(tree);
        // Create a profile where the limit equals the leaf count
        const profile: CloudProviderProfile = {
          cloudId: 'aws',
          displayName: 'Test Provider',
          reservedIPs: 5,
          reservedReasons: [],
          subnetLimit: leaves.length, // exactly at limit
          defaultTags: [],
          accentColor: '#FF9900',
          iconPath: '/icons/aws.svg',
        };

        const summary = computeSummary(tree, profile);
        expect(summary.limitWarning).toBeNull();
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: cloud-ipam-webapp, Property 23: Summary workload account breakdown
 * Validates: Requirements 10.5
 *
 * For any subnet tree with workload account assignments, the account breakdown SHALL
 * correctly partition leaves by account, and each account's usableIPs SHALL equal the
 * sum of usable hosts for its assigned leaves.
 */
describe('Property 23: Summary workload account breakdown', () => {
  it('account breakdown correctly partitions leaves by account', () => {
    fc.assert(
      fc.property(subnetTreeArb, profileArb, (tree, profile) => {
        const summary = computeSummary(tree, profile);
        const leaves = getLeaves(tree);

        // Compute expected account partition manually
        const expectedAccounts = new Map<string, number>();
        for (const leaf of leaves) {
          if (leaf.workloadAccount) {
            expectedAccounts.set(leaf.workloadAccount, (expectedAccounts.get(leaf.workloadAccount) || 0) + 1);
          }
        }

        // Verify breakdown has correct number of accounts
        expect(summary.accountBreakdown.length).toBe(expectedAccounts.size);

        // Verify each account's subnet count
        for (const allocation of summary.accountBreakdown) {
          expect(expectedAccounts.get(allocation.account)).toBe(allocation.subnetCount);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('each account usableIPs equals sum of usable hosts for its assigned leaves', () => {
    fc.assert(
      fc.property(subnetTreeArb, profileArb, (tree, profile) => {
        const summary = computeSummary(tree, profile);
        const leaves = getLeaves(tree);

        // Compute expected usable IPs per account
        const expectedIPs = new Map<string, number>();
        for (const leaf of leaves) {
          if (leaf.workloadAccount) {
            const info = computeSubnetInfo(leaf.cidr, profile.reservedIPs);
            expectedIPs.set(leaf.workloadAccount, (expectedIPs.get(leaf.workloadAccount) || 0) + info.usableHosts);
          }
        }

        // Verify each account's usable IPs
        for (const allocation of summary.accountBreakdown) {
          expect(allocation.usableIPs).toBe(expectedIPs.get(allocation.account));
        }
      }),
      { numRuns: 100 }
    );
  });

  it('account percentageOfTotal sums correctly relative to totalUsableIPs', () => {
    fc.assert(
      fc.property(subnetTreeArb, profileArb, (tree, profile) => {
        const summary = computeSummary(tree, profile);

        // Each account's percentageOfTotal should be (account usableIPs / totalUsableIPs) * 100
        for (const allocation of summary.accountBreakdown) {
          if (summary.totalUsableIPs > 0) {
            const expectedPercentage = Math.round((allocation.usableIPs / summary.totalUsableIPs) * 1000) / 10;
            expect(allocation.percentageOfTotal).toBe(expectedPercentage);
          } else {
            expect(allocation.percentageOfTotal).toBe(0);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: cloud-ipam-webapp, Property 24: Allocation percentage correctness
 * Validates: Requirements 10.3
 *
 * For any subnet tree, the allocation percentage SHALL equal (sum of leaf subnet total
 * addresses / root subnet total addresses) × 100, rounded to one decimal place.
 */
describe('Property 24: Allocation percentage correctness', () => {
  it('allocationPercentage equals (sum of leaf addresses / root addresses) * 100 rounded to 1 decimal', () => {
    fc.assert(
      fc.property(subnetTreeArb, profileArb, (tree, profile) => {
        const summary = computeSummary(tree, profile);
        const leaves = getLeaves(tree);

        // Compute expected allocation percentage
        const rootTotalAddresses = Math.pow(2, 32 - tree.cidr.prefixLength);
        const leafTotalAddresses = leaves.reduce(
          (sum, leaf) => sum + Math.pow(2, 32 - leaf.cidr.prefixLength),
          0
        );
        const expectedPercentage = Math.round((leafTotalAddresses / rootTotalAddresses) * 1000) / 10;

        expect(summary.allocationPercentage).toBe(expectedPercentage);
      }),
      { numRuns: 100 }
    );
  });

  it('allocationPercentage is 100.0 for a single leaf tree (root is the only leaf)', () => {
    // A tree with no splits: the root is the only leaf, so allocation = 100%
    const singleLeafTreeArb = fc.integer({ min: 8, max: 30 }).map(prefix => {
      const mask = prefixToMask(prefix);
      const network = (0x0A000000 & mask) >>> 0;
      return {
        id: 'root',
        cidr: { networkAddress: { bits: network }, prefixLength: prefix },
        children: null,
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      } as SubnetNode;
    });

    fc.assert(
      fc.property(singleLeafTreeArb, profileArb, (tree, profile) => {
        const summary = computeSummary(tree, profile);
        expect(summary.allocationPercentage).toBe(100.0);
      }),
      { numRuns: 100 }
    );
  });

  it('allocationPercentage is 100.0 for a fully split tree (all space allocated to leaves)', () => {
    // When a tree is built only by splitting (no unallocated space), all leaves
    // together cover the root's full address space, so allocation = 100%
    fc.assert(
      fc.property(subnetTreeArb, profileArb, (tree, profile) => {
        // Our tree generator only splits existing leaves, so all space is always allocated
        const summary = computeSummary(tree, profile);
        expect(summary.allocationPercentage).toBe(100.0);
      }),
      { numRuns: 100 }
    );
  });
});
