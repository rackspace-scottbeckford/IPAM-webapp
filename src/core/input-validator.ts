import type { ValidationResult, CIDRBlock } from './types';
import { ipToNumber } from './subnet-calculator';

/**
 * Validates a CIDR notation input string.
 *
 * Checks in order:
 * 1. Format: four decimal octets separated by dots, followed by "/" and a numeric prefix
 * 2. Octet range: each octet must be 0–255
 * 3. Prefix presence: must have a "/" followed by a number
 * 4. Prefix range: must be 8–30
 *
 * On success, returns the parsed CIDRBlock (without host-bit adjustment).
 */
export function validateCIDR(input: string): ValidationResult {
  // Check for the presence of a slash separator
  const slashIndex = input.indexOf('/');
  if (slashIndex === -1) {
    return {
      valid: false,
      error: {
        type: 'missing_prefix',
        message: 'Missing prefix length. Enter in CIDR notation (e.g., 10.0.0.0/16)',
      },
    };
  }

  const ipPart = input.substring(0, slashIndex);
  const prefixPart = input.substring(slashIndex + 1);

  // Check that the prefix part is a non-empty numeric value
  if (prefixPart === '' || !/^\d+$/.test(prefixPart)) {
    return {
      valid: false,
      error: {
        type: 'missing_prefix',
        message: 'Missing or non-numeric prefix length. Enter a number after "/" (e.g., /16)',
      },
    };
  }

  // Validate IP format: must be exactly four dot-separated decimal groups
  const octets = ipPart.split('.');
  if (octets.length !== 4) {
    return {
      valid: false,
      error: {
        type: 'malformed_format',
        message: 'Invalid format. Enter as X.X.X.X/N (e.g., 10.0.0.0/16)',
      },
    };
  }

  // Check each octet is a valid decimal number in range 0–255
  for (const octet of octets) {
    if (octet === '' || !/^\d+$/.test(octet)) {
      return {
        valid: false,
        error: {
          type: 'malformed_format',
          message: 'Invalid format. Each octet must be a decimal number (e.g., 10.0.0.0/16)',
        },
      };
    }
    const value = Number(octet);
    if (value < 0 || value > 255) {
      return {
        valid: false,
        error: {
          type: 'octet_out_of_range',
          message: `Octet value ${value} is out of range. Each octet must be 0–255`,
        },
      };
    }
  }

  // Validate prefix range: must be 8–30
  const prefix = Number(prefixPart);
  if (prefix < 8 || prefix > 30) {
    return {
      valid: false,
      error: {
        type: 'prefix_out_of_range',
        message: `Prefix /${prefix} is out of range. Supported range is /8 to /30`,
      },
    };
  }

  // All checks passed — construct the CIDRBlock
  const networkBits = ipToNumber(ipPart);
  const cidr: CIDRBlock = {
    networkAddress: { bits: networkBits },
    prefixLength: prefix,
  };

  return { valid: true, cidr };
}


/**
 * Validates a custom tag name.
 * Must be between 1 and 32 characters inclusive.
 */
export function validateTagName(name: string): boolean {
  return name.length >= 1 && name.length <= 32;
}

/**
 * Validates a text field value (workload account, availability zone, or label).
 * Must be between 1 and 64 characters inclusive.
 */
export function validateTextField(value: string): boolean {
  return value.length >= 1 && value.length <= 64;
}

/**
 * Validates whether another custom tag can be added.
 * Maximum of 20 custom tags allowed.
 * @param current - The current number of custom tags
 * @returns true if another tag can be added (current < 20)
 */
export function validateCustomTagCount(current: number): boolean {
  return current < 20;
}
