import { useAppStore } from '../../store/app-store';
import { getLeaves } from '../../core/tree-operations';
import { computeSubnetInfo, numberToIp } from '../../core/subnet-calculator';
import type { SubnetNode, UseCaseTag } from '../../core/types';
import styles from './GroupedView.module.css';

/**
 * Groups leaf subnets by their assigned Use_Case_Tags.
 * A leaf with multiple tags appears in multiple groups.
 * Leaves with no tags appear in an "Untagged" group.
 */
function groupLeavesByTag(leaves: SubnetNode[]): Map<string, { tag: UseCaseTag | null; subnets: SubnetNode[] }> {
  const groups = new Map<string, { tag: UseCaseTag | null; subnets: SubnetNode[] }>();

  for (const leaf of leaves) {
    if (leaf.tags.length === 0) {
      // Add to "Untagged" group
      const existing = groups.get('__untagged__');
      if (existing) {
        existing.subnets.push(leaf);
      } else {
        groups.set('__untagged__', { tag: null, subnets: [leaf] });
      }
    } else {
      // Add to each tag's group
      for (const tag of leaf.tags) {
        const existing = groups.get(tag.id);
        if (existing) {
          existing.subnets.push(leaf);
        } else {
          groups.set(tag.id, { tag, subnets: [leaf] });
        }
      }
    }
  }

  return groups;
}

/**
 * GroupedView component renders subnets grouped by their assigned Use_Case_Tag.
 * Each group is displayed as a bounded section with the tag name as a header.
 * Subnets with no tags are shown in an "Untagged" group.
 *
 * Validates: Requirements 7.5
 */
export function GroupedView() {
  const networkPlan = useAppStore((s) => s.networkPlan);
  const providerProfile = useAppStore((s) => s.providerProfile);

  if (!networkPlan || !providerProfile) {
    return <div className={styles.emptyMessage}>No network plan available. Enter a CIDR block to get started.</div>;
  }

  const leaves = getLeaves(networkPlan.tree);
  const groups = groupLeavesByTag(leaves);

  if (groups.size === 0) {
    return <div className={styles.emptyMessage}>No subnets to display.</div>;
  }

  // Sort groups: named tags first (alphabetically), then untagged last
  const sortedEntries = [...groups.entries()].sort(([keyA, a], [keyB, b]) => {
    if (keyA === '__untagged__') return 1;
    if (keyB === '__untagged__') return -1;
    return (a.tag?.name ?? '').localeCompare(b.tag?.name ?? '');
  });

  return (
    <div className={styles.groupedView}>
      {sortedEntries.map(([key, { tag, subnets }]) => (
        <section key={key} className={styles.group} aria-label={tag ? `Tag group: ${tag.name}` : 'Untagged subnets'}>
          <div className={styles.groupHeader}>
            <span
              className={styles.colorIndicator}
              style={{ backgroundColor: tag ? tag.color : '#9ca3af' }}
              aria-hidden="true"
            />
            <span>{tag ? tag.name : 'Untagged'}</span>
            <span aria-label={`${subnets.length} subnet${subnets.length !== 1 ? 's' : ''}`}>
              ({subnets.length})
            </span>
          </div>
          <ul className={styles.subnetList}>
            {subnets.map((subnet) => {
              const info = computeSubnetInfo(subnet.cidr, providerProfile.reservedIPs);
              return (
                <li key={subnet.id} className={styles.subnetItem}>
                  <span className={styles.subnetCidr}>
                    {numberToIp(subnet.cidr.networkAddress.bits)}/{subnet.cidr.prefixLength}
                  </span>
                  <span className={styles.subnetHosts}>
                    {info.usableHosts} usable host{info.usableHosts !== 1 ? 's' : ''}
                  </span>
                  {subnet.workloadAccount && (
                    <span className={styles.subnetAccount}>
                      {subnet.workloadAccount}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
