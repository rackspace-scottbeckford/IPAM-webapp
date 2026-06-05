import { describe, it, expect } from 'vitest';
import { reconcileTags } from './cloud-change';
import { AWS_PROFILE, AZURE_PROFILE, GCP_PROFILE } from './cloud-profiles';
import type { SubnetNode, UseCaseTag } from '../core/types';

/**
 * Helper to create a leaf node with given tags.
 */
function makeLeaf(id: string, tags: UseCaseTag[] = []): SubnetNode {
  return {
    id,
    cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 24 },
    children: null,
    tags,
    workloadAccount: null,
    availabilityZone: null,
    label: null,
  };
}

/**
 * Helper to create a parent node with two leaf children.
 */
function makeParent(id: string, left: SubnetNode, right: SubnetNode): SubnetNode {
  return {
    id,
    cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 23 },
    children: [left, right],
    tags: [],
    workloadAccount: null,
    availabilityZone: null,
    label: null,
  };
}

describe('reconcileTags', () => {
  it('preserves tags present in both profiles', () => {
    // 'workload' exists in both AWS and Azure (different IDs though)
    // Use AWS tags on a leaf, switch to AWS (same profile) — all preserved
    const awsTag = AWS_PROFILE.defaultTags[3]; // 'workload' aws-wl
    const leaf = makeLeaf('leaf-1', [awsTag]);

    const result = reconcileTags(leaf, AWS_PROFILE, AWS_PROFILE, []);

    expect(result.tree.tags).toHaveLength(1);
    expect(result.tree.tags[0]).toBe(awsTag);
    expect(result.removedTags).toHaveLength(0);
  });

  it('removes tags only present in old profile', () => {
    // AWS 'transit-gateway' tag does not exist in Azure profile
    const awsTgw = AWS_PROFILE.defaultTags[0]; // 'transit-gateway'
    const leaf = makeLeaf('leaf-1', [awsTgw]);

    const result = reconcileTags(leaf, AWS_PROFILE, AZURE_PROFILE, []);

    expect(result.tree.tags).toHaveLength(0);
    expect(result.removedTags).toContain('transit-gateway');
  });

  it('custom tags are always preserved', () => {
    const customTag: UseCaseTag = {
      id: 'custom-1',
      name: 'my-custom-tag',
      isCustom: true,
      color: '#123456',
    };
    const awsTgw = AWS_PROFILE.defaultTags[0]; // 'transit-gateway'
    const leaf = makeLeaf('leaf-1', [awsTgw, customTag]);

    const result = reconcileTags(leaf, AWS_PROFILE, AZURE_PROFILE, [customTag]);

    // Custom tag preserved, AWS transit-gateway removed
    expect(result.tree.tags).toHaveLength(1);
    expect(result.tree.tags[0]).toBe(customTag);
    expect(result.removedTags).toContain('transit-gateway');
    expect(result.removedTags).not.toContain('my-custom-tag');
  });

  it('removedTags lists the names of removed tags', () => {
    const awsTgw = AWS_PROFILE.defaultTags[0]; // 'transit-gateway'
    const awsInsp = AWS_PROFILE.defaultTags[1]; // 'inspection'
    const leaf = makeLeaf('leaf-1', [awsTgw, awsInsp]);

    const result = reconcileTags(leaf, AWS_PROFILE, GCP_PROFILE, []);

    expect(result.removedTags).toContain('transit-gateway');
    expect(result.removedTags).toContain('inspection');
    expect(result.removedTags).toHaveLength(2);
  });

  it('tree structure is unchanged (only tags are modified)', () => {
    const awsTgw = AWS_PROFILE.defaultTags[0]; // 'transit-gateway'
    const leftLeaf = makeLeaf('left', [awsTgw]);
    const rightLeaf = makeLeaf('right', []);
    const parent = makeParent('parent', leftLeaf, rightLeaf);

    const result = reconcileTags(parent, AWS_PROFILE, AZURE_PROFILE, []);

    // Structure preserved
    expect(result.tree.id).toBe('parent');
    expect(result.tree.children).not.toBeNull();
    const [left, right] = result.tree.children!;
    expect(left.id).toBe('left');
    expect(right.id).toBe('right');
    expect(left.children).toBeNull();
    expect(right.children).toBeNull();

    // Left leaf had its tag removed
    expect(left.tags).toHaveLength(0);
    // Right leaf unchanged (no tags to remove)
    expect(right).toBe(rightLeaf);
  });

  it('returns the same tree reference when no tags need removal', () => {
    const leaf = makeLeaf('leaf-1', []);
    const result = reconcileTags(leaf, AWS_PROFILE, AZURE_PROFILE, []);

    // No tags to remove, tree should be the same reference
    expect(result.tree).toBe(leaf);
    expect(result.removedTags).toHaveLength(0);
  });

  it('deduplicates removed tag names across multiple leaves', () => {
    const awsTgw = AWS_PROFILE.defaultTags[0]; // 'transit-gateway'
    const leftLeaf = makeLeaf('left', [awsTgw]);
    const rightLeaf = makeLeaf('right', [awsTgw]);
    const parent = makeParent('parent', leftLeaf, rightLeaf);

    const result = reconcileTags(parent, AWS_PROFILE, AZURE_PROFILE, []);

    // 'transit-gateway' appears only once in removedTags even though two leaves had it
    expect(result.removedTags).toEqual(['transit-gateway']);
  });

  it('handles deeply nested trees', () => {
    const awsTgw = AWS_PROFILE.defaultTags[0]; // 'transit-gateway'
    const deepLeaf = makeLeaf('deep', [awsTgw]);
    const siblingLeaf = makeLeaf('sibling', []);
    const midParent = makeParent('mid', deepLeaf, siblingLeaf);
    const root: SubnetNode = {
      id: 'root',
      cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 22 },
      children: [midParent, makeLeaf('other', [])],
      tags: [],
      workloadAccount: null,
      availabilityZone: null,
      label: null,
    };

    const result = reconcileTags(root, AWS_PROFILE, AZURE_PROFILE, []);

    expect(result.removedTags).toContain('transit-gateway');
    // Verify the deep leaf lost its tag
    const mid = result.tree.children![0];
    const deep = mid.children![0];
    expect(deep.tags).toHaveLength(0);
  });
});
