import type { CIDRBlock, SubnetNode } from './types';
import { getLeaves } from './tree-operations';
import { prefixToMask } from './subnet-calculator';

/**
 * Successful result of validating an existing CIDR for mapping into the tree.
 */
export interface MapExistingResult {
  /** The target CIDR block, adjusted to its network address. */
  readonly cidr: CIDRBlock;
  /**
   * The sequence of child choices needed to navigate from the root down to the
   * target CIDR. Each entry is 0 (take the left/first child) or 1 (take the
   * right/second child). An empty array means the target IS the root.
   */
  readonly path: readonly (0 | 1)[];
}

/**
 * Error returned when an existing CIDR cannot be mapped into the tree.
 */
export interface MapExistingError {
  readonly type:
    | 'not_contained'
    | 'prefix_too_small'
    | 'overlaps_allocation'
    | 'already_mapped';
  readonly message: string;
}

/**
 * Determine whether a node (or any of its descendants) is considered "allocated",
 * i.e. carries a label, workload account, or tags. A split (non-leaf) node is not
 * itself allocated, but its leaves may be.
 */
function isAssigned(node: SubnetNode): boolean {
  return (
    node.tags.length > 0 ||
    node.workloadAccount !== null ||
    node.label !== null
  );
}

/**
 * Compute the inclusive [start, end] address range of a CIDR block as unsigned
 * 32-bit integers.
 */
function cidrRange(cidr: CIDRBlock): { start: number; end: number } {
  const mask = prefixToMask(cidr.prefixLength);
  const start = (cidr.networkAddress.bits & mask) >>> 0;
  const end = (start | (~mask >>> 0)) >>> 0;
  return { start, end };
}

/**
 * Determine whether two CIDR ranges overlap (share any address).
 */
function rangesOverlap(a: CIDRBlock, b: CIDRBlock): boolean {
  const ra = cidrRange(a);
  const rb = cidrRange(b);
  return ra.start <= rb.end && rb.start <= ra.end;
}

/**
 * Determine whether `inner` is fully contained within `outer`.
 * Containment requires the inner prefix to be equal to or longer than the outer
 * prefix, and the inner network address to fall within the outer range.
 */
function isContainedWithin(outer: CIDRBlock, inner: CIDRBlock): boolean {
  if (inner.prefixLength < outer.prefixLength) return false;
  const ro = cidrRange(outer);
  const ri = cidrRange(inner);
  return ri.start >= ro.start && ri.end <= ro.end;
}

/**
 * Compute the left/right child path from the root CIDR down to the target CIDR.
 *
 * In this binary split tree, a node at prefix P splits into two children at
 * P+1: the first (left) child shares the parent's network address, and the
 * second (right) child begins at `network + 2^(32-(P+1))`. Which child contains
 * the target is decided by the target's network bit at position `31 - P`.
 *
 * @param rootCIDR - The root CIDR block of the tree
 * @param target - The target CIDR to navigate to (must be contained in root)
 * @returns An array of 0 (left) / 1 (right) choices from root to target
 */
export function computeSplitPath(
  rootCIDR: CIDRBlock,
  target: CIDRBlock
): (0 | 1)[] {
  const path: (0 | 1)[] = [];
  const targetNetwork = (target.networkAddress.bits & prefixToMask(target.prefixLength)) >>> 0;

  for (let p = rootCIDR.prefixLength; p < target.prefixLength; p++) {
    // Bit of the target network address that distinguishes the two children at
    // this level. Position 31 is the MSB, position 0 is the LSB.
    const bitPosition = 31 - p;
    const bit = (targetNetwork >>> bitPosition) & 1;
    path.push(bit === 1 ? 1 : 0);
  }

  return path;
}

/**
 * Validate that an existing CIDR can be mapped into the current tree and compute
 * the path to reach it.
 *
 * Checks, in order:
 *  1. The target fits within the root CIDR (contained in range, prefix >= root).
 *  2. The target does not overlap any already-assigned subnet (tagged, labelled,
 *     or with a workload account). A target that exactly matches an unassigned
 *     leaf is fine; a target that would carve space out of an assigned leaf or
 *     subtree is rejected.
 *
 * @param tree - The root of the subnet tree
 * @param rootCIDR - The root CIDR block of the network plan
 * @param target - The user-supplied CIDR, already adjusted to its network address
 * @returns A MapExistingResult with the navigation path, or a MapExistingError
 */
export function validateMapExisting(
  tree: SubnetNode,
  rootCIDR: CIDRBlock,
  target: CIDRBlock
): MapExistingResult | MapExistingError {
  // 1. Prefix must be at least as long as the root (can't map something larger
  //    than the whole plan).
  if (target.prefixLength < rootCIDR.prefixLength) {
    return {
      type: 'prefix_too_small',
      message: `The CIDR /${target.prefixLength} is larger than the root network /${rootCIDR.prefixLength}. Enter a subnet equal to or smaller than the root block.`,
    };
  }

  // 2. Must fall within the root range.
  if (!isContainedWithin(rootCIDR, target)) {
    return {
      type: 'not_contained',
      message: `The CIDR does not fall within the root network block. It must be contained within the plan's root CIDR.`,
    };
  }

  // 3. Must not overlap any already-assigned subnet.
  const leaves = getLeaves(tree);
  for (const leaf of leaves) {
    if (!rangesOverlap(leaf.cidr, target)) continue;

    // The target overlaps this leaf's range.
    const sameBlock =
      leaf.cidr.prefixLength === target.prefixLength &&
      cidrRange(leaf.cidr).start === cidrRange(target).start;

    if (isAssigned(leaf)) {
      if (sameBlock) {
        return {
          type: 'already_mapped',
          message: `This exact subnet is already allocated${leaf.label ? ` to "${leaf.label}"` : ''}.`,
        };
      }
      return {
        type: 'overlaps_allocation',
        message: `The CIDR overlaps an existing allocation${leaf.label ? ` ("${leaf.label}")` : ''}. Choose a range that does not conflict with allocated subnets.`,
      };
    }
  }

  // All checks passed — compute the navigation path.
  const path = computeSplitPath(rootCIDR, target);
  return { cidr: target, path };
}
