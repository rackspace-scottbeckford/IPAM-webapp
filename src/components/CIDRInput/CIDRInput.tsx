import { useState } from 'react';
import { useAppStore } from '../../store/app-store';
import { adjustToNetworkAddress, numberToIp, ipToNumber, computeSubnetInfo } from '../../core/subnet-calculator';
import type { ValidationResult, SubnetInfo } from '../../core/types';
import styles from './CIDRInput.module.css';

/**
 * CIDRInput component for entering a network address in CIDR notation.
 *
 * Validates input, auto-adjusts host bits, and displays computed subnet info.
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */
export function CIDRInput() {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [adjustment, setAdjustment] = useState<{ entered: string; corrected: string } | null>(null);
  const [subnetInfo, setSubnetInfo] = useState<SubnetInfo | null>(null);

  const setRootCIDR = useAppStore((state) => state.setRootCIDR);
  const providerProfile = useAppStore((state) => state.providerProfile);

  const handleSubmit = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    // Reset previous state
    setError(null);
    setAdjustment(null);
    setSubnetInfo(null);

    const result: ValidationResult = setRootCIDR(trimmed);

    if (!result.valid) {
      setError(result.error.message);
      return;
    }

    // Check for host-bit adjustment
    const enteredIp = trimmed.split('/')[0];
    const enteredPrefix = result.cidr.prefixLength;
    const enteredBits = ipToNumber(enteredIp);
    const adjusted = adjustToNetworkAddress(enteredBits, enteredPrefix);
    const adjustedIp = numberToIp(adjusted.networkAddress.bits);

    if (enteredIp !== adjustedIp) {
      setAdjustment({
        entered: `${enteredIp}/${enteredPrefix}`,
        corrected: `${adjustedIp}/${enteredPrefix}`,
      });
    }

    // Compute and display subnet info
    const reservedCount = providerProfile?.reservedIPs ?? 2;
    const info = computeSubnetInfo(adjusted, reservedCount);
    setSubnetInfo(info);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const errorId = 'cidr-input-error';
  const hasError = error !== null;

  return (
    <div className={styles.container}>
      <div className={styles.inputRow}>
        <input
          type="text"
          className={`${styles.input} ${hasError ? styles.inputError : ''}`}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={18}
          placeholder="e.g., 10.0.0.0/16"
          aria-label="Network address in CIDR notation"
          aria-describedby={hasError ? errorId : undefined}
          aria-invalid={hasError}
        />
        <button
          type="button"
          className={styles.submitButton}
          onClick={handleSubmit}
        >
          Calculate
        </button>
      </div>

      {hasError && (
        <div id={errorId} className={styles.error} role="alert">
          <span className={styles.errorIcon} aria-hidden="true">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {adjustment && (
        <div className={styles.notification} role="status">
          <span className={styles.notificationIcon} aria-hidden="true">ℹ</span>
          <span>
            Adjusted to network address: {adjustment.corrected} (entered: {adjustment.entered})
          </span>
        </div>
      )}

      {subnetInfo && (
        <div className={styles.subnetInfo} aria-label="Computed subnet information">
          <span className={styles.infoLabel}>Network Address:</span>
          <span className={styles.infoValue}>{subnetInfo.networkAddress}</span>

          <span className={styles.infoLabel}>Broadcast Address:</span>
          <span className={styles.infoValue}>{subnetInfo.broadcastAddress}</span>

          <span className={styles.infoLabel}>Subnet Mask:</span>
          <span className={styles.infoValue}>{subnetInfo.subnetMask}</span>

          <span className={styles.infoLabel}>Usable Hosts:</span>
          <span className={styles.infoValue}>{subnetInfo.usableHosts.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}
