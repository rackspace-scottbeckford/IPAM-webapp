import { describe, it, expect, beforeEach } from 'vitest';
import {
  canSplit, split, canJoin, join, generateId, resetIdCounter,
  getLeaves, findNode, assignTag, removeTag,
  setWorkloadAccount, setAvailabilityZone, setLabel,
} from './tree-operations';
import { ipToNumber } from './subnet-calculator';
import type { SubnetNode, SplitError, JoinError, UseCaseTag, TagError } from './types';

function makeLeafNode(networkBits: number, prefixLength: number, id = 'test-node'): SubnetNode {
  return {
    id,
    cidr: { networkAddress: { bits: networkBits }, prefixLength },
    children: null,
    tags: [],
    workloadAccount: null,
    availabilityZone: null,
    label: null,
  };
}

describe('tree-operations', () => {
  beforeEach(() => {
    resetIdCounter();
  });

  describe('generateId', () => {
    it('generates unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('generates string IDs starting with "node-"', () => {
      const id = generateId();
      expect(id).toMatch(/^node-/);
    });
  });

  describe('canSplit', () => {
    it('returns true for a leaf node with prefix < 30', () => {
      const node = makeLeafNode(ipToNumber('10.0.0.0'), 16);
      expect(canSplit(node)).toBe(true);
    });

    it('returns true for a leaf node with prefix 29', () => {
      const node = makeLeafNode(ipToNumber('10.0.0.0'), 29);
      expect(canSplit(node)).toBe(true);
    });

    it('returns false for a leaf node with prefix 30', () => {
      const node = makeLeafNode(ipToNumber('10.0.0.0'), 30);
      expect(canSplit(node)).toBe(false);
    });

    it('returns false for a non-leaf node (has children)', () => {
      const child1 = makeLeafNode(ipToNumber('10.0.0.0'), 17, 'child-1');
      const child2 = makeLeafNode(ipToNumber('10.0.128.0'), 17, 'child-2');
      const parent: SubnetNode = {
        id: 'parent',
        cidr: { networkAddress: { bits: ipToNumber('10.0.0.0') }, prefixLength: 16 },
        children: [child1, child2],
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };
      expect(canSplit(parent)).toBe(false);
    });

    it('returns false for a leaf node with prefix 8 (can split, prefix < 30)', () => {
      const node = makeLeafNode(ipToNumber('10.0.0.0'), 8);
      expect(canSplit(node)).toBe(true);
    });
  });

  describe('split', () => {
    it('splits a /16 leaf into two /17 children with correct network addresses', () => {
      const node = makeLeafNode(ipToNumber('10.0.0.0'), 16);
      const result = split(node);

      // Should not be an error
      expect(Array.isArray(result)).toBe(true);
      const [first, second] = result as [SubnetNode, SubnetNode];

      // Both children have prefix 17
      expect(first.cidr.prefixLength).toBe(17);
      expect(second.cidr.prefixLength).toBe(17);

      // First child has same network address as parent (10.0.0.0)
      expect(first.cidr.networkAddress.bits).toBe(ipToNumber('10.0.0.0'));

      // Second child has network address 10.0.128.0 (offset by 2^(32-17) = 2^15 = 32768)
      expect(second.cidr.networkAddress.bits).toBe(ipToNumber('10.0.128.0'));

      // Both are leaf nodes
      expect(first.children).toBeNull();
      expect(second.children).toBeNull();

      // Both have empty assignments
      expect(first.tags).toEqual([]);
      expect(second.tags).toEqual([]);
      expect(first.workloadAccount).toBeNull();
      expect(second.workloadAccount).toBeNull();
      expect(first.availabilityZone).toBeNull();
      expect(second.availabilityZone).toBeNull();
      expect(first.label).toBeNull();
      expect(second.label).toBeNull();
    });

    it('splits a /24 leaf into two /25 children', () => {
      const node = makeLeafNode(ipToNumber('192.168.1.0'), 24);
      const result = split(node);

      expect(Array.isArray(result)).toBe(true);
      const [first, second] = result as [SubnetNode, SubnetNode];

      expect(first.cidr.prefixLength).toBe(25);
      expect(second.cidr.prefixLength).toBe(25);

      // First child: 192.168.1.0
      expect(first.cidr.networkAddress.bits).toBe(ipToNumber('192.168.1.0'));
      // Second child: 192.168.1.128 (offset by 2^(32-25) = 128)
      expect(second.cidr.networkAddress.bits).toBe(ipToNumber('192.168.1.128'));
    });

    it('returns SplitError when splitting a /30 node', () => {
      const node = makeLeafNode(ipToNumber('10.0.0.0'), 30);
      const result = split(node);

      expect(Array.isArray(result)).toBe(false);
      const error = result as SplitError;
      expect(error.type).toBe('max_depth');
      expect(error.message).toContain('/30');
    });

    it('returns SplitError when splitting a non-leaf node', () => {
      const child1 = makeLeafNode(ipToNumber('10.0.0.0'), 17, 'child-1');
      const child2 = makeLeafNode(ipToNumber('10.128.0.0'), 17, 'child-2');
      const parent: SubnetNode = {
        id: 'parent',
        cidr: { networkAddress: { bits: ipToNumber('10.0.0.0') }, prefixLength: 16 },
        children: [child1, child2],
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };
      const result = split(parent);

      expect(Array.isArray(result)).toBe(false);
      const error = result as SplitError;
      expect(error.type).toBe('max_depth');
    });

    it('generates unique IDs for child nodes', () => {
      const node = makeLeafNode(ipToNumber('10.0.0.0'), 16);
      const result = split(node);

      expect(Array.isArray(result)).toBe(true);
      const [first, second] = result as [SubnetNode, SubnetNode];

      expect(first.id).not.toBe(second.id);
      expect(first.id).not.toBe(node.id);
      expect(second.id).not.toBe(node.id);
    });

    it('splits a /29 leaf into two /30 children', () => {
      const node = makeLeafNode(ipToNumber('10.0.0.0'), 29);
      const result = split(node);

      expect(Array.isArray(result)).toBe(true);
      const [first, second] = result as [SubnetNode, SubnetNode];

      expect(first.cidr.prefixLength).toBe(30);
      expect(second.cidr.prefixLength).toBe(30);

      // First child: 10.0.0.0
      expect(first.cidr.networkAddress.bits).toBe(ipToNumber('10.0.0.0'));
      // Second child: 10.0.0.4 (offset by 2^(32-30) = 4)
      expect(second.cidr.networkAddress.bits).toBe(ipToNumber('10.0.0.4'));
    });
  });

  describe('canJoin', () => {
    it('returns true when parent has two leaf children', () => {
      const child1 = makeLeafNode(ipToNumber('10.0.0.0'), 17, 'child-1');
      const child2 = makeLeafNode(ipToNumber('10.0.128.0'), 17, 'child-2');
      const parent: SubnetNode = {
        id: 'parent',
        cidr: { networkAddress: { bits: ipToNumber('10.0.0.0') }, prefixLength: 16 },
        children: [child1, child2],
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };
      expect(canJoin(parent)).toBe(true);
    });

    it('returns false when node is a leaf (no children)', () => {
      const node = makeLeafNode(ipToNumber('10.0.0.0'), 16);
      expect(canJoin(node)).toBe(false);
    });

    it('returns false when left child has children', () => {
      const grandchild1 = makeLeafNode(ipToNumber('10.0.0.0'), 18, 'gc-1');
      const grandchild2 = makeLeafNode(ipToNumber('10.0.64.0'), 18, 'gc-2');
      const child1: SubnetNode = {
        id: 'child-1',
        cidr: { networkAddress: { bits: ipToNumber('10.0.0.0') }, prefixLength: 17 },
        children: [grandchild1, grandchild2],
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };
      const child2 = makeLeafNode(ipToNumber('10.0.128.0'), 17, 'child-2');
      const parent: SubnetNode = {
        id: 'parent',
        cidr: { networkAddress: { bits: ipToNumber('10.0.0.0') }, prefixLength: 16 },
        children: [child1, child2],
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };
      expect(canJoin(parent)).toBe(false);
    });

    it('returns false when right child has children', () => {
      const child1 = makeLeafNode(ipToNumber('10.0.0.0'), 17, 'child-1');
      const grandchild1 = makeLeafNode(ipToNumber('10.0.128.0'), 18, 'gc-1');
      const grandchild2 = makeLeafNode(ipToNumber('10.0.192.0'), 18, 'gc-2');
      const child2: SubnetNode = {
        id: 'child-2',
        cidr: { networkAddress: { bits: ipToNumber('10.0.128.0') }, prefixLength: 17 },
        children: [grandchild1, grandchild2],
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };
      const parent: SubnetNode = {
        id: 'parent',
        cidr: { networkAddress: { bits: ipToNumber('10.0.0.0') }, prefixLength: 16 },
        children: [child1, child2],
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };
      expect(canJoin(parent)).toBe(false);
    });
  });

  describe('join', () => {
    it('joins a parent with two leaf children back into a leaf', () => {
      const child1 = makeLeafNode(ipToNumber('10.0.0.0'), 17, 'child-1');
      const child2 = makeLeafNode(ipToNumber('10.0.128.0'), 17, 'child-2');
      const parent: SubnetNode = {
        id: 'parent',
        cidr: { networkAddress: { bits: ipToNumber('10.0.0.0') }, prefixLength: 16 },
        children: [child1, child2],
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };

      const result = join(parent);

      // Should not be an error
      expect('type' in (result as JoinError)).toBe(false);
      const joined = result as SubnetNode;

      // Preserves parent's ID and CIDR
      expect(joined.id).toBe('parent');
      expect(joined.cidr.networkAddress.bits).toBe(ipToNumber('10.0.0.0'));
      expect(joined.cidr.prefixLength).toBe(16);

      // Becomes a leaf
      expect(joined.children).toBeNull();

      // Assignments are cleared
      expect(joined.tags).toEqual([]);
      expect(joined.workloadAccount).toBeNull();
      expect(joined.availabilityZone).toBeNull();
      expect(joined.label).toBeNull();
    });

    it('discards child assignments when joining', () => {
      const child1: SubnetNode = {
        id: 'child-1',
        cidr: { networkAddress: { bits: ipToNumber('10.0.0.0') }, prefixLength: 17 },
        children: null,
        tags: [{ id: 'tag-1', name: 'workload', isCustom: false, color: '#FF0000' }],
        workloadAccount: 'account-1',
        availabilityZone: 'us-east-1a',
        label: 'Production',
      };
      const child2: SubnetNode = {
        id: 'child-2',
        cidr: { networkAddress: { bits: ipToNumber('10.0.128.0') }, prefixLength: 17 },
        children: null,
        tags: [{ id: 'tag-2', name: 'shared-services', isCustom: false, color: '#00FF00' }],
        workloadAccount: 'account-2',
        availabilityZone: 'us-east-1b',
        label: 'Staging',
      };
      const parent: SubnetNode = {
        id: 'parent',
        cidr: { networkAddress: { bits: ipToNumber('10.0.0.0') }, prefixLength: 16 },
        children: [child1, child2],
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };

      const result = join(parent) as SubnetNode;

      expect(result.children).toBeNull();
      expect(result.tags).toEqual([]);
      expect(result.workloadAccount).toBeNull();
      expect(result.availabilityZone).toBeNull();
      expect(result.label).toBeNull();
    });

    it('returns JoinError when node is a leaf', () => {
      const node = makeLeafNode(ipToNumber('10.0.0.0'), 16);
      const result = join(node);

      const error = result as JoinError;
      expect(error.type).toBe('not_leaf_children');
      expect(error.message).toContain('not both leaf nodes');
    });

    it('returns JoinError when children are not both leaves', () => {
      const grandchild1 = makeLeafNode(ipToNumber('10.0.0.0'), 18, 'gc-1');
      const grandchild2 = makeLeafNode(ipToNumber('10.0.64.0'), 18, 'gc-2');
      const child1: SubnetNode = {
        id: 'child-1',
        cidr: { networkAddress: { bits: ipToNumber('10.0.0.0') }, prefixLength: 17 },
        children: [grandchild1, grandchild2],
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };
      const child2 = makeLeafNode(ipToNumber('10.0.128.0'), 17, 'child-2');
      const parent: SubnetNode = {
        id: 'parent',
        cidr: { networkAddress: { bits: ipToNumber('10.0.0.0') }, prefixLength: 16 },
        children: [child1, child2],
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };

      const result = join(parent);
      const error = result as JoinError;
      expect(error.type).toBe('not_leaf_children');
    });
  });

  describe('split-then-join round trip', () => {
    it('splitting and joining restores the original CIDR', () => {
      const original = makeLeafNode(ipToNumber('172.16.0.0'), 20, 'original');
      const children = split(original) as [SubnetNode, SubnetNode];

      // Create a parent with the children
      const parentWithChildren: SubnetNode = {
        ...original,
        children,
      };

      const restored = join(parentWithChildren) as SubnetNode;

      expect(restored.cidr.networkAddress.bits).toBe(original.cidr.networkAddress.bits);
      expect(restored.cidr.prefixLength).toBe(original.cidr.prefixLength);
      expect(restored.children).toBeNull();
      expect(restored.id).toBe(original.id);
    });
  });

  describe('getLeaves', () => {
    it('returns the node itself when it is a leaf', () => {
      const leaf = makeLeafNode(ipToNumber('10.0.0.0'), 24, 'leaf-1');
      const leaves = getLeaves(leaf);
      expect(leaves).toHaveLength(1);
      expect(leaves[0].id).toBe('leaf-1');
    });

    it('returns both children when root has two leaf children', () => {
      const child1 = makeLeafNode(ipToNumber('10.0.0.0'), 17, 'child-1');
      const child2 = makeLeafNode(ipToNumber('10.0.128.0'), 17, 'child-2');
      const root: SubnetNode = {
        id: 'root',
        cidr: { networkAddress: { bits: ipToNumber('10.0.0.0') }, prefixLength: 16 },
        children: [child1, child2],
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };
      const leaves = getLeaves(root);
      expect(leaves).toHaveLength(2);
      expect(leaves.map((l) => l.id)).toEqual(['child-1', 'child-2']);
    });

    it('collects leaves from a multi-level tree', () => {
      const gc1 = makeLeafNode(ipToNumber('10.0.0.0'), 18, 'gc-1');
      const gc2 = makeLeafNode(ipToNumber('10.0.64.0'), 18, 'gc-2');
      const child1: SubnetNode = {
        id: 'child-1',
        cidr: { networkAddress: { bits: ipToNumber('10.0.0.0') }, prefixLength: 17 },
        children: [gc1, gc2],
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };
      const child2 = makeLeafNode(ipToNumber('10.0.128.0'), 17, 'child-2');
      const root: SubnetNode = {
        id: 'root',
        cidr: { networkAddress: { bits: ipToNumber('10.0.0.0') }, prefixLength: 16 },
        children: [child1, child2],
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };
      const leaves = getLeaves(root);
      expect(leaves).toHaveLength(3);
      expect(leaves.map((l) => l.id)).toEqual(['gc-1', 'gc-2', 'child-2']);
    });
  });

  describe('findNode', () => {
    it('finds the root node by id', () => {
      const root = makeLeafNode(ipToNumber('10.0.0.0'), 16, 'root');
      const found = findNode(root, 'root');
      expect(found).not.toBeNull();
      expect(found!.id).toBe('root');
    });

    it('finds a deeply nested node', () => {
      const gc1 = makeLeafNode(ipToNumber('10.0.0.0'), 18, 'gc-1');
      const gc2 = makeLeafNode(ipToNumber('10.0.64.0'), 18, 'gc-2');
      const child1: SubnetNode = {
        id: 'child-1',
        cidr: { networkAddress: { bits: ipToNumber('10.0.0.0') }, prefixLength: 17 },
        children: [gc1, gc2],
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };
      const child2 = makeLeafNode(ipToNumber('10.0.128.0'), 17, 'child-2');
      const root: SubnetNode = {
        id: 'root',
        cidr: { networkAddress: { bits: ipToNumber('10.0.0.0') }, prefixLength: 16 },
        children: [child1, child2],
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };
      const found = findNode(root, 'gc-2');
      expect(found).not.toBeNull();
      expect(found!.id).toBe('gc-2');
      expect(found!.cidr.prefixLength).toBe(18);
    });

    it('returns null for a non-existent id', () => {
      const root = makeLeafNode(ipToNumber('10.0.0.0'), 16, 'root');
      const found = findNode(root, 'does-not-exist');
      expect(found).toBeNull();
    });
  });

  describe('assignTag', () => {
    const makeTag = (id: string, name: string): UseCaseTag => ({
      id,
      name,
      isCustom: false,
      color: '#FF0000',
    });

    it('assigns a tag to a leaf node', () => {
      const root = makeLeafNode(ipToNumber('10.0.0.0'), 24, 'leaf-1');
      const tag = makeTag('tag-1', 'workload');
      const result = assignTag(root, 'leaf-1', tag);

      // Should not be an error
      expect('type' in (result as TagError)).toBe(false);
      const updated = result as SubnetNode;
      expect(updated.tags).toHaveLength(1);
      expect(updated.tags[0].id).toBe('tag-1');
    });

    it('fails to assign a tag to a non-leaf node', () => {
      const child1 = makeLeafNode(ipToNumber('10.0.0.0'), 17, 'child-1');
      const child2 = makeLeafNode(ipToNumber('10.0.128.0'), 17, 'child-2');
      const parent: SubnetNode = {
        id: 'parent',
        cidr: { networkAddress: { bits: ipToNumber('10.0.0.0') }, prefixLength: 16 },
        children: [child1, child2],
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };
      const tag = makeTag('tag-1', 'workload');
      const result = assignTag(parent, 'parent', tag);

      const error = result as TagError;
      expect(error.type).toBe('not_leaf');
    });

    it('fails when assigning a 6th tag', () => {
      const existingTags: UseCaseTag[] = Array.from({ length: 5 }, (_, i) => makeTag(`tag-${i}`, `tag${i}`));
      const leaf: SubnetNode = {
        ...makeLeafNode(ipToNumber('10.0.0.0'), 24, 'leaf-1'),
        tags: existingTags,
      };
      const newTag = makeTag('tag-5', 'extra');
      const result = assignTag(leaf, 'leaf-1', newTag);

      const error = result as TagError;
      expect(error.type).toBe('max_tags');
      expect(error.message).toContain('Maximum 5 tags');
    });

    it('returns error for non-existent node id', () => {
      const root = makeLeafNode(ipToNumber('10.0.0.0'), 24, 'leaf-1');
      const tag = makeTag('tag-1', 'workload');
      const result = assignTag(root, 'non-existent', tag);

      const error = result as TagError;
      expect(error.type).toBe('not_leaf');
    });
  });

  describe('removeTag', () => {
    it('removes a tag by id', () => {
      const tag1: UseCaseTag = { id: 'tag-1', name: 'workload', isCustom: false, color: '#FF0000' };
      const tag2: UseCaseTag = { id: 'tag-2', name: 'shared', isCustom: false, color: '#00FF00' };
      const leaf: SubnetNode = {
        ...makeLeafNode(ipToNumber('10.0.0.0'), 24, 'leaf-1'),
        tags: [tag1, tag2],
      };

      const result = removeTag(leaf, 'leaf-1', 'tag-1');
      expect(result.tags).toHaveLength(1);
      expect(result.tags[0].id).toBe('tag-2');
    });

    it('does nothing when tag id does not exist', () => {
      const tag1: UseCaseTag = { id: 'tag-1', name: 'workload', isCustom: false, color: '#FF0000' };
      const leaf: SubnetNode = {
        ...makeLeafNode(ipToNumber('10.0.0.0'), 24, 'leaf-1'),
        tags: [tag1],
      };

      const result = removeTag(leaf, 'leaf-1', 'non-existent-tag');
      expect(result.tags).toHaveLength(1);
      expect(result.tags[0].id).toBe('tag-1');
    });
  });

  describe('setWorkloadAccount', () => {
    it('sets a valid workload account', () => {
      const leaf = makeLeafNode(ipToNumber('10.0.0.0'), 24, 'leaf-1');
      const result = setWorkloadAccount(leaf, 'leaf-1', 'my-account');
      expect(result.workloadAccount).toBe('my-account');
    });

    it('clears workload account with null', () => {
      const leaf: SubnetNode = {
        ...makeLeafNode(ipToNumber('10.0.0.0'), 24, 'leaf-1'),
        workloadAccount: 'existing-account',
      };
      const result = setWorkloadAccount(leaf, 'leaf-1', null);
      expect(result.workloadAccount).toBeNull();
    });

    it('rejects empty string (too short)', () => {
      const leaf = makeLeafNode(ipToNumber('10.0.0.0'), 24, 'leaf-1');
      const result = setWorkloadAccount(leaf, 'leaf-1', '');
      // Should return original tree unchanged
      expect(result.workloadAccount).toBeNull();
    });

    it('rejects string longer than 64 characters', () => {
      const leaf = makeLeafNode(ipToNumber('10.0.0.0'), 24, 'leaf-1');
      const longString = 'a'.repeat(65);
      const result = setWorkloadAccount(leaf, 'leaf-1', longString);
      expect(result.workloadAccount).toBeNull();
    });

    it('accepts string of exactly 64 characters', () => {
      const leaf = makeLeafNode(ipToNumber('10.0.0.0'), 24, 'leaf-1');
      const maxString = 'a'.repeat(64);
      const result = setWorkloadAccount(leaf, 'leaf-1', maxString);
      expect(result.workloadAccount).toBe(maxString);
    });
  });

  describe('setAvailabilityZone', () => {
    it('sets a valid availability zone', () => {
      const leaf = makeLeafNode(ipToNumber('10.0.0.0'), 24, 'leaf-1');
      const result = setAvailabilityZone(leaf, 'leaf-1', 'us-east-1a');
      expect(result.availabilityZone).toBe('us-east-1a');
    });

    it('clears availability zone with null', () => {
      const leaf: SubnetNode = {
        ...makeLeafNode(ipToNumber('10.0.0.0'), 24, 'leaf-1'),
        availabilityZone: 'us-west-2b',
      };
      const result = setAvailabilityZone(leaf, 'leaf-1', null);
      expect(result.availabilityZone).toBeNull();
    });

    it('rejects empty string', () => {
      const leaf = makeLeafNode(ipToNumber('10.0.0.0'), 24, 'leaf-1');
      const result = setAvailabilityZone(leaf, 'leaf-1', '');
      expect(result.availabilityZone).toBeNull();
    });
  });

  describe('setLabel', () => {
    it('sets a valid label', () => {
      const leaf = makeLeafNode(ipToNumber('10.0.0.0'), 24, 'leaf-1');
      const result = setLabel(leaf, 'leaf-1', 'Production VPC');
      expect(result.label).toBe('Production VPC');
    });

    it('clears label with null', () => {
      const leaf: SubnetNode = {
        ...makeLeafNode(ipToNumber('10.0.0.0'), 24, 'leaf-1'),
        label: 'Old Label',
      };
      const result = setLabel(leaf, 'leaf-1', null);
      expect(result.label).toBeNull();
    });

    it('rejects string longer than 64 characters', () => {
      const leaf = makeLeafNode(ipToNumber('10.0.0.0'), 24, 'leaf-1');
      const longString = 'x'.repeat(65);
      const result = setLabel(leaf, 'leaf-1', longString);
      expect(result.label).toBeNull();
    });
  });
});
