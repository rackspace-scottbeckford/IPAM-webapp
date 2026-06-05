import type { SubnetNode, SplitError, JoinError, UseCaseTag, TagError } from './types';
import { validateTextField } from './input-validator';

/**
 * Counter for generating unique node IDs.
 */
let idCounter = 0;

/**
 * Generate a unique identifier for a new subnet node.
 */
export function generateId(): string {
  return `node-${Date.now()}-${idCounter++}`;
}

/**
 * Reset the ID counter (useful for testing).
 */
export function resetIdCounter(): void {
  idCounter = 0;
}

/**
 * Determine whether a subnet node can be split.
 * A node can be split if it is a leaf (no children) and its prefix length is less than 30.
 *
 * @param node - The subnet node to check
 * @returns true if the node can be split
 */
export function canSplit(node: SubnetNode): boolean {
  return node.children === null && node.cidr.prefixLength < 30;
}

/**
 * Split a leaf subnet node into two child subnets with prefix length + 1.
 *
 * The first child inherits the parent's network address.
 * The second child's network address = parent's network address + 2^(32 - newPrefix).
 *
 * @param node - The leaf subnet node to split
 * @returns A tuple of two child SubnetNodes, or a SplitError if the node cannot be split
 */
export function split(node: SubnetNode): [SubnetNode, SubnetNode] | SplitError {
  if (!canSplit(node)) {
    return { type: 'max_depth', message: 'Cannot split: maximum split depth reached (/30)' };
  }

  const newPrefix = node.cidr.prefixLength + 1;
  const parentNetwork = node.cidr.networkAddress.bits;

  // Second child's network address offset: 2^(32 - newPrefix)
  const secondOffset = Math.pow(2, 32 - newPrefix);
  const secondNetwork = (parentNetwork + secondOffset) >>> 0;

  const firstChild: SubnetNode = {
    id: generateId(),
    cidr: { networkAddress: { bits: parentNetwork }, prefixLength: newPrefix },
    children: null,
    tags: [],
    workloadAccount: null,
    availabilityZone: null,
    label: null,
  };

  const secondChild: SubnetNode = {
    id: generateId(),
    cidr: { networkAddress: { bits: secondNetwork }, prefixLength: newPrefix },
    children: null,
    tags: [],
    workloadAccount: null,
    availabilityZone: null,
    label: null,
  };

  return [firstChild, secondChild];
}

/**
 * Determine whether a parent node's children can be joined back into the parent.
 * A node can be joined if it has exactly two children and both children are leaf nodes.
 *
 * @param parent - The parent subnet node to check
 * @returns true if the parent's children can be joined
 */
export function canJoin(parent: SubnetNode): boolean {
  if (parent.children === null) return false;
  const [left, right] = parent.children;
  return left.children === null && right.children === null;
}

/**
 * Join a parent node's two leaf children back into the parent, restoring it as a leaf.
 * All tag assignments, workload accounts, availability zones, and labels on the children are discarded.
 *
 * @param parent - The parent node whose children should be merged
 * @returns The parent restored as a leaf node, or a JoinError if joining is not possible
 */
export function join(parent: SubnetNode): SubnetNode | JoinError {
  if (!canJoin(parent)) {
    return { type: 'not_leaf_children', message: 'Cannot join: children are not both leaf nodes' };
  }

  // Return parent as a leaf node (discard children and their assignments)
  return {
    id: parent.id,
    cidr: parent.cidr,
    children: null,
    tags: [],
    workloadAccount: null,
    availabilityZone: null,
    label: null,
  };
}

// === Tree Traversal ===

/**
 * Collect all leaf nodes from the subnet tree.
 * A leaf node is one where children === null.
 *
 * @param tree - The root of the subnet tree
 * @returns An array of all leaf SubnetNodes
 */
export function getLeaves(tree: SubnetNode): SubnetNode[] {
  if (tree.children === null) {
    return [tree];
  }
  const [left, right] = tree.children;
  return [...getLeaves(left), ...getLeaves(right)];
}

/**
 * Find a node in the tree by its unique ID.
 *
 * @param tree - The root of the subnet tree
 * @param id - The unique identifier to search for
 * @returns The matching SubnetNode, or null if not found
 */
export function findNode(tree: SubnetNode, id: string): SubnetNode | null {
  if (tree.id === id) {
    return tree;
  }
  if (tree.children === null) {
    return null;
  }
  const [left, right] = tree.children;
  return findNode(left, id) ?? findNode(right, id);
}

