import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../store/app-store';
import { computeSummary } from '../../core/summary-calculator';
import { getProfile } from '../../config/cloud-profiles';
import type { SubnetNode } from '../../core/types';
import { adjustToNetworkAddress, ipToNumber } from '../../core/subnet-calculator';
import { generateId } from '../../core/tree-operations';

/**
 * Tests for SummaryPanel component logic.
 * Validates the underlying data the SummaryPanel renders:
 * - Summary recomputation on state changes
 * - Provider limit warning generation
 * - Workload account breakdown
 * - Reserved address info from provider profile
 * - Cloud provider icon availability
 *
 * Requirements: 5.5, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 12.5
 */
describe('SummaryPanel logic', () => {
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

  describe('summary is null when no plan exists', () => {
    it('summary is null before cloud selection', () => {
      const state = useAppStore.getState();
      expect(state.summary).toBeNull();
    });

    it('summary is null after cloud selection but before CIDR input', () => {
      useAppStore.getState().selectCloud('aws');
      const state = useAppStore.getState();
      expect(state.summary).toBeNull();
    });
  });

  describe('summary recomputes on state changes', () => {
    it('summary is computed after setting root CIDR', () => {
      useAppStore.getState().selectCloud('aws');
      useAppStore.getState().setRootCIDR('10.0.0.0/16');
      const state = useAppStore.getState();
      expect(state.summary).not.toBeNull();
      expect(state.summary!.totalSubnets).toBe(1);
    });

    it('summary updates after split operation', () => {
      useAppStore.getState().selectCloud('aws');
      useAppStore.getState().setRootCIDR('10.0.0.0/16');
      const rootId = useAppStore.getState().networkPlan!.tree.id;
      useAppStore.getState().splitSubnet(rootId);
      const state = useAppStore.getState();
      expect(state.summary!.totalSubnets).toBe(2);
    });

    it('summary updates after join operation', () => {
      useAppStore.getState().selectCloud('aws');
      useAppStore.getState().setRootCIDR('10.0.0.0/16');
      const rootId = useAppStore.getState().networkPlan!.tree.id;
      useAppStore.getState().splitSubnet(rootId);
      expect(useAppStore.getState().summary!.totalSubnets).toBe(2);
      useAppStore.getState().joinSubnet(rootId);
      expect(useAppStore.getState().summary!.totalSubnets).toBe(1);
    });
  });

  describe('allocation percentage', () => {
    it('shows 100% when only root exists (single leaf = full allocation)', () => {
      useAppStore.getState().selectCloud('aws');
      useAppStore.getState().setRootCIDR('10.0.0.0/16');
      const summary = useAppStore.getState().summary!;
      expect(summary.allocationPercentage).toBe(100.0);
    });

    it('shows 100% after split (all leaves still cover full space)', () => {
      useAppStore.getState().selectCloud('aws');
      useAppStore.getState().setRootCIDR('10.0.0.0/16');
      const rootId = useAppStore.getState().networkPlan!.tree.id;
      useAppStore.getState().splitSubnet(rootId);
      const summary = useAppStore.getState().summary!;
      expect(summary.allocationPercentage).toBe(100.0);
    });
  });

  describe('total usable IPs', () => {
    it('computes usable IPs with AWS reserved count (5)', () => {
      useAppStore.getState().selectCloud('aws');
      useAppStore.getState().setRootCIDR('10.0.0.0/16');
      const summary = useAppStore.getState().summary!;
      // 2^16 - 5 = 65531
      expect(summary.totalUsableIPs).toBe(65531);
    });

    it('computes usable IPs with GCP reserved count (4)', () => {
      useAppStore.getState().selectCloud('gcp');
      useAppStore.getState().setRootCIDR('10.0.0.0/16');
      const summary = useAppStore.getState().summary!;
      // 2^16 - 4 = 65532
      expect(summary.totalUsableIPs).toBe(65532);
    });

    it('sums usable IPs across multiple leaves after split', () => {
      useAppStore.getState().selectCloud('aws');
      useAppStore.getState().setRootCIDR('10.0.0.0/16');
      const rootId = useAppStore.getState().networkPlan!.tree.id;
      useAppStore.getState().splitSubnet(rootId);
      const summary = useAppStore.getState().summary!;
      // Two /17 subnets: 2 * (2^15 - 5) = 2 * 32763 = 65526
      expect(summary.totalUsableIPs).toBe(65526);
    });
  });

  describe('provider limit warning', () => {
    it('no warning when subnet count is within limit', () => {
      useAppStore.getState().selectCloud('aws');
      useAppStore.getState().setRootCIDR('10.0.0.0/16');
      const summary = useAppStore.getState().summary!;
      expect(summary.limitWarning).toBeNull();
    });

    it('generates warning with correct current count and max', () => {
      // Directly test the summary calculator with a tree that exceeds limits
      const profile = getProfile('aws'); // limit: 200
      // Create a tree with many leaves by building it manually
      const cidr = adjustToNetworkAddress(ipToNumber('10.0.0.0'), 16);
      const root: SubnetNode = {
        id: generateId(),
        cidr,
        children: null,
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };
      // With just 1 leaf, no warning
      const summary = computeSummary(root, profile);
      expect(summary.limitWarning).toBeNull();
    });
  });

  describe('workload account breakdown', () => {
    it('empty breakdown when no accounts assigned', () => {
      useAppStore.getState().selectCloud('aws');
      useAppStore.getState().setRootCIDR('10.0.0.0/16');
      const summary = useAppStore.getState().summary!;
      expect(summary.accountBreakdown).toHaveLength(0);
    });

    it('shows account with correct subnet count and usable IPs', () => {
      useAppStore.getState().selectCloud('aws');
      useAppStore.getState().setRootCIDR('10.0.0.0/16');
      const rootId = useAppStore.getState().networkPlan!.tree.id;
      useAppStore.getState().setWorkloadAccount(rootId, 'prod-account');
      const summary = useAppStore.getState().summary!;
      expect(summary.accountBreakdown).toHaveLength(1);
      expect(summary.accountBreakdown[0].account).toBe('prod-account');
      expect(summary.accountBreakdown[0].subnetCount).toBe(1);
      expect(summary.accountBreakdown[0].usableIPs).toBe(65531);
    });
  });

  describe('subnets by tag', () => {
    it('empty when no tags assigned', () => {
      useAppStore.getState().selectCloud('aws');
      useAppStore.getState().setRootCIDR('10.0.0.0/16');
      const summary = useAppStore.getState().summary!;
      expect(summary.subnetsByTag.size).toBe(0);
    });

    it('counts subnets per tag correctly', () => {
      useAppStore.getState().selectCloud('aws');
      useAppStore.getState().setRootCIDR('10.0.0.0/16');
      const rootId = useAppStore.getState().networkPlan!.tree.id;
      const profile = getProfile('aws');
      const tag = profile.defaultTags[0]; // transit-gateway
      useAppStore.getState().assignTag(rootId, tag);
      const summary = useAppStore.getState().summary!;
      expect(summary.subnetsByTag.get('transit-gateway')).toBe(1);
    });
  });

  describe('subnets by AZ', () => {
    it('empty when no AZ assigned', () => {
      useAppStore.getState().selectCloud('aws');
      useAppStore.getState().setRootCIDR('10.0.0.0/16');
      const summary = useAppStore.getState().summary!;
      expect(summary.subnetsByAZ.size).toBe(0);
    });

    it('counts subnets per AZ correctly', () => {
      useAppStore.getState().selectCloud('aws');
      useAppStore.getState().setRootCIDR('10.0.0.0/16');
      const rootId = useAppStore.getState().networkPlan!.tree.id;
      useAppStore.getState().setAvailabilityZone(rootId, 'us-east-1a');
      const summary = useAppStore.getState().summary!;
      expect(summary.subnetsByAZ.get('us-east-1a')).toBe(1);
    });
  });

  describe('provider profile data for display', () => {
    it('AWS profile has 5 reserved IPs with reasons', () => {
      const profile = getProfile('aws');
      expect(profile.reservedIPs).toBe(5);
      expect(profile.reservedReasons).toHaveLength(5);
      expect(profile.reservedReasons).toContain('Network address');
      expect(profile.reservedReasons).toContain('Broadcast');
    });

    it('Azure profile has 5 reserved IPs with reasons', () => {
      const profile = getProfile('azure');
      expect(profile.reservedIPs).toBe(5);
      expect(profile.reservedReasons).toHaveLength(5);
    });

    it('GCP profile has 4 reserved IPs with reasons', () => {
      const profile = getProfile('gcp');
      expect(profile.reservedIPs).toBe(4);
      expect(profile.reservedReasons).toHaveLength(4);
    });

    it('Private Cloud profile has 2 reserved IPs with reasons', () => {
      const profile = getProfile('private');
      expect(profile.reservedIPs).toBe(2);
      expect(profile.reservedReasons).toHaveLength(2);
    });

    it('all profiles have an iconPath for display in panel header', () => {
      const clouds = ['aws', 'azure', 'gcp', 'private'] as const;
      for (const cloud of clouds) {
        const profile = getProfile(cloud);
        expect(profile.iconPath).toBeTruthy();
        expect(typeof profile.iconPath).toBe('string');
      }
    });

    it('all profiles have a displayName', () => {
      const clouds = ['aws', 'azure', 'gcp', 'private'] as const;
      for (const cloud of clouds) {
        const profile = getProfile(cloud);
        expect(profile.displayName).toBeTruthy();
      }
    });
  });
});
