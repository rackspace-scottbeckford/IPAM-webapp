import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/app-store';
import { applyBrandTheme } from '../../theme/theme-engine';
import type { TargetCloud } from '../../core/types';
import styles from './Header.module.css';

const CLOUD_OPTIONS: { id: TargetCloud; label: string }[] = [
  { id: 'aws', label: 'Amazon Web Services' },
  { id: 'azure', label: 'Microsoft Azure' },
  { id: 'gcp', label: 'Google Cloud Platform' },
  { id: 'private', label: 'Private Cloud' },
];

export function Header() {
  const branding = useAppStore((s) => s.branding);
  const providerProfile = useAppStore((s) => s.providerProfile);
  const selectCloud = useAppStore((s) => s.selectCloud);
  const [showChangeDialog, setShowChangeDialog] = useState(false);

  // Apply brand theme CSS variables on mount and when branding changes
  useEffect(() => {
    applyBrandTheme(branding);
  }, [branding]);

  const handleCloudClick = () => {
    setShowChangeDialog(true);
  };

  const handleSwapKeepPlan = (cloud: TargetCloud) => {
    selectCloud(cloud);
    setShowChangeDialog(false);
  };

  const handleSwapStartOver = (cloud: TargetCloud) => {
    // Reset the plan entirely, then select the new cloud
    useAppStore.setState({
      networkPlan: null,
      summary: null,
      customTags: [],
      expandedNodes: new Set<string>(),
    });
    selectCloud(cloud);
    setShowChangeDialog(false);
  };

  const handleCancel = () => {
    setShowChangeDialog(false);
  };

  return (
    <header className={styles.header}>
      {/* Customer logo (left side) */}
      <div className={styles.customerLogo} aria-label="Customer logo">
        {branding.logoUrl ? (
          <img src={branding.logoUrl} alt="Customer logo" className={styles.logo} />
        ) : (
          <span className={styles.customerLogoPlaceholder}>&lt;customer:logo&gt;</span>
        )}
      </div>

      <h1 className={styles.title}>{branding.title}</h1>

      {providerProfile && (
        <button
          className={styles.cloudBadge}
          onClick={handleCloudClick}
          title="Click to change cloud provider"
          aria-label={`Current provider: ${providerProfile.displayName}. Click to change.`}
          type="button"
        >
          <CloudProviderLogo cloud={providerProfile.cloudId} />
          <span>{providerProfile.displayName}</span>
        </button>
      )}

      {/* Rackspace logo (right side) */}
      <RackspaceLogo />

      {/* Cloud change dialog */}
      {showChangeDialog && (
        <CloudChangeDialog
          currentCloud={providerProfile?.cloudId ?? 'aws'}
          onSwapKeepPlan={handleSwapKeepPlan}
          onSwapStartOver={handleSwapStartOver}
          onCancel={handleCancel}
        />
      )}
    </header>
  );
}

interface CloudChangeDialogProps {
  currentCloud: TargetCloud;
  onSwapKeepPlan: (cloud: TargetCloud) => void;
  onSwapStartOver: (cloud: TargetCloud) => void;
  onCancel: () => void;
}

function CloudChangeDialog({ currentCloud, onSwapKeepPlan, onSwapStartOver, onCancel }: CloudChangeDialogProps) {
  const [selectedCloud, setSelectedCloud] = useState<TargetCloud | null>(null);

  const otherClouds = CLOUD_OPTIONS.filter((c) => c.id !== currentCloud);

  return (
    <div className={styles.dialogOverlay} onClick={onCancel}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="change-cloud-title">
        <h3 id="change-cloud-title" className={styles.dialogTitle}>Change Cloud Provider</h3>

        {!selectedCloud ? (
          <>
            <p className={styles.dialogMessage}>Select a new cloud provider:</p>
            <div className={styles.cloudOptions}>
              {otherClouds.map((cloud) => (
                <button
                  key={cloud.id}
                  className={styles.cloudOption}
                  onClick={() => setSelectedCloud(cloud.id)}
                  type="button"
                >
                  <CloudProviderLogo cloud={cloud.id} />
                  <span>{cloud.label}</span>
                </button>
              ))}
            </div>
            <div className={styles.dialogActions}>
              <button className={styles.btnCancel} onClick={onCancel} type="button">Cancel</button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.dialogMessage}>
              Switch to <strong>{CLOUD_OPTIONS.find((c) => c.id === selectedCloud)?.label}</strong>. What would you like to do with your current plan?
            </p>
            <div className={styles.dialogActions}>
              <button className={styles.btnCancel} onClick={onCancel} type="button">Cancel</button>
              <button
                className={styles.btnKeep}
                onClick={() => onSwapKeepPlan(selectedCloud)}
                type="button"
              >
                Keep address space
              </button>
              <button
                className={styles.btnStartOver}
                onClick={() => onSwapStartOver(selectedCloud)}
                type="button"
              >
                Start over
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RackspaceLogo() {
  return (
    <img
      src={`${import.meta.env.BASE_URL}icons/Rackspace_Technology_Logo_RGB_WHT.png`}
      alt="Rackspace Technology"
      className={styles.rackspaceLogo}
    />
  );
}

function CloudProviderLogo({ cloud }: { cloud: string }) {
  const base = import.meta.env.BASE_URL;
  const iconMap: Record<string, string> = {
    aws: `${base}icons/aws logo.png`,
    azure: `${base}icons/azure logo.jpeg`,
    gcp: `${base}icons/GCP logo.png`,
    private: `${base}icons/private-cloud.svg`,
  };

  const src = iconMap[cloud] ?? iconMap.private;
  const altMap: Record<string, string> = {
    aws: 'Amazon Web Services',
    azure: 'Microsoft Azure',
    gcp: 'Google Cloud Platform',
    private: 'Private Cloud',
  };

  return (
    <img
      src={src}
      alt={altMap[cloud] ?? 'Cloud Provider'}
      className={styles.cloudIcon}
    />
  );
}