// === Immutable Tree Update Helper ===

/**
 * Recursively rebuild the tree with an updated node.
 * Returns a new tree where the node matching nodeId has been replaced by the result of updater(node).
 *
 * @param tree - The root of the subnet tree
 * @param nodeId - The ID of the node to update
 * @param updater - A function that produces the updated node
 * @returns A new tree with the updated node
 */
function updateNode(
  tree: SubnetNode,
  nodeId: string,
  updater: (node: SubnetNode) => SubnetNode
): SubnetNode {
  if (tree.id === nodeId) {
    return updater(tree);
  }
  if (tree.children === null) {
    return tree;
  }
  const [left, right] = tree.children;
  return {
    ...tree,
    children: [updateNode(left, nodeId, updater), updateNode(right, nodeId, updater)],
  };
}

// === Tag Management ===

/**
 * Assign a use-case tag to a leaf subnet node.
 * Enforces: node must be a leaf, maximum 5 tags per node.
 *
 * @param tree - The root of the subnet tree
 * @param nodeId - The ID of the node to tag
 * @param tag - The UseCaseTag to assign
 * @returns A new tree with the tag assigned, or a TagError
 */
export function assignTag(tree: SubnetNode, nodeId: string, tag: UseCaseTag): SubnetNode | TagError {
  const node = findNode(tree, nodeId);
  if (node === null) {
    return { type: 'not_leaf', message: 'Node not found' };
  }
  if (node.children !== null) {
    return { type: 'not_leaf', message: 'Only leaf subnets can be tagged' };
  }
  if (node.tags.length >= 5) {
    return { type: 'max_tags', message: 'Maximum 5 tags per subnet' };
  }

  return updateNode(tree, nodeId, (n) => ({
    ...n,
    tags: [...n.tags, tag],
  }));
}

/**
 * Remove a tag from a subnet node by tag ID.
 *
 * @param tree - The root of the subnet tree
 * @param nodeId - The ID of the node to remove the tag from
 * @param tagId - The ID of the tag to remove
 * @returns A new tree with the tag removed
 */
export function removeTag(tree: SubnetNode, nodeId: string, tagId: string): SubnetNode {
  return updateNode(tree, nodeId, (n) => ({
    ...n,
    tags: n.tags.filter((t) => t.id !== tagId),
  }));
}

// === Metadata Setters ===

/**
 * Set or clear the workload account on a subnet node.
 * Validates that the value is 1–64 characters (or null to clear).
 *
 * @param tree - The root of the subnet tree
 * @param nodeId - The ID of the node to update
 * @param account - The workload account string (1–64 chars), or null to clear
 * @returns A new tree with the workload account set, or the original tree if validation fails
 */
export function setWorkloadAccount(tree: SubnetNode, nodeId: string, account: string | null): SubnetNode {
  if (account !== null && !validateTextField(account)) {
    return tree;
  }
  return updateNode(tree, nodeId, (n) => ({
    ...n,
    workloadAccount: account,
  }));
}

/**
 * Set or clear the availability zone on a subnet node.
 * Validates that the value is 1–64 characters (or null to clear).
 *
 * @param tree - The root of the subnet tree
 * @param nodeId - The ID of the node to update
 * @param az - The availability zone string (1–64 chars), or null to clear
 * @returns A new tree with the availability zone set, or the original tree if validation fails
 */
export function setAvailabilityZone(tree: SubnetNode, nodeId: string, az: string | null): SubnetNode {
  if (az !== null && !validateTextField(az)) {
    return tree;
  }
  return updateNode(tree, nodeId, (n) => ({
    ...n,
    availabilityZone: az,
  }));
}

/**
 * Set or clear the label on a subnet node.
 * Validates that the value is 1–64 characters (or null to clear).
 *
 * @param tree - The root of the subnet tree
 * @param nodeId - The ID of the node to update
 * @param label - The label string (1–64 chars), or null to clear
 * @returns A new tree with the label set, or the original tree if validation fails
 */
export function setLabel(tree: SubnetNode, nodeId: string, label: string | null): SubnetNode {
  if (label !== null && !validateTextField(label)) {
    return tree;
  }
  return updateNode(tree, nodeId, (n) => ({
    ...n,
    label,
  }));
}
