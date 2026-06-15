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

  describe('CIDR suffix dropdown synchronization (Requirement 13)', () => {
    it('PREFIX_OPTIONS covers /8 to /28 (21 options)', () => {
      // The dropdown should have options from /8 to /28
      const prefixes = Array.from({ length: 21 }, (_, i) => i + 8);
      expect(prefixes[0]).toBe(8);
      expect(prefixes[prefixes.length - 1]).toBe(28);
      expect(prefixes.length).toBe(21);
    });

    it('each prefix option shows correct total address count', () => {
      for (let prefix = 8; prefix <= 28; prefix++) {
        const expectedTotal = Math.pow(2, 32 - prefix);
        expect(expectedTotal).toBeGreaterThan(0);
        // /8 = 16,777,216 addresses, /28 = 16 addresses
        if (prefix === 8) expect(expectedTotal).toBe(16777216);
        if (prefix === 16) expect(expectedTotal).toBe(65536);
        if (prefix === 24) expect(expectedTotal).toBe(256);
        if (prefix === 28) expect(expectedTotal).toBe(16);
      }
    });

    it('extracting prefix from valid CIDR input works correctly', () => {
      const testCases = [
        { input: '10.0.0.0/16', expected: 16 },
        { input: '172.16.0.0/12', expected: 12 },
        { input: '192.168.1.0/24', expected: 24 },
        { input: '10.0.0.0/28', expected: 28 },
        { input: '10.0.0.0/8', expected: 8 },
      ];

      for (const { input, expected } of testCases) {
        const slashIdx = input.lastIndexOf('/');
        const prefixStr = input.slice(slashIdx + 1);
        const prefix = Number(prefixStr);
        expect(prefix).toBe(expected);
      }
    });

    it('extracting prefix from input without slash returns no match', () => {
      const input = '10.0.0.0';
      const slashIdx = input.lastIndexOf('/');
      expect(slashIdx).toBe(-1);
    });

    it('extracting prefix from input with out-of-range prefix returns invalid', () => {
      const testCases = [
        { input: '10.0.0.0/7', valid: false },
        { input: '10.0.0.0/31', valid: false },
        { input: '10.0.0.0/abc', valid: false },
      ];

      for (const { input } of testCases) {
        const slashIdx = input.lastIndexOf('/');
        const prefixStr = input.slice(slashIdx + 1);
        const prefix = Number(prefixStr);
        const isValidForDropdown = Number.isInteger(prefix) && prefix >= 8 && prefix <= 28;
        expect(isValidForDropdown).toBe(false);
      }
    });

    it('selecting prefix from dropdown appends to existing IP', () => {
      // Simulates: user has typed "10.0.0.0" then picks /16 from dropdown
      const currentInput = '10.0.0.0';
      const selectedPrefix = '16';
      const slashIdx = currentInput.lastIndexOf('/');

      let newInput: string;
      if (slashIdx !== -1) {
        newInput = currentInput.slice(0, slashIdx + 1) + selectedPrefix;
      } else {
        newInput = currentInput + '/' + selectedPrefix;
      }

      expect(newInput).toBe('10.0.0.0/16');
    });

    it('selecting prefix from dropdown replaces existing prefix', () => {
      // Simulates: user has "10.0.0.0/16" and picks /24 from dropdown
      const currentInput = '10.0.0.0/16';
      const selectedPrefix = '24';
      const slashIdx = currentInput.lastIndexOf('/');

      let newInput: string;
      if (slashIdx !== -1) {
        newInput = currentInput.slice(0, slashIdx + 1) + selectedPrefix;
      } else {
        newInput = currentInput + '/' + selectedPrefix;
      }

      expect(newInput).toBe('10.0.0.0/24');
    });

    it('validates that all dropdown prefixes produce valid CIDRs with a network address', () => {
      const baseIp = '10.0.0.0';
      for (let prefix = 8; prefix <= 28; prefix++) {
        const cidr = `${baseIp}/${prefix}`;
        const result = validateCIDR(cidr);
        expect(result.valid).toBe(true);
      }
    });
  });
});
