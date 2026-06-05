import type { SubnetNode, CloudProviderProfile, UseCaseTag } from '../core/types';
import { getAvailableTags } from './cloud-profiles';

/**
 * Reconcile tags on a subnet tree when switching cloud providers.
 *
 * Removes tags from leaf nodes that are not available in the new cloud profile.
 * Custom tags are always preserved since they are included in the available tag set.
 *
 * @param tree - The current subnet tree
 * @param oldProfile - The previous cloud provider profile
 * @param newProfile - The new cloud provider profile being switched to
 * @param customTags - User-defined custom tags (always preserved)
 * @returns The updated tree and a list of removed tag names for confirmation dialog
 */
export function reconcileTags(
  tree: SubnetNode,
  _oldProfile: CloudProviderProfile,
  newProfile: CloudProviderProfile,
  customTags: UseCaseTag[]
): { tree: SubnetNode; removedTags: string[] } {
  // Get the set of available tag IDs in the new profile (defaults + custom)
  const newAvailableTags = getAvailableTags(newProfile, customTags);
  const newTagIds = new Set(newAvailableTags.map((t) => t.id));

  // Track which tag names were removed
  const removedTagNames: Set<string> = new Set();

  // Recursively update the tree, removing incompatible tags from each leaf
  function updateTree(node: SubnetNode): SubnetNode {
    if (node.children === null) {
      // Leaf node — filter tags to only those in the new profile
      const keptTags = node.tags.filter((t) => newTagIds.has(t.id));
      const removed = node.tags.filter((t) => !newTagIds.has(t.id));
      removed.forEach((t) => removedTagNames.add(t.name));

      if (keptTags.length === node.tags.length) {
        return node; // No change needed
      }
      return { ...node, tags: keptTags };
    }

    // Non-leaf — recurse into children
    const [left, right] = node.children;
    const newLeft = updateTree(left);
    const newRight = updateTree(right);

    if (newLeft === left && newRight === right) {
      return node; // No change needed
    }
    return { ...node, children: [newLeft, newRight] };
  }

  const updatedTree = updateTree(tree);
  return {
    tree: updatedTree,
    removedTags: Array.from(removedTagNames),
  };
}
