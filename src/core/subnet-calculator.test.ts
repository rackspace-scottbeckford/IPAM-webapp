import { describe, it, expect } from 'vitest';
import {
  ipToNumber,
  numberToIp,
  prefixToMask,
  adjustToNetworkAddress,
  computeSubnetInfo,
} from './subnet-calculator';

describe('ipToNumber', () => {
  it('converts 0.0.0.0 to 0', () => {
    expect(ipToNumber('0.0.0.0')).toBe(0);
  });

  it('converts 255.255.255.255 to 4294967295', () => {
    expect(ipToNumber('255.255.255.255')).toBe(4294967295);
  });

  it('converts 10.0.0.0 correctly', () => {
    expect(ipToNumber('10.0.0.0')).toBe(167772160);
  });

  it('converts 192.168.1.1 correctly', () => {
    expect(ipToNumber('192.168.1.1')).toBe(3232235777);
  });

  it('converts 172.16.0.0 correctly', () => {
    expect(ipToNumber('172.16.0.0')).toBe(2886729728);
  });
});

describe('numberToIp', () => {
  it('converts 0 to 0.0.0.0', () => {
    expect(numberToIp(0)).toBe('0.0.0.0');
  });

  it('converts 4294967295 to 255.255.255.255', () => {
    expect(numberToIp(4294967295)).toBe('255.255.255.255');
  });

  it('converts 167772160 to 10.0.0.0', () => {
    expect(numberToIp(167772160)).toBe('10.0.0.0');
  });

  it('converts 3232235777 to 192.168.1.1', () => {
    expect(numberToIp(3232235777)).toBe('192.168.1.1');
  });

  it('round-trips with ipToNumber', () => {
    const ip = '10.128.64.32';
    expect(numberToIp(ipToNumber(ip))).toBe(ip);
  });
});

describe('prefixToMask', () => {
  it('returns 0xFFFFFF00 for prefix 24', () => {
    expect(prefixToMask(24)).toBe(0xffffff00 >>> 0);
  });

  it('returns 0xFFFF0000 for prefix 16', () => {
    expect(prefixToMask(16)).toBe(0xffff0000 >>> 0);
  });

  it('returns 0xFF000000 for prefix 8', () => {
    expect(prefixToMask(8)).toBe(0xff000000 >>> 0);
  });

  it('returns 0xFFFFFFFC for prefix 30', () => {
    expect(prefixToMask(30)).toBe(0xfffffffc >>> 0);
  });

  it('returns 0xFFFFFFFF for prefix 32', () => {
    expect(prefixToMask(32)).toBe(0xffffffff >>> 0);
  });

  it('returns 0 for prefix 0', () => {
    expect(prefixToMask(0)).toBe(0);
  });
});

describe('adjustToNetworkAddress', () => {
  it('zeros host bits for 10.0.1.5/24', () => {
    const ip = ipToNumber('10.0.1.5');
    const result = adjustToNetworkAddress(ip, 24);
    expect(result.networkAddress.bits).toBe(ipToNumber('10.0.1.0'));
    expect(result.prefixLength).toBe(24);
  });

  it('keeps network address unchanged when host bits are already zero', () => {
    const ip = ipToNumber('10.0.0.0');
    const result = adjustToNetworkAddress(ip, 16);
    expect(result.networkAddress.bits).toBe(ipToNumber('10.0.0.0'));
    expect(result.prefixLength).toBe(16);
  });

  it('zeros host bits for 192.168.255.255/16', () => {
    const ip = ipToNumber('192.168.255.255');
    const result = adjustToNetworkAddress(ip, 16);
    expect(result.networkAddress.bits).toBe(ipToNumber('192.168.0.0'));
    expect(result.prefixLength).toBe(16);
  });

  it('zeros host bits for 172.16.5.130/30', () => {
    const ip = ipToNumber('172.16.5.130');
    const result = adjustToNetworkAddress(ip, 30);
    expect(result.networkAddress.bits).toBe(ipToNumber('172.16.5.128'));
    expect(result.prefixLength).toBe(30);
  });

  it('the resulting network address ANDed with mask equals itself', () => {
    const ip = ipToNumber('10.255.128.99');
    const prefix = 17;
    const result = adjustToNetworkAddress(ip, prefix);
    const mask = prefixToMask(prefix);
    expect((result.networkAddress.bits & mask) >>> 0).toBe(result.networkAddress.bits);
  });
});

describe('computeSubnetInfo', () => {
  it('computes 10.0.0.0/16 with 5 reserved → 65531 usable hosts', () => {
    const cidr = { networkAddress: { bits: ipToNumber('10.0.0.0') }, prefixLength: 16 };
    const result = computeSubnetInfo(cidr, 5);
    expect(result.totalAddresses).toBe(65536);
    expect(result.usableHosts).toBe(65531);
    expect(result.reservedCount).toBe(5);
  });

  it('computes 192.168.1.0/24 with 5 reserved → 251 usable hosts', () => {
    const cidr = { networkAddress: { bits: ipToNumber('192.168.1.0') }, prefixLength: 24 };
    const result = computeSubnetInfo(cidr, 5);
    expect(result.totalAddresses).toBe(256);
    expect(result.usableHosts).toBe(251);
    expect(result.reservedCount).toBe(5);
  });

  it('computes 10.0.0.0/30 with 5 reserved → 0 usable hosts (total < reserved)', () => {
    const cidr = { networkAddress: { bits: ipToNumber('10.0.0.0') }, prefixLength: 30 };
    const result = computeSubnetInfo(cidr, 5);
    expect(result.totalAddresses).toBe(4);
    expect(result.usableHosts).toBe(0);
    expect(result.reservedCount).toBe(5);
  });

  it('computes correct broadcast address for 192.168.1.0/24', () => {
    const cidr = { networkAddress: { bits: ipToNumber('192.168.1.0') }, prefixLength: 24 };
    const result = computeSubnetInfo(cidr, 5);
    expect(result.broadcastAddress).toBe('192.168.1.255');
  });

  it('computes correct subnet mask for /16', () => {
    const cidr = { networkAddress: { bits: ipToNumber('10.0.0.0') }, prefixLength: 16 };
    const result = computeSubnetInfo(cidr, 5);
    expect(result.subnetMask).toBe('255.255.0.0');
  });

  it('computes correct network address in dotted-decimal', () => {
    const cidr = { networkAddress: { bits: ipToNumber('172.16.0.0') }, prefixLength: 12 };
    const result = computeSubnetInfo(cidr, 4);
    expect(result.networkAddress).toBe('172.16.0.0');
    expect(result.broadcastAddress).toBe('172.31.255.255');
    expect(result.subnetMask).toBe('255.240.0.0');
    expect(result.totalAddresses).toBe(1048576);
    expect(result.usableHosts).toBe(1048572);
  });

  it('returns the original cidr in the result', () => {
    const cidr = { networkAddress: { bits: ipToNumber('10.0.0.0') }, prefixLength: 24 };
    const result = computeSubnetInfo(cidr, 2);
    expect(result.cidr).toBe(cidr);
  });
});
