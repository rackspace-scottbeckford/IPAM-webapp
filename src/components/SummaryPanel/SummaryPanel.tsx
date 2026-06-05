import { useAppStore } from '../../store/app-store';
import styles from './SummaryPanel.module.css';

/**
 * VPC Summary Panel displays planning metrics for the current network plan.
 *
 * Shows: total subnets, subnets per tag, subnets per AZ, allocation percentage,
 * total usable IPs, workload account breakdown, provider limit warnings,
 * reserved address info, and cloud provider icon.
 *
 * Updates reactively via Zustand store — recomputed on every state change
 * (within 200ms of any operation).
 *
 * Requirements: 5.5, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 12.5
 */
export function SummaryPanel() {
  const summary = useAppStore((s) => s.summary);
  const providerProfile = useAppStore((s) => s.providerProfile);

  if (!summary || !providerProfile) {
    return (
      <aside className={styles.panel} aria-label="VPC Planning Summary">
        <p className={styles.emptyState}>
          Select a cloud provider and enter a CIDR block to see your VPC summary.
        </p>
      </aside>
    );
  }

  return (
    <aside
      className={styles.panel}
      aria-label="VPC Planning Summary"
      style={{ '--accent-color': providerProfile.accentColor } as React.CSSProperties}
    >
      {/* Panel Header with cloud provider icon */}
      <div className={styles.panelHeader}>
        <img
          src={`${import.meta.env.BASE_URL}${providerProfile.iconPath}`}
          alt={providerProfile.displayName}
          className={styles.cloudIcon}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <h2 className={styles.panelTitle}>VPC Planning Summary</h2>
      </div>

      {/* Provider limit warning */}
      {summary.limitWarning && (
        <div className={styles.warningBanner} role="alert">
          <span className={styles.warningIcon} aria-hidden="true">⚠️</span>
          <span className={styles.warningText}>
            Subnet limit exceeded for {summary.limitWarning.providerName}:{' '}
            <strong>{summary.limitWarning.currentCount}</strong> subnets
            (max {summary.limitWarning.maxAllowed})
          </span>
        </div>
      )}

      {/* Overview stats */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Overview</h3>
        <div className={styles.statGrid}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Total Subnets</span>
            <span className={styles.statValue}>{summary.totalSubnets}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Allocation</span>
            <span className={styles.statValue}>{summary.allocationPercentage.toFixed(1)}%</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Total Usable IPs</span>
            <span className={styles.statValue}>{summary.totalUsableIPs.toLocaleString()}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Reserved per Subnet</span>
            <span className={styles.statValue}>{providerProfile.reservedIPs}</span>
          </div>
        </div>
      </div>

      {/* Subnets by Tag */}
      {summary.subnetsByTag.size > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Subnets by Tag</h3>
          <ul className={styles.tagList} aria-label="Subnet count per tag">
            {Array.from(summary.subnetsByTag.entries()).map(([tagName, count]) => {
              const tag = providerProfile.defaultTags.find((t) => t.name === tagName);
              return (
                <li key={tagName} className={styles.tagItem}>
                  <span className={styles.tagName}>
                    <span
                      className={styles.tagSwatch}
                      style={{ backgroundColor: tag?.color ?? '#9ca3af' }}
                      aria-hidden="true"
                    />
                    {tagName}
                  </span>
                  <span className={styles.tagCount}>{count}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Subnets by Availability Zone */}
      {summary.subnetsByAZ.size > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Subnets by Availability Zone</h3>
          <ul className={styles.azList} aria-label="Subnet count per availability zone">
            {Array.from(summary.subnetsByAZ.entries()).map(([az, count]) => (
              <li key={az} className={styles.azItem}>
                <span>{az}</span>
                <span className={styles.tagCount}>{count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Workload Account Breakdown */}
      {summary.accountBreakdown.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Workload Accounts</h3>
          <table className={styles.accountTable} aria-label="Workload account breakdown">
            <thead>
              <tr>
                <th scope="col">Account</th>
                <th scope="col">Subnets</th>
                <th scope="col">Usable IPs</th>
                <th scope="col">%</th>
              </tr>
            </thead>
            <tbody>
              {summary.accountBreakdown.map((acct) => (
                <tr key={acct.account}>
                  <td>{acct.account}</td>
                  <td>{acct.subnetCount}</td>
                  <td>{acct.usableIPs.toLocaleString()}</td>
                  <td>{acct.percentageOfTotal.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reserved Addresses */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          Reserved Addresses ({providerProfile.reservedIPs} per subnet)
        </h3>
        <ul className={styles.reservedList} aria-label="Reserved address reasons">
          {providerProfile.reservedReasons.map((reason) => (
            <li key={reason} className={styles.reservedItem}>
              <span className={styles.reservedBullet} aria-hidden="true" />
              {reason}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
