import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { reconcileTags } from './cloud-change';
import { getProfile, getAvailableTags } from './cloud-profiles';
import type { SubnetNode, UseCaseTag, TargetCloud } from '../core/types';

/**
 * Feature: cloud-ipam-webapp, Property 2: Cloud change preserves tag intersection
 *
 * For any set of tagged subnets and any two cloud profiles (old and new), after switching
 * from old to new Target_Cloud, the remaining tags on each subnet SHALL equal the
 * intersection of the subnet's previous tags and the new profile's available tag set.
 *
 * **Validates: Requirements 1.7**
 */
describe('Property 2: Cloud change preserves tag intersection', () => {
  // --- Generators ---

  const targetCloudArb = fc.constantFrom<TargetCloud>('aws', 'azure', 'gcp', 'private');

  /** Generate a pair of different cloud profiles */
  const differentCloudPairArb = fc
    .tuple(targetCloudArb, targetCloudArb)
    .filter(([a, b]) => a !== b);

  /** Generate custom tags (shared across both profiles) */
  const customTagsArb = fc.array(
    fc.integer({ min: 1, max: 50 }).map(
      (i) =>
        ({
          id: `custom-${i}`,
          name: `custom-tag-${i}`,
          isCustom: true,
          color: `#${(0xCC0000 + i * 0x0202).toString(16).padStart(6, '0').slice(0, 6)}`,
        }) as UseCaseTag
    ),
    { minLength: 0, maxLength: 5 }
  );

  /** Generate a leaf node with a random subset of the old profile's available tags */
  function leafNodeArb(availableTags: UseCaseTag[]): fc.Arbitrary<SubnetNode> {
    return fc
      .record({
        id: fc.uuid(),
        tagIndices: fc.array(
          fc.integer({ min: 0, max: Math.max(0, availableTags.length - 1) }),
          { minLength: 0, maxLength: Math.min(5, availableTags.length) }
        ),
      })
      .map(({ id, tagIndices }) => {
        // Deduplicate indices to get unique tags
        const uniqueIndices = [...new Set(tagIndices)].slice(0, 5);
        const tags = uniqueIndices.map((i) => availableTags[i]);
        return {
          id,
          cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 24 },
          children: null,
          tags,
          workloadAccount: null,
          availabilityZone: null,
          label: null,
        } as SubnetNode;
      });
  }

  /** Generate a tree of leaf nodes (flat structure with a parent and two leaf children) */
  function treeWithLeavesArb(availableTags: UseCaseTag[]): fc.Arbitrary<SubnetNode> {
    if (availableTags.length === 0) {
      // If no tags available, just return a single leaf
      return fc.uuid().map(
        (id) =>
          ({
            id,
            cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 16 },
            children: null,
            tags: [],
            workloadAccount: null,
            availabilityZone: null,
            label: null,
          }) as SubnetNode
      );
    }

    return fc
      .tuple(fc.uuid(), leafNodeArb(availableTags), leafNodeArb(availableTags))
      .map(([parentId, left, right]) => ({
        id: parentId,
        cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 16 },
        children: [
          { ...left, cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 17 } },
          { ...right, cidr: { networkAddress: { bits: 0x0A800000 }, prefixLength: 17 } },
        ] as readonly [SubnetNode, SubnetNode],
        tags: [] as readonly UseCaseTag[],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      }));
  }

  /** Collect all leaf nodes from a tree */
  function getLeaves(node: SubnetNode): SubnetNode[] {
    if (node.children === null) return [node];
    return [...getLeaves(node.children[0]), ...getLeaves(node.children[1])];
  }

  // --- Property Tests ---

  it('after reconciliation, every remaining tag on each leaf is in the new profile available tag set', () => {
    fc.assert(
      fc.property(
        differentCloudPairArb,
        customTagsArb,
        ([oldCloud, newCloud], customTags) => {
          const oldProfile = getProfile(oldCloud);
          const newProfile = getProfile(newCloud);
          const oldAvailableTags = getAvailableTags(oldProfile, customTags);

          // Generate a tree using the chain approach
          const tree = fc.sample(treeWithLeavesArb(oldAvailableTags), 1)[0];

          const { tree: reconciledTree } = reconcileTags(tree, oldProfile, newProfile, customTags);

          // Get the new available tag IDs
          const newAvailableTags = getAvailableTags(newProfile, customTags);
          const newTagIds = new Set(newAvailableTags.map((t) => t.id));

          // Every remaining tag on each leaf must be in the new profile's available set
          const leaves = getLeaves(reconciledTree);
          for (const leaf of leaves) {
            for (const tag of leaf.tags) {
              expect(newTagIds.has(tag.id)).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('after reconciliation, no tag that was in both old and new profiles is removed', () => {
    fc.assert(
      fc.property(
        differentCloudPairArb,
        customTagsArb,
        ([oldCloud, newCloud], customTags) => {
          const oldProfile = getProfile(oldCloud);
          const newProfile = getProfile(newCloud);
          const oldAvailableTags = getAvailableTags(oldProfile, customTags);

          const tree = fc.sample(treeWithLeavesArb(oldAvailableTags), 1)[0];

          // Compute the intersection of old and new available tag IDs
          const newAvailableTags = getAvailableTags(newProfile, customTags);
          const newTagIds = new Set(newAvailableTags.map((t) => t.id));
          const intersectionIds = new Set(
            oldAvailableTags.filter((t) => newTagIds.has(t.id)).map((t) => t.id)
          );

          // Get leaves before reconciliation
          const leavesBefore = getLeaves(tree);

          const { tree: reconciledTree } = reconcileTags(tree, oldProfile, newProfile, customTags);

          // Get leaves after reconciliation
          const leavesAfter = getLeaves(reconciledTree);

          // For each leaf, tags that were in the intersection should still be present
          for (let i = 0; i < leavesBefore.length; i++) {
            const beforeTags = leavesBefore[i].tags.filter((t) => intersectionIds.has(t.id));
            const afterTagIds = new Set(leavesAfter[i].tags.map((t) => t.id));

            for (const tag of beforeTags) {
              expect(afterTagIds.has(tag.id)).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('after reconciliation, every tag that was only in the old profile is removed', () => {
    fc.assert(
      fc.property(
        differentCloudPairArb,
        customTagsArb,
        ([oldCloud, newCloud], customTags) => {
          const oldProfile = getProfile(oldCloud);
          const newProfile = getProfile(newCloud);
          const oldAvailableTags = getAvailableTags(oldProfile, customTags);

          const tree = fc.sample(treeWithLeavesArb(oldAvailableTags), 1)[0];

          // Compute tags only in old profile (not in new)
          const newAvailableTags = getAvailableTags(newProfile, customTags);
          const newTagIds = new Set(newAvailableTags.map((t) => t.id));
          const oldOnlyIds = new Set(
            oldAvailableTags.filter((t) => !newTagIds.has(t.id)).map((t) => t.id)
          );

          const { tree: reconciledTree } = reconcileTags(tree, oldProfile, newProfile, customTags);

          // After reconciliation, no leaf should have tags that were only in the old profile
          const leavesAfter = getLeaves(reconciledTree);
          for (const leaf of leavesAfter) {
            for (const tag of leaf.tags) {
              expect(oldOnlyIds.has(tag.id)).toBe(false);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
