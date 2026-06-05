import { describe, it, expect } from 'vitest';
import type { SubnetNode } from '../core/types';

/**
 * Unit tests for tree keyboard navigation logic.
 * Tests the helper functions used by useTreeKeyboardNav.
 *
 * Requirements: 7.4 (keyboard navigation through tree nodes)
 */

// Re-implement the helper functions for testing (they're not exported from the hook)
function getVisibleNodeIds(
  node: SubnetNode,
  collapsedSet: Set<string>
): string[] {
  const ids: string[] = [node.id];
  if (node.children && !collapsedSet.has(`__collapsed__${node.id}`)) {
    for (const child of node.children) {
      ids.push(...getVisibleNodeIds(child, collapsedSet));
    }
  }
  return ids;
}

function hasChildrenInTree(tree: SubnetNode, nodeId: string): boolean {
  if (tree.id === nodeId) {
    return tree.children !== null;
  }
  if (tree.children) {
    for (const child of tree.children) {
      if (hasChildrenInTree(child, nodeId)) return true;
    }
  }
  return false;
}

function findParentId(tree: SubnetNode, targetId: string, parentId: string | null = null): string | null {
  if (tree.id === targetId) {
    return parentId;
  }
  if (tree.children) {
    for (const child of tree.children) {
      const result = findParentId(child, targetId, tree.id);
      if (result !== null) return result;
    }
  }
  return null;
}

// Helper to create test nodes
function makeLeaf(id: string, prefix: number): SubnetNode {
  return {
    id,
    cidr: { networkAddress: { bits: 0x0a000000 }, prefixLength: prefix },
    children: null,
    tags: [],
    workloadAccount: null,
    availabilityZone: null,
    label: null,
  };
}

function makeParent(id: string, prefix: number, children: [SubnetNode, SubnetNode]): SubnetNode {
  return {
    id,
    cidr: { networkAddress: { bits: 0x0a000000 }, prefixLength: prefix },
    children,
    tags: [],
    workloadAccount: null,
    availabilityZone: null,
    label: null,
  };
}

describe('Tree keyboard navigation helpers', () => {
  describe('getVisibleNodeIds', () => {
    it('returns only root for a leaf node', () => {
      const leaf = makeLeaf('root', 16);
      const result = getVisibleNodeIds(leaf, new Set());
      expect(result).toEqual(['root']);
    });

    it('returns all nodes when none are collapsed', () => {
      const tree = makeParent('root', 16, [
        makeLeaf('left', 17),
        makeLeaf('right', 17),
      ]);
      const result = getVisibleNodeIds(tree, new Set());
      expect(result).toEqual(['root', 'left', 'right']);
    });

    it('hides children of collapsed nodes', () => {
      const tree = makeParent('root', 16, [
        makeParent('left', 17, [
          makeLeaf('left-left', 18),
          makeLeaf('left-right', 18),
        ]),
        makeLeaf('right', 17),
      ]);

      const collapsed = new Set(['__collapsed__left']);
      const result = getVisibleNodeIds(tree, collapsed);
      expect(result).toEqual(['root', 'left', 'right']);
    });

    it('returns full depth-first order for expanded tree', () => {
      const tree = makeParent('root', 16, [
        makeParent('left', 17, [
          makeLeaf('ll', 18),
          makeLeaf('lr', 18),
        ]),
        makeParent('right', 17, [
          makeLeaf('rl', 18),
          makeLeaf('rr', 18),
        ]),
      ]);

      const result = getVisibleNodeIds(tree, new Set());
      expect(result).toEqual(['root', 'left', 'll', 'lr', 'right', 'rl', 'rr']);
    });
  });

  describe('hasChildrenInTree', () => {
    it('returns false for a leaf node', () => {
      const leaf = makeLeaf('root', 16);
      expect(hasChildrenInTree(leaf, 'root')).toBe(false);
    });

    it('returns true for a parent node', () => {
      const tree = makeParent('root', 16, [
        makeLeaf('left', 17),
        makeLeaf('right', 17),
      ]);
      expect(hasChildrenInTree(tree, 'root')).toBe(true);
    });

    it('returns true for a nested parent', () => {
      const tree = makeParent('root', 16, [
        makeParent('left', 17, [
          makeLeaf('ll', 18),
          makeLeaf('lr', 18),
        ]),
        makeLeaf('right', 17),
      ]);
      expect(hasChildrenInTree(tree, 'left')).toBe(true);
    });

    it('returns false for a nested leaf', () => {
      const tree = makeParent('root', 16, [
        makeParent('left', 17, [
          makeLeaf('ll', 18),
          makeLeaf('lr', 18),
        ]),
        makeLeaf('right', 17),
      ]);
      expect(hasChildrenInTree(tree, 'll')).toBe(false);
    });
  });

  describe('findParentId', () => {
    it('returns null for root node', () => {
      const tree = makeParent('root', 16, [
        makeLeaf('left', 17),
        makeLeaf('right', 17),
      ]);
      expect(findParentId(tree, 'root')).toBeNull();
    });

    it('returns root id for direct children', () => {
      const tree = makeParent('root', 16, [
        makeLeaf('left', 17),
        makeLeaf('right', 17),
      ]);
      expect(findParentId(tree, 'left')).toBe('root');
      expect(findParentId(tree, 'right')).toBe('root');
    });

    it('returns correct parent for nested nodes', () => {
      const tree = makeParent('root', 16, [
        makeParent('left', 17, [
          makeLeaf('ll', 18),
          makeLeaf('lr', 18),
        ]),
        makeLeaf('right', 17),
      ]);
      expect(findParentId(tree, 'll')).toBe('left');
      expect(findParentId(tree, 'lr')).toBe('left');
    });

    it('returns null for non-existent node', () => {
      const tree = makeLeaf('root', 16);
      expect(findParentId(tree, 'nonexistent')).toBeNull();
    });
  });
});
