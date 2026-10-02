import { describe, it, expect, beforeEach } from 'vitest';
import { validateMapExisting, computeSplitPath } from './map-existing-calculator';
import { adjustToNetworkAddress, ipToNumber } from './subnet-calculator';
import { resetIdCounter } from './tree-operations';
import type { CIDRBlock, SubnetNode } from './types';

/**
 * Build a CIDR block from a dotted string + prefix, adjusted to network address.
 */
function cidr(ip: string, prefix: number): CIDRBlock {
  return adjustToNetworkAddress(ipToNumber(ip), prefix);
}

/**
 * Build a leaf SubnetNode, optionally marked as assigned via a label.
 */
function leaf(ip: string, prefix: number, label: string | null = null): SubnetNode {
  return {
    id: `leaf-${ip}-${prefix}`,
    cidr: cidr(ip, prefix),
    children: null,
    tags: [],
    workloadAccount: null,
    availabilityZone: null,
    label,
  };
}

/**
 * Build a split node from two children.
 */
function node(ip: string, prefix: number, children: [SubnetNode, SubnetNode]): SubnetNode {
  return {
    id: `node-${ip}-${prefix}`,
    cidr: cidr(ip, prefix),
    children,
    tags: [],
    workloadAccount: null,
    availabilityZone: null,
    label: null,
  };
}

describe('computeSplitPath', () => {
  it('returns empty path when target equals root', () => {
    const root = cidr('10.0.0.0', 16);
    expect(computeSplitPath(root, cidr('10.0.0.0', 16))).toEqual([]);
  });

  it('picks the left child for the lower half', () => {
    // 10.0.0.0/16 -> /17: left half is 10.0.0.0/17
    const root = cidr('10.0.0.0', 16);
    expect(computeSplitPath(root, cidr('10.0.0.0', 17))).toEqual([0]);
  });

  it('picks the right child for the upper half', () => {
    // 10.0.0.0/16 -> /17: right half is 10.0.128.0/17
    const root = cidr('10.0.0.0', 16);
    expect(computeSplitPath(root, cidr('10.0.128.0', 17))).toEqual([1]);
  });

  it('computes a multi-level path to a /24', () => {
    // 10.0.0.0/16 down to 10.0.1.0/24
    const root = cidr('10.0.0.0', 16);
    const path = computeSplitPath(root, cidr('10.0.1.0', 24));
    expect(path).toHaveLength(8);
    // 10.0.1.0 = ...00000001.00000000; the 8 bits after /16 are 00000001
    expect(path).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
  });
});

describe('validateMapExisting', () => {
  beforeEach(() => {
    resetIdCounter();
  });

  const root = cidr('10.0.0.0', 16);

  it('accepts a CIDR contained within an empty root', () => {
    const tree = leaf('10.0.0.0', 16);
    const result = validateMapExisting(tree, root, cidr('10.0.1.0', 24));
    expect('type' in result).toBe(false);
    if (!('type' in result)) {
      expect(result.cidr.prefixLength).toBe(24);
      expect(result.path).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
    }
  });

  it('rejects a CIDR larger than the root', () => {
    const tree = leaf('10.0.0.0', 16);
    const result = validateMapExisting(tree, root, cidr('10.0.0.0', 15));
    expect('type' in result).toBe(true);
    if ('type' in result) expect(result.type).toBe('prefix_too_small');
  });

  it('rejects a CIDR outside the root range', () => {
    const tree = leaf('10.0.0.0', 16);
    const result = validateMapExisting(tree, root, cidr('192.168.1.0', 24));
    expect('type' in result).toBe(true);
    if ('type' in result) expect(result.type).toBe('not_contained');
  });

  it('rejects a CIDR that overlaps an assigned subnet', () => {
    // Tree: 10.0.0.0/16 split into 10.0.0.0/17 (assigned) and 10.0.128.0/17 (free)
    const tree = node('10.0.0.0', 16, [
      leaf('10.0.0.0', 17, 'Existing Prod'),
      leaf('10.0.128.0', 17),
    ]);
    // Try to map 10.0.1.0/24 which falls inside the assigned 10.0.0.0/17
    const result = validateMapExisting(tree, root, cidr('10.0.1.0', 24));
    expect('type' in result).toBe(true);
    if ('type' in result) expect(result.type).toBe('overlaps_allocation');
  });

  it('reports already_mapped when the exact block is already assigned', () => {
    const tree = node('10.0.0.0', 16, [
      leaf('10.0.0.0', 17, 'Existing Prod'),
      leaf('10.0.128.0', 17),
    ]);
    const result = validateMapExisting(tree, root, cidr('10.0.0.0', 17));
    expect('type' in result).toBe(true);
    if ('type' in result) expect(result.type).toBe('already_mapped');
  });

  it('accepts a CIDR in the free half when the other half is assigned', () => {
    const tree = node('10.0.0.0', 16, [
      leaf('10.0.0.0', 17, 'Existing Prod'),
      leaf('10.0.128.0', 17),
    ]);
    const result = validateMapExisting(tree, root, cidr('10.0.192.0', 18));
    expect('type' in result).toBe(false);
  });
});
