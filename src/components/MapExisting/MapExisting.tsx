import { useState } from 'react';
import { useAppStore } from '../../store/app-store';
import { useI18n } from '../../i18n';
import { validateCIDR } from '../../core/input-validator';
import { adjustToNetworkAddress, numberToIp } from '../../core/subnet-calculator';
import type { CIDRBlock } from '../../core/types';
import styles from './MapExisting.module.css';

/**
 * Format a CIDR block as a human-readable string (e.g., "10.0.1.0/24").
 */
function formatCIDR(cidr: CIDRBlock): string {
  return `${numberToIp(cidr.networkAddress.bits)}/${cidr.prefixLength}`;
}

/**
 * Dialog state machine for the Map Existing flow.
 */
type DialogState =
  | { step: 'closed' }
  | { step: 'input' }
  | { step: 'confirm'; name: string; cidr: CIDRBlock }
  | { step: 'error'; message: string }
  | { step: 'success'; name: string; cidr: CIDRBlock };

/**
 * MapExisting component — a companion to CreateWorkload.
 *
 * Instead of auto-allocating the next available subnet for a requested number
 * of IPs, this lets the user map an *existing* CIDR block (one they've already
 * allocated elsewhere) into the current plan's tree. The subnet must fall within
 * the root network and must not overlap any existing allocation.
 */
export function MapExisting() {
  const [dialogState, setDialogState] = useState<DialogState>({ step: 'closed' });
  const [workloadName, setWorkloadName] = useState('');
  const [cidrInput, setCidrInput] = useState('');

  const networkPlan = useAppStore((state) => state.networkPlan);
  const providerProfile = useAppStore((state) => state.providerProfile);
  const mapExistingCIDR = useAppStore((state) => state.mapExistingCIDR);
  const t = useI18n((s) => s.t);

  const canMap = networkPlan !== null && providerProfile !== null;

  const handleOpen = () => {
    setWorkloadName('');
    setCidrInput('');
    setDialogState({ step: 'input' });
  };

  const handleClose = () => {
    setDialogState({ step: 'closed' });
  };

  const handleValidate = () => {
    if (!networkPlan || !providerProfile) return;

    const name = workloadName.trim();
    if (name.length < 1 || name.length > 64) {
      setDialogState({ step: 'error', message: 'Workload name must be 1–64 characters.' });
      return;
    }

    // Parse the CIDR for a preview; the store performs full containment/overlap
    // validation on confirm, but we surface syntax errors early here.
    const parsed = validateCIDR(cidrInput.trim());
    if (!parsed.valid) {
      setDialogState({ step: 'error', message: parsed.error.message });
      return;
    }

    const adjusted = adjustToNetworkAddress(
      parsed.cidr.networkAddress.bits,
      parsed.cidr.prefixLength
    );

    setDialogState({ step: 'confirm', name, cidr: adjusted });
  };

  const handleConfirm = () => {
    if (dialogState.step !== 'confirm') return;

    const { name } = dialogState;
    const result = mapExistingCIDR(cidrInput.trim(), name);

    if ('type' in result) {
      setDialogState({ step: 'error', message: result.message });
      return;
    }

    setDialogState({ step: 'success', name: result.name, cidr: result.cidr });
  };

  return (
    <>
      <button
        type="button"
        className={styles.mapButton}
        onClick={handleOpen}
        disabled={!canMap}
        aria-label={t.mapExisting}
        title={!canMap ? t.selectCloudFirst : t.mapExisting}
      >
        {t.mapExisting}
      </button>

      {dialogState.step !== 'closed' && (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={t.mapExistingTitle}>
          <div className={styles.dialog}>
            {dialogState.step === 'input' && (
              <>
                <h2 className={styles.title}>{t.mapExistingTitle}</h2>
                <p className={styles.description}>{t.mapExistingDescription}</p>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="map-workload-name">
                    {t.workloadName}
                  </label>
                  <input
                    id="map-workload-name"
                    type="text"
                    className={styles.input}
                    value={workloadName}
                    onChange={(e) => setWorkloadName(e.target.value)}
                    maxLength={64}
                    placeholder="e.g., Legacy Database"
                    autoFocus
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="map-existing-cidr">
                    {t.existingCIDR}
                  </label>
                  <input
                    id="map-existing-cidr"
                    type="text"
                    className={styles.input}
                    value={cidrInput}
                    onChange={(e) => setCidrInput(e.target.value)}
                    placeholder="e.g., 10.0.1.0/24"
                  />
                  {networkPlan && (
                    <span className={styles.hint}>
                      {t.networkAddress}: {formatCIDR(networkPlan.rootCIDR)}
                    </span>
                  )}
                </div>

                <div className={styles.actions}>
                  <button type="button" className={styles.cancelButton} onClick={handleClose}>
                    {t.cancel}
                  </button>
                  <button type="button" className={styles.primaryButton} onClick={handleValidate}>
                    {t.calculate}
                  </button>
                </div>
              </>
            )}

            {dialogState.step === 'confirm' && (
              <>
                <h2 className={styles.title}>{t.mapExistingTitle}</h2>

                <div className={styles.suggestion}>
                  <div className={styles.suggestionRow}>
                    <span className={styles.suggestionLabel}>{t.workloadName}:</span>
                    <span className={styles.suggestionValue}>{dialogState.name}</span>
                  </div>
                  <div className={styles.suggestionRow}>
                    <span className={styles.suggestionLabel}>{t.existingCIDR}:</span>
                    <span className={styles.suggestionValue}>{formatCIDR(dialogState.cidr)}</span>
                  </div>
                  <div className={styles.suggestionRow}>
                    <span className={styles.suggestionLabel}>{t.totalAddresses}:</span>
                    <span className={styles.suggestionValue}>
                      {Math.pow(2, 32 - dialogState.cidr.prefixLength).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className={styles.actions}>
                  <button type="button" className={styles.cancelButton} onClick={handleClose}>
                    {t.cancel}
                  </button>
                  <button type="button" className={styles.primaryButton} onClick={handleConfirm}>
                    {t.mapSubnet}
                  </button>
                </div>
              </>
            )}

            {dialogState.step === 'error' && (
              <>
                <h2 className={styles.title}>{t.cannotMapExisting}</h2>
                <p className={styles.errorMessage}>{dialogState.message}</p>
                <div className={styles.actions}>
                  <button type="button" className={styles.cancelButton} onClick={handleClose}>
                    {t.close}
                  </button>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => setDialogState({ step: 'input' })}
                  >
                    {t.tryAgain}
                  </button>
                </div>
              </>
            )}

            {dialogState.step === 'success' && (
              <>
                <h2 className={styles.title}>{t.subnetMapped}</h2>
                <p className={styles.successMessage}>
                  {t.mappedSubnetFor
                    .replace('{cidr}', formatCIDR(dialogState.cidr))
                    .replace('{name}', dialogState.name)}
                </p>
                <div className={styles.actions}>
                  <button type="button" className={styles.primaryButton} onClick={handleClose}>
                    {t.done}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
