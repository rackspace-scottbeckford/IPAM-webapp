import { useState } from 'react';
import type { TargetCloud } from '../../core/types';
import { useAppStore } from '../../store/app-store';
import { getProfile } from '../../config/cloud-profiles';
import styles from './CloudSelector.module.css';

const CLOUD_OPTIONS: { id: TargetCloud; label: string; accent: string; icon: string }[] = [
  { id: 'aws', label: 'Amazon Web Services', accent: '#FF9900', icon: '/icons/aws.svg' },
  { id: 'azure', label: 'Microsoft Azure', accent: '#0078D4', icon: '/icons/azure.svg' },
  { id: 'gcp', label: 'Google Cloud Platform', accent: '#4285F4', icon: '/icons/gcp.svg' },
  { id: 'stackit', label: 'STACKIT Cloud', accent: '#1A5C5C', icon: '/icons/stackit-logo.svg' },
  { id: 'private', label: 'Private Cloud', accent: '#6B7280', icon: '/icons/private-cloud.svg' },
];

export function CloudSelector() {
  const targetCloud = useAppStore((s) => s.targetCloud);
  const networkPlan = useAppStore((s) => s.networkPlan);
  const selectCloud = useAppStore((s) => s.selectCloud);

  const [pendingCloud, setPendingCloud] = useState<TargetCloud | null>(null);
  const [incompatibleTags, setIncompatibleTags] = useState<string[]>([]);

  const handleSelect = (cloud: TargetCloud) => {
    // If there's an existing plan with tags, we need to check for incompatible tags
    if (networkPlan && targetCloud && cloud !== targetCloud) {
      // Peek at what tags would be removed by checking the reconciliation
      const result = selectCloud(cloud);
      if (result.removedTags && result.removedTags.length > 0) {
        // Tags were already removed by selectCloud — but we want to confirm first.
        // Since selectCloud already mutated state, we need a different approach:
        // We'll preview the change before committing.
        // Actually, let's revert and show the dialog instead.
        // Re-select the original cloud to undo
        selectCloud(targetCloud);
        setPendingCloud(cloud);
        setIncompatibleTags(result.removedTags);
        return;
      }
      // No tags removed, selection already applied
      return;
    }

    selectCloud(cloud);
  };

  const confirmChange = () => {
    if (pendingCloud) {
      selectCloud(pendingCloud);
      setPendingCloud(null);
      setIncompatibleTags([]);
    }
  };

  const cancelChange = () => {
    setPendingCloud(null);
    setIncompatibleTags([]);
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>Select Your Cloud Provider</h2>
      <p className={styles.subheading}>Choose a target cloud to begin planning your IP address allocation.</p>

      <div className={styles.grid} role="radiogroup" aria-label="Cloud provider selection">
        {CLOUD_OPTIONS.map((option) => (
          <button
            key={option.id}
            className={`${styles.card} ${targetCloud === option.id ? styles.cardSelected : ''}`}
            style={{ '--card-accent': option.accent } as React.CSSProperties}
            onClick={() => handleSelect(option.id)}
            role="radio"
            aria-checked={targetCloud === option.id}
            aria-label={option.label}
          >
            <img
              src={option.icon}
              alt=""
              className={styles.cardIcon}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <span className={styles.cardName}>{option.label}</span>
          </button>
        ))}
      </div>

      {pendingCloud && incompatibleTags.length > 0 && (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className={styles.dialog}>
            <h3 id="confirm-title" className={styles.dialogTitle}>
              Change Cloud Provider?
            </h3>
            <p className={styles.dialogMessage}>
              Switching to <strong>{getProfile(pendingCloud).displayName}</strong> will remove the following
              incompatible tags from your subnets:
            </p>
            <ul className={styles.tagList}>
              {incompatibleTags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
            <div className={styles.dialogActions}>
              <button className={styles.btnCancel} onClick={cancelChange}>
                Cancel
              </button>
              <button className={styles.btnConfirm} onClick={confirmChange}>
                Confirm Change
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
