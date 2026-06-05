import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { canSplit, split, canJoin, join, assignTag } from './tree-operations';
import { prefixToMask } from './subnet-calculator';
import type { SubnetNode, UseCaseTag, TagError } from './types';

/**
 * Generator for leaf subnet nodes with prefix 8-29 and no assignments.
 * These are valid candidates for split operations.
 */
const leafNodeArb = fc.integer({ min: 8, max: 29 }).chain(prefix => {
  const mask = prefixToMask(prefix);
  return fc.integer({ min: 0, max: 0xFFFFFFFF }).map(ip => ({
    id: `test-${ip}-${prefix}`,
    cidr: { networkAddress: { bits: (ip & mask) >>> 0 }, prefixLength: prefix },
    children: null,
    tags: [],
    workloadAccount: null,
    availabilityZone: null,
    label: null,
  } as SubnetNode));
});

/**
 * Generator for leaf subnet nodes at prefix /30 (cannot be split further).
 */
const leafNodeAt30Arb = fc.integer({ min: 0, max: 0xFFFFFFFF }).map(ip => {
  const mask = prefixToMask(30);
  return {
    id: `test-${ip}-30`,
    cidr: { networkAddress: { bits: (ip & mask) >>> 0 }, prefixLength: 30 },
    children: null,
    tags: [],
    workloadAccount: null,
    availabilityZone: null,
    label: null,
  } as SubnetNode;
});

/**
 * Generator for non-leaf (internal) subnet nodes — nodes that have children.
 */
const nonLeafNodeArb = fc.integer({ min: 8, max: 28 }).chain(prefix => {
  const mask = prefixToMask(prefix);
  return fc.integer({ min: 0, max: 0xFFFFFFFF }).map(ip => {
    const networkBits = (ip & mask) >>> 0;
    const childPrefix = prefix + 1;
    const secondOffset = Math.pow(2, 32 - childPrefix);
    const secondNetwork = (networkBits + secondOffset) >>> 0;

    const firstChild: SubnetNode = {
      id: `child-1-${networkBits}`,
      cidr: { networkAddress: { bits: networkBits }, prefixLength: childPrefix },
      children: null,
      tags: [],
      workloadAccount: null,
      availabilityZone: null,
      label: null,
    };

    const secondChild: SubnetNode = {
      id: `child-2-${secondNetwork}`,
      cidr: { networkAddress: { bits: secondNetwork }, prefixLength: childPrefix },
      children: null,
      tags: [],
      workloadAccount: null,
      availabilityZone: null,
      label: null,
    };

    return {
      id: `test-parent-${networkBits}-${prefix}`,
      cidr: { networkAddress: { bits: networkBits }, prefixLength: prefix },
      children: [firstChild, secondChild] as readonly [SubnetNode, SubnetNode],
      tags: [],
      workloadAccount: null,
      availabilityZone: null,
      label: null,
    } as SubnetNode;
  });
});

/**
 * Feature: cloud-ipam-webapp, Property 6: Split produces valid binary subdivision
 * Validates: Requirements 3.1, 3.4
 *
 * For any leaf subnet node with prefix length P < 30, splitting SHALL produce
 * exactly two children where: each child has prefix P+1, the first child's
 * network address equals the parent's network address, the second child's
 * network address equals the parent's network address plus 2^(32-(P+1)),
 * and the two children's address ranges are non-overlapping and together
 * cover the parent's full range.
 */
