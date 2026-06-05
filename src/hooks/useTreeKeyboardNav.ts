import { useCallback, useRef } from 'react';
import type { SubnetNode } from '../core/types';

/**
 * Collects all visible node IDs in document order (depth-first, respecting collapsed state).
 */
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

interface UseTreeKeyboardNavOptions {
  tree: SubnetNode | null;
  expandedNodes: Set<string>;
  onToggleExpand: (nodeId: string) => void;
  onSelectNode?: (nodeId: string) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Hook providing keyboard navigation for the subnet tree.
 *
 * Supports:
 * - ArrowDown: Move focus to next visible node
 * - ArrowUp: Move focus to previous visible node
 * - ArrowRight: Expand collapsed node, or move to first child
 * - ArrowLeft: Collapse expanded node, or move to parent
 * - Home: Move focus to first node
 * - End: Move focus to last visible node
 * - Enter/Space: Select the focused node (trigger action)
 */
export function useTreeKeyboardNav({
  tree,
  expandedNodes,
  onToggleExpand,
  onSelectNode,
  containerRef,
}: UseTreeKeyboardNavOptions) {
  const focusedNodeIdRef = useRef<string | null>(null);

  const focusNode = useCallback((nodeId: string) => {
    if (!containerRef.current) return;
    const element = containerRef.current.querySelector(
      `[data-node-id="${nodeId}"]`
    ) as HTMLElement | null;
    if (element) {
      element.focus();
      focusedNodeIdRef.current = nodeId;
    }
  }, [containerRef]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!tree) return;

      const { key } = event;
      const supportedKeys = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' '];
      if (!supportedKeys.includes(key)) return;

      event.preventDefault();

      const visibleIds = getVisibleNodeIds(tree, expandedNodes);
      if (visibleIds.length === 0) return;

      const currentId = focusedNodeIdRef.current;
      const currentIndex = currentId ? visibleIds.indexOf(currentId) : -1;

      switch (key) {
        case 'ArrowDown': {
          const nextIndex = currentIndex < visibleIds.length - 1 ? currentIndex + 1 : currentIndex;
          focusNode(visibleIds[nextIndex]);
          break;
        }

        case 'ArrowUp': {
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0;
          focusNode(visibleIds[prevIndex]);
          break;
        }

        case 'ArrowRight': {
          if (!currentId) break;
          // If node is collapsed, expand it
          const isCollapsed = expandedNodes.has(`__collapsed__${currentId}`);
          if (isCollapsed) {
            onToggleExpand(currentId);
          } else {
            // Move to first child if expanded and has children
            const nextIndex = currentIndex + 1;
            if (nextIndex < visibleIds.length) {
              focusNode(visibleIds[nextIndex]);
            }
          }
          break;
        }

        case 'ArrowLeft': {
          if (!currentId) break;
          // If node is expanded (not collapsed) and has children, collapse it
          const isExpanded = !expandedNodes.has(`__collapsed__${currentId}`);
          // Check if this node has children by seeing if the next visible node
          // would be a child (we can check by looking at the tree structure)
          const nodeHasChildren = hasChildrenInTree(tree, currentId);
          if (isExpanded && nodeHasChildren) {
            onToggleExpand(currentId);
          } else {
            // Move to parent — find the previous node at a shallower depth
            const parentId = findParentId(tree, currentId);
            if (parentId) {
              focusNode(parentId);
            }
          }
          break;
        }

        case 'Home': {
          focusNode(visibleIds[0]);
          break;
        }

        case 'End': {
          focusNode(visibleIds[visibleIds.length - 1]);
          break;
        }

        case 'Enter':
        case ' ': {
          if (currentId && onSelectNode) {
            onSelectNode(currentId);
          }
          break;
        }
      }
    },
    [tree, expandedNodes, onToggleExpand, onSelectNode, focusNode]
  );

  return { handleKeyDown, focusNode, focusedNodeIdRef };
}

/**
 * Check if a node in the tree has children.
 */
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

/**
 * Find the parent node ID for a given node in the tree.
 */
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
