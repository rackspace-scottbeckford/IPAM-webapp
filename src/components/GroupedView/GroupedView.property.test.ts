import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getLeaves } from '../../core/tree-operations';
import { prefixToMask } from '../../core/subnet-calculator';
import type { SubnetNode, UseCaseTag } from '../../core/types';

// === Grouping Logic (reimplemented for testing) ===

/**
 * Groups leaf subnets by their assigned Use_Case_Tags.
 * A leaf with multiple tags appears in multiple groups.
 * This mirrors the groupLeavesByTag function in GroupedView.tsx.
 */
function groupLeavesByTag(leaves: SubnetNode[]): Map<string, SubnetNode[]> {
  const groups = new Map<string, SubnetNode[]>();
  for (const leaf of leaves) {
    for (const tag of leaf.tags) {
      const existing = groups.get(tag.id) || [];
      existing.push(leaf);
      groups.set(tag.id, existing);
    }
  }
  return groups;
}

// === Generators ===

/**
 * Generator for use-case tags with unique IDs and colors.
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
 * Build a random subnet tree by starting with a root leaf and applying random splits.
 * Returns a tree with leaves annotated with random tags.
 */
const subnetTreeWithTagsArb: fc.Arbitrary<SubnetNode> = fc.integer({ min: 8, max: 24 }).chain(rootPrefix => {
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
        const splittableLeaves = leaves.filter(l => l.cidr.prefixLength < 30);
        if (splittableLeaves.length === 0) break;

        const targetIndex = splitSeeds[i] % splittableLeaves.length;
        const targetLeaf = splittableLeaves[targetIndex];

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
 * Feature: cloud-ipam-webapp, Property 16: Grouped view partitions tagged leaves correctly
 * Validates: Requirements 7.5
 *
 * For any subnet tree with tagged leaves, the grouped view SHALL contain every tagged
 * leaf subnet exactly once per assigned tag, and each group SHALL contain only subnets
 * that have that group's tag assigned.
 */
describe('Property 16: Grouped view partitions tagged leaves correctly', () => {
  it('every tagged leaf appears exactly once in each of its tag groups', () => {
    fc.assert(
      fc.property(subnetTreeWithTagsArb, (tree) => {
        const leaves = getLeaves(tree);
        const taggedLeaves = leaves.filter(l => l.tags.length > 0);
        const groups = groupLeavesByTag(leaves);

        // For each tagged leaf, verify it appears exactly once in each of its tag's groups
        for (const leaf of taggedLeaves) {
          for (const tag of leaf.tags) {
            const group = groups.get(tag.id);
            expect(group).toBeDefined();

            // Count occurrences of this leaf in the group
            const occurrences = group!.filter(s => s.id === leaf.id).length;
            expect(occurrences).toBe(1);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('each group contains only subnets that have that group tag assigned', () => {
    fc.assert(
      fc.property(subnetTreeWithTagsArb, (tree) => {
        const leaves = getLeaves(tree);
        const groups = groupLeavesByTag(leaves);

        // For each group, verify every subnet in it has the group's tag
        for (const [tagId, subnets] of groups) {
          for (const subnet of subnets) {
            const hasTag = subnet.tags.some(t => t.id === tagId);
            expect(hasTag).toBe(true);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('a leaf with N tags appears in exactly N groups', () => {
    fc.assert(
      fc.property(subnetTreeWithTagsArb, (tree) => {
        const leaves = getLeaves(tree);
        const taggedLeaves = leaves.filter(l => l.tags.length > 0);
        const groups = groupLeavesByTag(leaves);

        for (const leaf of taggedLeaves) {
          // Count how many groups contain this leaf
          let groupCount = 0;
          for (const [, subnets] of groups) {
            if (subnets.some(s => s.id === leaf.id)) {
              groupCount++;
            }
          }

          expect(groupCount).toBe(leaf.tags.length);
        }
      }),
      { numRuns: 100 }
    );
  });
});