describe('Property 6: Split produces valid binary subdivision', () => {
  it('split produces exactly two children with prefix P+1', () => {
    fc.assert(
      fc.property(leafNodeArb, (node) => {
        const result = split(node);

        // Should not be an error
        expect(Array.isArray(result)).toBe(true);
        if (!Array.isArray(result)) return;

        const [first, second] = result;
        const expectedPrefix = node.cidr.prefixLength + 1;

        expect(first.cidr.prefixLength).toBe(expectedPrefix);
        expect(second.cidr.prefixLength).toBe(expectedPrefix);
      }),
      { numRuns: 100 }
    );
  });

  it('first child network address equals parent network address', () => {
    fc.assert(
      fc.property(leafNodeArb, (node) => {
        const result = split(node);
        if (!Array.isArray(result)) return;

        const [first] = result;
        expect(first.cidr.networkAddress.bits).toBe(node.cidr.networkAddress.bits);
      }),
      { numRuns: 100 }
    );
  });

  it('second child network address equals parent + 2^(32-(P+1))', () => {
    fc.assert(
      fc.property(leafNodeArb, (node) => {
        const result = split(node);
        if (!Array.isArray(result)) return;

        const [, second] = result;
        const newPrefix = node.cidr.prefixLength + 1;
        const expectedSecondNetwork = (node.cidr.networkAddress.bits + Math.pow(2, 32 - newPrefix)) >>> 0;

        expect(second.cidr.networkAddress.bits).toBe(expectedSecondNetwork);
      }),
      { numRuns: 100 }
    );
  });

  it('children address ranges are non-overlapping', () => {
    fc.assert(
      fc.property(leafNodeArb, (node) => {
        const result = split(node);
        if (!Array.isArray(result)) return;

        const [first, second] = result;
        const childSize = Math.pow(2, 32 - first.cidr.prefixLength);

        // First child range: [first.network, first.network + childSize - 1]
        const firstEnd = (first.cidr.networkAddress.bits + childSize - 1) >>> 0;
        // Second child starts after first child ends
        const secondStart = second.cidr.networkAddress.bits;

        // Non-overlapping: first range ends before second range starts
        expect(firstEnd >>> 0).toBeLessThan(secondStart >>> 0);
      }),
      { numRuns: 100 }
    );
  });

  it('children together cover the parent full range', () => {
    fc.assert(
      fc.property(leafNodeArb, (node) => {
        const result = split(node);
        if (!Array.isArray(result)) return;

        const [first, second] = result;
        const parentSize = Math.pow(2, 32 - node.cidr.prefixLength);
        const childSize = Math.pow(2, 32 - first.cidr.prefixLength);

        // Two children each have half the parent's address space
        expect(childSize * 2).toBe(parentSize);

        // First child starts at parent's network address
        expect(first.cidr.networkAddress.bits).toBe(node.cidr.networkAddress.bits);

        // Second child ends at parent's last address
        const parentEnd = (node.cidr.networkAddress.bits + parentSize - 1) >>> 0;
        const secondEnd = (second.cidr.networkAddress.bits + childSize - 1) >>> 0;
        expect(secondEnd).toBe(parentEnd);
      }),
      { numRuns: 100 }
    );
  });

  it('split children are leaf nodes with no tags or assignments', () => {
    fc.assert(
      fc.property(leafNodeArb, (node) => {
        const result = split(node);
        if (!Array.isArray(result)) return;

        const [first, second] = result;

        expect(first.children).toBeNull();
        expect(second.children).toBeNull();
        expect(first.tags).toEqual([]);
        expect(second.tags).toEqual([]);
        expect(first.workloadAccount).toBeNull();
        expect(second.workloadAccount).toBeNull();
        expect(first.availabilityZone).toBeNull();
        expect(second.availabilityZone).toBeNull();
        expect(first.label).toBeNull();
        expect(second.label).toBeNull();
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: cloud-ipam-webapp, Property 7: Split eligibility invariant
 * Validates: Requirements 3.3, 3.6
 *
 * For any node in the subnet tree, canSplit SHALL return true if and only if
 * the node is a leaf (children === null) AND the node's prefix length is
 * strictly less than 30.
 */
describe('Property 7: Split eligibility invariant', () => {
  it('canSplit returns true for leaf nodes with prefix < 30', () => {
    fc.assert(
      fc.property(leafNodeArb, (node) => {
        // leafNodeArb generates nodes with prefix 8-29, children === null
        expect(canSplit(node)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('canSplit returns false for leaf nodes with prefix === 30', () => {
    fc.assert(
      fc.property(leafNodeAt30Arb, (node) => {
        expect(canSplit(node)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('canSplit returns false for non-leaf nodes (nodes with children)', () => {
    fc.assert(
      fc.property(nonLeafNodeArb, (node) => {
        expect(canSplit(node)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('canSplit is true iff node is leaf AND prefix < 30', () => {
    // Combined generator that produces both leaf and non-leaf nodes
    const anyNodeArb = fc.oneof(
      leafNodeArb,
      leafNodeAt30Arb,
      nonLeafNodeArb
    );

    fc.assert(
      fc.property(anyNodeArb, (node) => {
        const isLeaf = node.children === null;
        const prefixLessThan30 = node.cidr.prefixLength < 30;
        const expected = isLeaf && prefixLessThan30;

        expect(canSplit(node)).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  it('split returns SplitError when canSplit is false', () => {
    const unsplittableNodeArb = fc.oneof(leafNodeAt30Arb, nonLeafNodeArb);

    fc.assert(
      fc.property(unsplittableNodeArb, (node) => {
        const result = split(node);
        expect(Array.isArray(result)).toBe(false);
        if (!Array.isArray(result)) {
          expect(result.type).toBe('max_depth');
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: cloud-ipam-webapp, Property 8: Split-then-join round trip
 * Validates: Requirements 4.1, 4.2
 *
 * For any leaf subnet node with prefix < 30 and no tag/account/AZ/label assignments,
 * splitting and then immediately joining SHALL restore the original node with identical
 * CIDR, null children, and no assignments.
 */
describe('Property 8: Split-then-join round trip', () => {
  it('splitting then joining restores the original CIDR with null children and no assignments', () => {
    fc.assert(
      fc.property(leafNodeArb, (node) => {
        // Split the node
        const splitResult = split(node);

        // Split should succeed for prefix 8-29
        expect(Array.isArray(splitResult)).toBe(true);
        const [firstChild, secondChild] = splitResult as [SubnetNode, SubnetNode];

        // Create a parent node with the split children
        const parentWithChildren: SubnetNode = {
          id: node.id,
          cidr: node.cidr,
          children: [firstChild, secondChild],
          tags: [],
          workloadAccount: null,
          availabilityZone: null,
          label: null,
        };

        // Join the parent back
        const joinResult = join(parentWithChildren);

        // Join should succeed (both children are leaves)
        expect('id' in joinResult).toBe(true);
        const joined = joinResult as SubnetNode;

        // Verify CIDR matches original
        expect(joined.cidr.networkAddress.bits).toBe(node.cidr.networkAddress.bits);
        expect(joined.cidr.prefixLength).toBe(node.cidr.prefixLength);

        // Verify it's a leaf with no assignments
        expect(joined.children).toBeNull();
        expect(joined.tags).toEqual([]);
        expect(joined.workloadAccount).toBeNull();
        expect(joined.availabilityZone).toBeNull();
        expect(joined.label).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('the joined node preserves the parent ID', () => {
    fc.assert(
      fc.property(leafNodeArb, (node) => {
        const splitResult = split(node);
        const [firstChild, secondChild] = splitResult as [SubnetNode, SubnetNode];

        const parentWithChildren: SubnetNode = {
          id: node.id,
          cidr: node.cidr,
          children: [firstChild, secondChild],
          tags: [],
          workloadAccount: null,
          availabilityZone: null,
          label: null,
        };

        const joinResult = join(parentWithChildren);
        const joined = joinResult as SubnetNode;

        expect(joined.id).toBe(node.id);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: cloud-ipam-webapp, Property 9: Join eligibility invariant
 * Validates: Requirements 4.2
 *
 * For any node in the subnet tree, canJoin SHALL return true if and only if the node
 * has exactly two children and both children are leaf nodes (each child's children === null).
 */
describe('Property 9: Join eligibility invariant', () => {
  /**
   * Generator for a leaf node (any prefix 8-30).
   */
  const anyLeafNodeArb = fc.integer({ min: 8, max: 30 }).chain(prefix => {
    const mask = prefixToMask(prefix);
    return fc.integer({ min: 0, max: 0xFFFFFFFF }).map(ip => ({
      id: `leaf-${ip}-${prefix}`,
      cidr: { networkAddress: { bits: (ip & mask) >>> 0 }, prefixLength: prefix },
      children: null,
      tags: [],
      workloadAccount: null,
      availabilityZone: null,
      label: null,
    } as SubnetNode));
  });

  it('canJoin returns false for leaf nodes (no children)', () => {
    fc.assert(
      fc.property(anyLeafNodeArb, (node) => {
        expect(canJoin(node)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('canJoin returns true when node has exactly two leaf children', () => {
    // Use prefix 8-29 so children can have prefix 9-30
    const parentWithLeafChildrenArb = fc.integer({ min: 8, max: 29 }).chain(prefix => {
      const mask = prefixToMask(prefix);
      return fc.integer({ min: 0, max: 0xFFFFFFFF }).map(ip => {
        const networkBits = (ip & mask) >>> 0;
        const childPrefix = prefix + 1;
        const secondOffset = Math.pow(2, 32 - childPrefix);
        const secondNetwork = (networkBits + secondOffset) >>> 0;

        const firstChild: SubnetNode = {
          id: `child-1-${networkBits}-${childPrefix}`,
          cidr: { networkAddress: { bits: networkBits }, prefixLength: childPrefix },
          children: null,
          tags: [],
          workloadAccount: null,
          availabilityZone: null,
          label: null,
        };

        const secondChild: SubnetNode = {
          id: `child-2-${secondNetwork}-${childPrefix}`,
          cidr: { networkAddress: { bits: secondNetwork }, prefixLength: childPrefix },
          children: null,
          tags: [],
          workloadAccount: null,
          availabilityZone: null,
          label: null,
        };

        return {
          id: `parent-${networkBits}-${prefix}`,
          cidr: { networkAddress: { bits: networkBits }, prefixLength: prefix },
          children: [firstChild, secondChild] as readonly [SubnetNode, SubnetNode],
          tags: [],
          workloadAccount: null,
          availabilityZone: null,
          label: null,
        } as SubnetNode;
      });
    });

    fc.assert(
      fc.property(parentWithLeafChildrenArb, (node) => {
        expect(canJoin(node)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('canJoin returns false when at least one child has children (non-leaf)', () => {
    // Create a node where the first child has been further split
    const parentWithNonLeafChildArb = fc.integer({ min: 8, max: 28 }).chain(prefix => {
      const mask = prefixToMask(prefix);
      return fc.integer({ min: 0, max: 0xFFFFFFFF }).map(ip => {
        const networkBits = (ip & mask) >>> 0;
        const childPrefix = prefix + 1;
        const grandchildPrefix = childPrefix + 1;
        const secondOffset = Math.pow(2, 32 - childPrefix);
        const secondNetwork = (networkBits + secondOffset) >>> 0;

        // First child has grandchildren (non-leaf)
        const grandchild1: SubnetNode = {
          id: `gc-1`,
          cidr: { networkAddress: { bits: networkBits }, prefixLength: grandchildPrefix },
          children: null,
          tags: [],
          workloadAccount: null,
          availabilityZone: null,
          label: null,
        };

        const gcOffset = Math.pow(2, 32 - grandchildPrefix);
        const grandchild2: SubnetNode = {
          id: `gc-2`,
          cidr: { networkAddress: { bits: (networkBits + gcOffset) >>> 0 }, prefixLength: grandchildPrefix },
          children: null,
          tags: [],
          workloadAccount: null,
          availabilityZone: null,
          label: null,
        };

        const firstChild: SubnetNode = {
          id: `child-1-nonleaf`,
          cidr: { networkAddress: { bits: networkBits }, prefixLength: childPrefix },
          children: [grandchild1, grandchild2],
          tags: [],
          workloadAccount: null,
          availabilityZone: null,
          label: null,
        };

        const secondChild: SubnetNode = {
          id: `child-2-leaf`,
          cidr: { networkAddress: { bits: secondNetwork }, prefixLength: childPrefix },
          children: null,
          tags: [],
          workloadAccount: null,
          availabilityZone: null,
          label: null,
        };

        return {
          id: `parent-nonleaf-child`,
          cidr: { networkAddress: { bits: networkBits }, prefixLength: prefix },
          children: [firstChild, secondChild] as readonly [SubnetNode, SubnetNode],
          tags: [],
          workloadAccount: null,
          availabilityZone: null,
          label: null,
        } as SubnetNode;
      });
    });

    fc.assert(
      fc.property(parentWithNonLeafChildArb, (node) => {
        expect(canJoin(node)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Feature: cloud-ipam-webapp, Property 11: Tag assignment constraints on leaf subnets
 * Validates: Requirements 6.1, 6.9
 *
 * For any leaf subnet, assigning tags SHALL succeed for 1 to 5 tags and SHALL reject
 * the assignment when attempting to add a 6th tag. For any non-leaf subnet, tag
 * assignment SHALL always be rejected.
 */
describe('Property 11: Tag assignment constraints on leaf subnets', () => {
  /**
   * Generator for use-case tags.
   */
  const tagArb = fc.integer({ min: 1, max: 1000 }).map(i => ({
    id: `tag-${i}`,
    name: `tag-name-${i}`,
    isCustom: false,
    color: `#${i.toString(16).padStart(6, '0')}`,
  } as UseCaseTag));

  /**
   * Generator for a leaf subnet node (used as a single-node tree for assignTag).
   */
  const leafTreeArb = fc.integer({ min: 8, max: 30 }).chain(prefix => {
    const mask = prefixToMask(prefix);
    return fc.integer({ min: 0, max: 0xFFFFFFFF }).map(ip => ({
      id: `leaf-${(ip & mask) >>> 0}-${prefix}`,
      cidr: { networkAddress: { bits: (ip & mask) >>> 0 }, prefixLength: prefix },
      children: null,
      tags: [] as readonly UseCaseTag[],
      workloadAccount: null,
      availabilityZone: null,
      label: null,
    } as SubnetNode));
  });

  /**
   * Generator for a non-leaf (internal) subnet node tree.
   */
  const nonLeafTreeArb = fc.integer({ min: 8, max: 29 }).chain(prefix => {
    const mask = prefixToMask(prefix);
    return fc.integer({ min: 0, max: 0xFFFFFFFF }).map(ip => {
      const networkBits = (ip & mask) >>> 0;
      const childPrefix = prefix + 1;
      const secondOffset = Math.pow(2, 32 - childPrefix);
      const secondNetwork = (networkBits + secondOffset) >>> 0;

      const firstChild: SubnetNode = {
        id: `child-1-${networkBits}-${childPrefix}`,
        cidr: { networkAddress: { bits: networkBits }, prefixLength: childPrefix },
        children: null,
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };

      const secondChild: SubnetNode = {
        id: `child-2-${secondNetwork}-${childPrefix}`,
        cidr: { networkAddress: { bits: secondNetwork }, prefixLength: childPrefix },
        children: null,
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };

      return {
        id: `parent-${networkBits}-${prefix}`,
        cidr: { networkAddress: { bits: networkBits }, prefixLength: prefix },
        children: [firstChild, secondChild] as readonly [SubnetNode, SubnetNode],
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      } as SubnetNode;
    });
  });

  it('assigning 1-5 tags to a leaf node succeeds (each assignment returns a valid tree, not a TagError)', () => {
    fc.assert(
      fc.property(
        leafTreeArb,
        fc.array(tagArb, { minLength: 5, maxLength: 5 }),
        (tree, tags) => {
          // Ensure all 5 tags have unique IDs to avoid duplicates
          const uniqueTags = tags.map((t, i) => ({ ...t, id: `unique-tag-${i}` }));

          let currentTree: SubnetNode = tree;

          for (let i = 0; i < 5; i++) {
            const result = assignTag(currentTree, tree.id, uniqueTags[i]);

            // Should not be a TagError — should be a valid SubnetNode
            expect('type' in result && (result as TagError).type !== undefined).toBe(false);

            // Result should be a SubnetNode (has 'id' and 'cidr' fields)
            const resultNode = result as SubnetNode;
            expect(resultNode.id).toBeDefined();
            expect(resultNode.cidr).toBeDefined();

            currentTree = resultNode;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('assigning a 6th tag to a leaf node with 5 existing tags returns a TagError with type max_tags', () => {
    fc.assert(
      fc.property(
        leafTreeArb,
        fc.array(tagArb, { minLength: 6, maxLength: 6 }),
        (tree, tags) => {
          // Ensure all 6 tags have unique IDs
          const uniqueTags = tags.map((t, i) => ({ ...t, id: `unique-tag-${i}` }));

          // Assign 5 tags first
          let currentTree: SubnetNode = tree;
          for (let i = 0; i < 5; i++) {
            const result = assignTag(currentTree, tree.id, uniqueTags[i]);
            currentTree = result as SubnetNode;
          }

          // Attempt to assign the 6th tag
          const result = assignTag(currentTree, tree.id, uniqueTags[5]);

          // Should be a TagError with type 'max_tags'
          expect('type' in result).toBe(true);
          expect((result as TagError).type).toBe('max_tags');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('assigning any tag to a non-leaf node returns a TagError with type not_leaf', () => {
    fc.assert(
      fc.property(nonLeafTreeArb, tagArb, (tree, tag) => {
        // Attempt to assign a tag to the non-leaf (parent) node
        const result = assignTag(tree, tree.id, tag);

        // Should be a TagError with type 'not_leaf'
        expect('type' in result).toBe(true);
        expect((result as TagError).type).toBe('not_leaf');
      }),
      { numRuns: 100 }
    );
  });
});
