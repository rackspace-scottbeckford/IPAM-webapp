import { describe, it, expect } from 'vitest';
import { validateCIDR, validateTagName, validateTextField, validateCustomTagCount } from './input-validator';

describe('validateCIDR', () => {
  describe('valid inputs', () => {
    it('accepts a standard CIDR block', () => {
      const result = validateCIDR('10.0.0.0/16');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.cidr.prefixLength).toBe(16);
        expect(result.cidr.networkAddress.bits).toBe(0x0a000000);
      }
    });

    it('accepts minimum prefix /8', () => {
      const result = validateCIDR('10.0.0.0/8');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.cidr.prefixLength).toBe(8);
      }
    });

    it('accepts maximum prefix /30', () => {
      const result = validateCIDR('192.168.1.0/30');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.cidr.prefixLength).toBe(30);
      }
    });

    it('accepts address with host bits set (no auto-adjustment)', () => {
      const result = validateCIDR('10.0.0.5/16');
      expect(result.valid).toBe(true);
      if (result.valid) {
        // Validator does NOT adjust host bits — returns as-is
        expect(result.cidr.networkAddress.bits).toBe(0x0a000005);
        expect(result.cidr.prefixLength).toBe(16);
      }
    });

    it('accepts 255.255.255.252/30', () => {
      const result = validateCIDR('255.255.255.252/30');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.cidr.networkAddress.bits).toBe(0xfffffffc);
      }
    });
  });

  describe('malformed format', () => {
    it('rejects empty string', () => {
      const result = validateCIDR('');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('missing_prefix');
      }
    });

    it('rejects input with fewer than 4 octets', () => {
      const result = validateCIDR('10.0.0/16');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('malformed_format');
      }
    });

    it('rejects input with more than 4 octets', () => {
      const result = validateCIDR('10.0.0.0.0/16');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('malformed_format');
      }
    });

    it('rejects non-numeric octets', () => {
      const result = validateCIDR('10.abc.0.0/16');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('malformed_format');
      }
    });

    it('rejects octets with leading spaces', () => {
      const result = validateCIDR('10. 0.0.0/16');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('malformed_format');
      }
    });
  });

  describe('octet out of range', () => {
    it('rejects octet value 256', () => {
      const result = validateCIDR('256.0.0.0/16');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('octet_out_of_range');
      }
    });

    it('rejects octet value 999', () => {
      const result = validateCIDR('10.0.999.0/16');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('octet_out_of_range');
      }
    });
  });

  describe('missing prefix', () => {
    it('rejects input without slash', () => {
      const result = validateCIDR('10.0.0.0');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('missing_prefix');
      }
    });

    it('rejects input with slash but no number', () => {
      const result = validateCIDR('10.0.0.0/');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('missing_prefix');
      }
    });

    it('rejects input with non-numeric prefix', () => {
      const result = validateCIDR('10.0.0.0/abc');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('missing_prefix');
      }
    });
  });

  describe('prefix out of range', () => {
    it('rejects prefix /7 (below minimum)', () => {
      const result = validateCIDR('10.0.0.0/7');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('prefix_out_of_range');
      }
    });

    it('rejects prefix /31 (above maximum)', () => {
      const result = validateCIDR('10.0.0.0/31');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('prefix_out_of_range');
      }
    });

    it('rejects prefix /0', () => {
      const result = validateCIDR('0.0.0.0/0');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('prefix_out_of_range');
      }
    });

    it('rejects prefix /32', () => {
      const result = validateCIDR('10.0.0.1/32');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('prefix_out_of_range');
      }
    });
  });
});


describe('validateTagName', () => {
  it('accepts a 1-character name', () => {
    expect(validateTagName('a')).toBe(true);
  });

  it('accepts a 32-character name', () => {
    expect(validateTagName('a'.repeat(32))).toBe(true);
  });

  it('accepts names within the valid range', () => {
    expect(validateTagName('transit-gateway')).toBe(true);
    expect(validateTagName('workload')).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(validateTagName('')).toBe(false);
  });

  it('rejects a 33-character name', () => {
    expect(validateTagName('a'.repeat(33))).toBe(false);
  });
});

describe('validateTextField', () => {
  it('accepts a 1-character value', () => {
    expect(validateTextField('x')).toBe(true);
  });

  it('accepts a 64-character value', () => {
    expect(validateTextField('b'.repeat(64))).toBe(true);
  });

  it('accepts values within the valid range', () => {
    expect(validateTextField('us-east-1a')).toBe(true);
    expect(validateTextField('workload-account-prod')).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(validateTextField('')).toBe(false);
  });

  it('rejects a 65-character value', () => {
    expect(validateTextField('c'.repeat(65))).toBe(false);
  });
});

describe('validateCustomTagCount', () => {
  it('allows adding when current count is 0', () => {
    expect(validateCustomTagCount(0)).toBe(true);
  });

  it('allows adding when current count is 19', () => {
    expect(validateCustomTagCount(19)).toBe(true);
  });

  it('rejects adding when current count is 20', () => {
    expect(validateCustomTagCount(20)).toBe(false);
  });

  it('rejects adding when current count exceeds 20', () => {
    expect(validateCustomTagCount(21)).toBe(false);
  });
});
