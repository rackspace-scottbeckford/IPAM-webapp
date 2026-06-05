import type { SubnetNode, CloudProviderProfile, VPCSummary, AccountAllocation, LimitWarning } from './types';
import { getLeaves } from './tree-operations';
import { computeSubnetInfo } from './subnet-calculator';

/**
 * Compute a VPC planning summary from the subnet tree and active cloud provider profile.
 *
 * Calculates total subnets, subnets by tag, subnets by AZ, total usable IPs,
 * allocation percentage, account breakdown, and provider limit warnings.
 *
 * @param tree - The root of the subnet tree
 * @param profile - The active cloud provider profile
 * @returns VPCSummary with all computed fields
 */
export function computeSummary(tree: SubnetNode, profile: CloudProviderProfile): VPCSummary {
  const leaves = getLeaves(tree);
  const totalSubnets = leaves.length;

  // Subnets by tag
  const subnetsByTag = new Map<string, number>();
  for (const leaf of leaves) {
    for (const tag of leaf.tags) {
      subnetsByTag.set(tag.name, (subnetsByTag.get(tag.name) || 0) + 1);
    }
  }

  // Subnets by AZ
  const subnetsByAZ = new Map<string, number>();
  for (const leaf of leaves) {
    if (leaf.availabilityZone) {
      subnetsByAZ.set(leaf.availabilityZone, (subnetsByAZ.get(leaf.availabilityZone) || 0) + 1);
    }
  }

  // Total usable IPs
  let totalUsableIPs = 0;
  for (const leaf of leaves) {
    const info = computeSubnetInfo(leaf.cidr, profile.reservedIPs);
    totalUsableIPs += info.usableHosts;
  }

  // Allocation percentage: (sum of leaf total addresses / root total addresses) * 100
  const rootTotalAddresses = Math.pow(2, 32 - tree.cidr.prefixLength);
  const leafTotalAddresses = leaves.reduce(
    (sum, leaf) => sum + Math.pow(2, 32 - leaf.cidr.prefixLength),
    0
  );
  const allocationPercentage = Math.round((leafTotalAddresses / rootTotalAddresses) * 1000) / 10;

  // Account breakdown
  const accountMap = new Map<string, { subnetCount: number; usableIPs: number }>();
  for (const leaf of leaves) {
    if (leaf.workloadAccount) {
      const existing = accountMap.get(leaf.workloadAccount) || { subnetCount: 0, usableIPs: 0 };
      const info = computeSubnetInfo(leaf.cidr, profile.reservedIPs);
      existing.subnetCount++;
      existing.usableIPs += info.usableHosts;
      accountMap.set(leaf.workloadAccount, existing);
    }
  }

  const accountBreakdown: AccountAllocation[] = Array.from(accountMap.entries()).map(
    ([account, data]) => ({
      account,
      subnetCount: data.subnetCount,
      usableIPs: data.usableIPs,
      percentageOfTotal:
        totalUsableIPs > 0 ? Math.round((data.usableIPs / totalUsableIPs) * 1000) / 10 : 0,
    })
  );

  // Limit warning
  const limitWarning: LimitWarning | null =
    totalSubnets > profile.subnetLimit
      ? { currentCount: totalSubnets, maxAllowed: profile.subnetLimit, providerName: profile.displayName }
      : null;

  return {
    totalSubnets,
    subnetsByTag,
    subnetsByAZ,
    totalUsableIPs,
    allocationPercentage,
    accountBreakdown,
    limitWarning,
  };
}
