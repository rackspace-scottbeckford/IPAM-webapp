import type { CIDRBlock, SubnetInfo } from './types';

/**
 * Convert a dotted-decimal IPv4 address string to a 32-bit unsigned integer.
 *
 * @param dotted - IPv4 address in "A.B.C.D" format
 * @returns 32-bit unsigned integer representation
 */
export function ipToNumber(dotted: string): number {
  const octets = dotted.split('.');
  return (
    ((parseInt(octets[0], 10) << 24) |
      (parseInt(octets[1], 10) << 16) |
      (parseInt(octets[2], 10) << 8) |
      parseInt(octets[3], 10)) >>>
    0
  );
}

/**
 * Convert a 32-bit unsigned integer to a dotted-decimal IPv4 address string.
 *
 * @param bits - 32-bit unsigned integer representation
 * @returns IPv4 address in "A.B.C.D" format
 */
export function numberToIp(bits: number): string {
  return [
    (bits >>> 24) & 0xff,
    (bits >>> 16) & 0xff,
    (bits >>> 8) & 0xff,
    bits & 0xff,
  ].join('.');
}

/**
 * Generate a subnet mask as a 32-bit unsigned integer from a prefix length.
 *
 * @param prefix - CIDR prefix length (0–32)
 * @returns 32-bit unsigned integer subnet mask with `prefix` leading 1-bits
 */
export function prefixToMask(prefix: number): number {
  if (prefix === 0) return 0;
  return (~0 << (32 - prefix)) >>> 0;
}

/**
 * Zero the host bits of an IP address given a prefix length, producing a CIDRBlock
 * with the correct network address.
 *
 * @param ip - 32-bit unsigned integer IP address
 * @param prefix - CIDR prefix length (8–30)
 * @returns CIDRBlock with the network address (host bits zeroed)
 */
export function adjustToNetworkAddress(ip: number, prefix: number): CIDRBlock {
  const mask = prefixToMask(prefix);
  const networkBits = (ip & mask) >>> 0;
  return {
    networkAddress: { bits: networkBits },
    prefixLength: prefix,
  };
}

/**
 * Compute full subnet information for a given CIDR block and reserved address count.
 *
 * Calculates network address, broadcast address, subnet mask, total addresses,
 * and usable hosts (total minus reserved, floored at 0).
 *
 * @param cidr - The CIDR block to compute info for
 * @param reservedCount - Number of provider-reserved addresses to subtract
 * @returns SubnetInfo with all computed fields
 */
export function computeSubnetInfo(cidr: CIDRBlock, reservedCount: number): SubnetInfo {
  const mask = prefixToMask(cidr.prefixLength);
  const networkBits = (cidr.networkAddress.bits & mask) >>> 0;
  const totalAddresses = Math.pow(2, 32 - cidr.prefixLength);
  const broadcastBits = (networkBits | (~mask >>> 0)) >>> 0;
  const usableHosts = Math.max(0, totalAddresses - reservedCount);

  return {
    cidr,
    networkAddress: numberToIp(networkBits),
    broadcastAddress: numberToIp(broadcastBits),
    subnetMask: numberToIp(mask),
    totalAddresses,
    usableHosts,
    reservedCount,
  };
}
