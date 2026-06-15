import type { CIDRBlock, SubnetNode } from './types';
import { getLeaves } from './tree-operations';

/**
 * Result of a reverse CIDR calculation.
 */
export interface ReverseCIDRResult {
  /** The suggested prefix length */
  readonly suggestedPrefix: number;
  /** Total addresses at this prefix */
  readonly totalAddresses: number;
  /** Usable addresses after provider reservations */
  readonly usableAddresses: number;
  /** Surplus usable addresses beyond what was requested */
  readonly surplus: number;
}

/**
 * Error when reverse CIDR calculation cannot satisfy the request.
 */
export interface ReverseCIDRError {
  readonly type: 'exceeds_capacity' | 'no_space';
  readonly message: string;
}

/**
 * Calculate the smallest prefix length (largest subnet) that provides at least
 * the requested number of usable IP addresses after subtracting provider-reserved addresses.
 *
 * Formula: find smallest P (8 ≤ P ≤ 30) where (2^(32-P) - reservedCount) ≥ requestedUsableIPs
 *
 * Requirement 14.3, 14.8
 *
 * @param requestedUsableIPs - Number of usable IP addresses needed (1 to 16,777,214)
 * @param reservedCount - Provider-reserved IPs per subnet
 * @returns The suggested prefix and details, or an error if unsatisfiable
 */
export function calculateReverseCIDR(
  requestedUsableIPs: number,
  reservedCount: number
): ReverseCIDRResult | ReverseCIDRError {
  if (requestedUsableIPs < 1 || requestedUsableIPs > 16777214) {
    return {
      type: 'exceeds_capacity',
      message: `Requested IPs must be between 1 and 16,777,214`,
    };
  }

  // Iterate from largest prefix (smallest subnet) to smallest prefix (largest subnet)
  // We want the smallest subnet that fits, so start from /30 and go up
  for (let prefix = 30; prefix >= 8; prefix--) {
    const totalAddresses = Math.pow(2, 32 - prefix);
    const usableAddresses = Math.max(0, totalAddresses - reservedCount);

    if (usableAddresses >= requestedUsableIPs) {
      return {
        suggestedPrefix: prefix,
        totalAddresses,
        usableAddresses,
        surplus: usableAddresses - requestedUsableIPs,
      };
    }
  }

  // No prefix in the valid range can satisfy the request
  return {
    type: 'exceeds_capacity',
    message: `Cannot accommodate ${requestedUsableIPs.toLocaleString()} usable IPs. Maximum available with /${8} is ${(Math.pow(2, 24) - reservedCount).toLocaleString()} usable IPs.`,
  };
}

/**
 * Check if the requested prefix fits within the root CIDR block.
 *
 * Requirement 14.5
 *
 * @param suggestedPrefix - The prefix length needed
 * @param rootCIDR - The root CIDR block of the network plan
 * @param reservedCount - Provider-reserved IPs per subnet
 * @param requestedUsableIPs - How many usable IPs were requested
 * @returns null if it fits, or an error message if it doesn't
 */
export function validateFitsInRoot(
  suggestedPrefix: number,
  rootCIDR: CIDRBlock,
  reservedCount: number,
  requestedUsableIPs: number
): string | null {
  if (suggestedPrefix < rootCIDR.prefixLength) {
    const rootTotal = Math.pow(2, 32 - rootCIDR.prefixLength);
    const rootUsable = Math.max(0, rootTotal - reservedCount);
    return `The current root network (/${rootCIDR.prefixLength}, ${rootUsable.toLocaleString()} usable IPs) is too small to accommodate ${requestedUsableIPs.toLocaleString()} usable IPs which requires a /${suggestedPrefix}.`;
  }
  return null;
}

/**
 * Find the first available (untagged, no workload, no children) leaf subnet
 * that matches the target prefix length. If none exists at that prefix,
 * attempt to find a larger leaf that can be split down to the target prefix.
 *
 * Requirement 14.6, 14.7
 *
 * @param tree - The subnet tree root
 * @param targetPrefix - The desired prefix length for the workload subnet
 * @returns The ID of the available leaf node, or null if no space is available
 */
export function findAvailableLeaf(
  tree: SubnetNode,
  targetPrefix: number
): string | null {
  const leaves = getLeaves(tree);

  // First, look for an exact-match leaf at the target prefix that's unassigned
  const exactMatch = leaves.find(
    (leaf) =>
      leaf.cidr.prefixLength === targetPrefix &&
      leaf.tags.length === 0 &&
      leaf.workloadAccount === null &&
      leaf.label === null
  );
  if (exactMatch) return exactMatch.id;

  // Second, look for a larger (smaller prefix) unassigned leaf that can be split down
  const splittable = leaves
    .filter(
      (leaf) =>
        leaf.cidr.prefixLength < targetPrefix &&
        leaf.tags.length === 0 &&
        leaf.workloadAccount === null &&
        leaf.label === null
    )
    .sort((a, b) => b.cidr.prefixLength - a.cidr.prefixLength); // Prefer smallest available block

  if (splittable.length > 0) {
    return splittable[0].id;
  }

  return null;
}

/**
 * Calculate the sequence of split operations needed to get from a leaf's
 * current prefix to the target prefix. Returns the number of splits needed.
 *
 * @param currentPrefix - The leaf's current prefix length
 * @param targetPrefix - The desired prefix length
 * @returns Number of splits required (always takes the first/left child path)
 */
export function splitsNeeded(currentPrefix: number, targetPrefix: number): number {
  return targetPrefix - currentPrefix;
}
