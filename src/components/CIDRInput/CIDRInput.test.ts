import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../store/app-store';
import { validateCIDR } from '../../core/input-validator';
import { adjustToNetworkAddress, ipToNumber, numberToIp, computeSubnetInfo } from '../../core/subnet-calculator';

/**
 * Tests for CIDRInput component logic.
 * Since no DOM testing library is available, these tests validate the
 * underlying logic that the component orchestrates:
 * - Input validation with specific error messages
 * - Host-bit adjustment detection
 * - Subnet info computation on valid input
 */
describe('CIDRInput logic', () => {
  beforeEach(() => {
    useAppStore.setState({
      targetCloud: null,
      providerProfile: null,
      networkPlan: null,
      customTags: [],
      summary: null,
      expandedNodes: new Set<string>(),
      activeView: 'tree',
    });
  });

  describe('validation error messages', () => {
    it('returns error for missing prefix', () => {
      const result = validateCIDR('10.0.0.0');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('missing_prefix');
        expect(result.error.message).toContain('Missing prefix');
      }
    });

    it('returns error for malformed IP format', () => {
      const result = validateCIDR('10.0.0/16');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('malformed_format');
        expect(result.error.message).toContain('Invalid format');
      }
    });

    it('returns error for octet out of range', () => {
      const result = validateCIDR('10.0.256.0/16');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('octet_out_of_range');
        expect(result.error.message).toContain('out of range');
      }
    });

    it('returns error for prefix out of range (too small)', () => {
      const result = validateCIDR('10.0.0.0/7');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('prefix_out_of_range');
        expect(result.error.message).toContain('/8 to /30');
      }
    });

    it('returns error for prefix out of range (too large)', () => {
      const result = validateCIDR('10.0.0.0/31');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('prefix_out_of_range');
        expect(result.error.message).toContain('/8 to /30');
      }
    });

    it('returns error for non-numeric prefix', () => {
      const result = validateCIDR('10.0.0.0/abc');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('missing_prefix');
      }
    });
  });

  describe('host-bit adjustment detection', () => {
    it('detects when host bits are set', () => {
      const input = '10.0.1.5/16';
      const result = validateCIDR(input);
      expect(result.valid).toBe(true);
      if (!result.valid) return;

      const enteredIp = input.split('/')[0];
      const enteredBits = ipToNumber(enteredIp);
      const adjusted = adjustToNetworkAddress(enteredBits, result.cidr.prefixLength);
      const adjustedIp = numberToIp(adjusted.networkAddress.bits);

      expect(enteredIp).toBe('10.0.1.5');
      expect(adjustedIp).toBe('10.0.0.0');
      expect(enteredIp).not.toBe(adjustedIp);
    });

    it('does not flag adjustment when address is already a network address', () => {
      const input = '10.0.0.0/16';
      const result = validateCIDR(input);
      expect(result.valid).toBe(true);
      if (!result.valid) return;

      const enteredIp = input.split('/')[0];
      const enteredBits = ipToNumber(enteredIp);
      const adjusted = adjustToNetworkAddress(enteredBits, result.cidr.prefixLength);
      const adjustedIp = numberToIp(adjusted.networkAddress.bits);

      expect(enteredIp).toBe(adjustedIp);
    });

    it('detects adjustment for 192.168.1.100/24', () => {
      const input = '192.168.1.100/24';
      const result = validateCIDR(input);
      expect(result.valid).toBe(true);
      if (!result.valid) return;

      const enteredIp = input.split('/')[0];
      const enteredBits = ipToNumber(enteredIp);
      const adjusted = adjustToNetworkAddress(enteredBits, result.cidr.prefixLength);
      const adjustedIp = numberToIp(adjusted.networkAddress.bits);

      expect(adjustedIp).toBe('192.168.1.0');
      expect(enteredIp).not.toBe(adjustedIp);
    });
  });

  describe('subnet info computation on valid input', () => {
    it('computes correct info for 10.0.0.0/16 with AWS (5 reserved)', () => {
      const cidr = adjustToNetworkAddress(ipToNumber('10.0.0.0'), 16);
      const info = computeSubnetInfo(cidr, 5);

      expect(info.networkAddress).toBe('10.0.0.0');
      expect(info.broadcastAddress).toBe('10.0.255.255');
      expect(info.subnetMask).toBe('255.255.0.0');
      expect(info.usableHosts).toBe(65536 - 5);
    });

    it('computes correct info for 192.168.1.0/24 with GCP (4 reserved)', () => {
      const cidr = adjustToNetworkAddress(ipToNumber('192.168.1.0'), 24);
      const info = computeSubnetInfo(cidr, 4);

      expect(info.networkAddress).toBe('192.168.1.0');
      expect(info.broadcastAddress).toBe('192.168.1.255');
      expect(info.subnetMask).toBe('255.255.255.0');
      expect(info.usableHosts).toBe(256 - 4);
    });

    it('computes correct info for 172.16.0.0/30 with Private (2 reserved)', () => {
      const cidr = adjustToNetworkAddress(ipToNumber('172.16.0.0'), 30);
      const info = computeSubnetInfo(cidr, 2);

      expect(info.networkAddress).toBe('172.16.0.0');
      expect(info.broadcastAddress).toBe('172.16.0.3');
      expect(info.subnetMask).toBe('255.255.255.252');
      expect(info.usableHosts).toBe(4 - 2);
    });
  });

  describe('store integration - setRootCIDR requires cloud selection', () => {
    it('returns error when no cloud is selected', () => {
      const store = useAppStore.getState();
      const result = store.setRootCIDR('10.0.0.0/16');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.message).toContain('select a target cloud');
      }
    });

    it('succeeds when cloud is selected', () => {
      const store = useAppStore.getState();
      store.selectCloud('aws');
      const result = useAppStore.getState().setRootCIDR('10.0.0.0/16');
      expect(result.valid).toBe(true);
    });
  });

  describe('input constraints', () => {
    it('maxLength of 18 accommodates longest valid CIDR (255.255.255.255/30)', () => {
      // Longest valid input: "255.255.255.252/30" = 18 chars
      const longest = '255.255.255.252/30';
      expect(longest.length).toBeLessThanOrEqual(18);

      const result = validateCIDR(longest);
      expect(result.valid).toBe(true);
    });
  });
});
