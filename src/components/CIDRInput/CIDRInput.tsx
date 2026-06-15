import { useState, useMemo, useRef, useEffect } from 'react';
import { useAppStore } from '../../store/app-store';
import { useI18n } from '../../i18n';
import { adjustToNetworkAddress, numberToIp, ipToNumber, computeSubnetInfo } from '../../core/subnet-calculator';
import type { ValidationResult, SubnetInfo } from '../../core/types';
import styles from './CIDRInput.module.css';

/** Prefix options for the CIDR suffix dropdown (/8 to /28). */
const PREFIX_OPTIONS = Array.from({ length: 21 }, (_, i) => {
  const prefix = i + 8;
  const totalAddresses = Math.pow(2, 32 - prefix);
  return { prefix, totalAddresses };
});

/**
 * Check if a network address falls within RFC 1918 private address ranges:
 * - 10.0.0.0/8     (10.0.0.0 – 10.255.255.255)
 * - 172.16.0.0/12  (172.16.0.0 – 172.31.255.255)
 * - 192.168.0.0/16 (192.168.0.0 – 192.168.255.255)
 */
function isRfc1918(networkBits: number, prefix: number): boolean {
  const totalAddresses = Math.pow(2, 32 - prefix);
  const endAddress = (networkBits + totalAddresses - 1) >>> 0;

  // 10.0.0.0/8
  const rfc10Start = 0x0A000000; // 10.0.0.0
  const rfc10End = 0x0AFFFFFF;   // 10.255.255.255

  // 172.16.0.0/12
  const rfc172Start = 0xAC100000; // 172.16.0.0
  const rfc172End = 0xAC1FFFFF;   // 172.31.255.255

  // 192.168.0.0/16
  const rfc192Start = 0xC0A80000; // 192.168.0.0
  const rfc192End = 0xC0A8FFFF;   // 192.168.255.255

  // Check if the entire range fits within one of the RFC 1918 blocks
  if (networkBits >= rfc10Start && endAddress <= rfc10End) return true;
  if (networkBits >= rfc172Start && endAddress <= rfc172End) return true;
  if (networkBits >= rfc192Start && endAddress <= rfc192End) return true;

  return false;
}

/**
 * CIDRInput component for entering a network address in CIDR notation.
 *
 * Includes a bidirectionally-synchronized dropdown for prefix length selection.
 * Validates input, auto-adjusts host bits, and displays computed subnet info.
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 13.1–13.7
 */
export function CIDRInput() {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [adjustment, setAdjustment] = useState<{ entered: string; corrected: string } | null>(null);
  const [subnetInfo, setSubnetInfo] = useState<SubnetInfo | null>(null);
  const [vpcWarning, setVpcWarning] = useState<string | null>(null);
  const [rfc1918Warning, setRfc1918Warning] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const setRootCIDR = useAppStore((state) => state.setRootCIDR);
  const providerProfile = useAppStore((state) => state.providerProfile);
  const t = useI18n((s) => s.t);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  /**
   * Derive the currently-selected prefix from the text input.
   * Returns the prefix number if valid, or null if no valid prefix is detected.
   */
  const selectedPrefix = useMemo<number | null>(() => {
    const trimmed = inputValue.trim();
    const slashIdx = trimmed.lastIndexOf('/');
    if (slashIdx === -1) return null;
    const prefixStr = trimmed.slice(slashIdx + 1);
    const prefix = Number(prefixStr);
    if (!Number.isInteger(prefix) || prefix < 8 || prefix > 28) return null;
    return prefix;
  }, [inputValue]);

  /**
   * Handle dropdown selection — update the text input's prefix portion.
   */
  const handlePrefixSelect = (prefix: number) => {
    const newPrefix = String(prefix);
    const trimmed = inputValue.trim();
    const slashIdx = trimmed.lastIndexOf('/');

    if (slashIdx !== -1) {
      setInputValue(trimmed.slice(0, slashIdx + 1) + newPrefix);
    } else if (trimmed.length > 0) {
      setInputValue(trimmed + '/' + newPrefix);
    } else {
      setInputValue('/' + newPrefix);
    }
    setDropdownOpen(false);
  };

  const handleSubmit = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    // Reset previous state
    setError(null);
    setAdjustment(null);
    setSubnetInfo(null);
    setVpcWarning(null);
    setRfc1918Warning(null);

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

    // Check VPC size warning
    if (providerProfile && enteredPrefix < providerProfile.maxVpcPrefix) {
      setVpcWarning(t.vpcSizeWarning.replace('{provider}', providerProfile.displayName).replace('{prefix}', String(providerProfile.maxVpcPrefix)));
    } else {
      setVpcWarning(null);
    }

    // Check RFC 1918 private address space warning
    const networkBits = adjusted.networkAddress.bits;
    if (!isRfc1918(networkBits, enteredPrefix)) {
      setRfc1918Warning(t.rfc1918Warning);
    } else {
      setRfc1918Warning(null);
    }
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
          placeholder={t.cidrPlaceholder}
          aria-label={t.cidrLabel}
          aria-describedby={hasError ? errorId : undefined}
          aria-invalid={hasError}
        />
        <div className={styles.prefixDropdown} ref={dropdownRef}>
          <button
            type="button"
            className={styles.prefixTrigger}
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-label={t.prefixLabel}
            aria-expanded={dropdownOpen}
            aria-haspopup="listbox"
          >
            {selectedPrefix !== null ? `/${selectedPrefix}` : t.prefixPlaceholder}
            <span className={styles.prefixArrow} aria-hidden="true">▾</span>
          </button>
          {dropdownOpen && (
            <ul className={styles.prefixList} role="listbox" aria-label="Prefix length options">
              {PREFIX_OPTIONS.map(({ prefix, totalAddresses }) => (
                <li
                  key={prefix}
                  role="option"
                  aria-selected={prefix === selectedPrefix}
                  className={`${styles.prefixOption} ${prefix === selectedPrefix ? styles.prefixOptionSelected : ''}`}
                  onClick={() => handlePrefixSelect(prefix)}
                >
                  <span className={styles.prefixOptionMask}>/{prefix}</span>
                  <span className={styles.prefixOptionDetail}>{totalAddresses.toLocaleString()} {t.addressesUnit}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          className={styles.submitButton}
          onClick={handleSubmit}
        >
          {t.calculate}
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

      {vpcWarning && (
        <div className={styles.notification} role="status">
          <span className={styles.notificationIcon} aria-hidden="true">⚠️</span>
          <span>{vpcWarning}</span>
        </div>
      )}

      {rfc1918Warning && (
        <div className={styles.error} role="alert">
          <span className={styles.errorIcon} aria-hidden="true">⚠</span>
          <span>{rfc1918Warning}</span>
        </div>
      )}

      {subnetInfo && (
        <div className={styles.subnetInfo} aria-label="Computed subnet information">
          <span className={styles.infoLabel}>{t.networkAddress}:</span>
          <span className={styles.infoValue}>{subnetInfo.networkAddress}</span>

          <span className={styles.infoLabel}>{t.broadcastAddress}:</span>
          <span className={styles.infoValue}>{subnetInfo.broadcastAddress}</span>

          <span className={styles.infoLabel}>{t.subnetMask}:</span>
          <span className={styles.infoValue}>{subnetInfo.subnetMask}</span>

          <span className={styles.infoLabel}>{t.usableHosts}:</span>
          <span className={styles.infoValue}>{subnetInfo.usableHosts.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}
