import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../store/app-store';
import { canSplit, canJoin } from '../../core/tree-operations';
import type { SubnetNode } from '../../core/types';

/**
 * Unit tests for TreeVisualizer split/join controls logic.
 * Tests the underlying store actions and tree-operations that power the controls.
 *
 * Requirements: 3.1, 3.3, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5
 */
describe('TreeVisualizer split/join controls', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAppStore.setState({
      targetCloud: null,
      providerProfile: null,
      networkPlan: null,
      customTags: [],
      summary: null,
      expandedNodes: new Set(),
      activeView: 'tree',
    });
  });

  function setupTree() {
    const store = useAppStore.getState();
    store.selectCloud('aws');
    store.setRootCIDR('10.0.0.0/16');
    return useAppStore.getState();
  }

  describe('Split controls', () => {
    it('should allow splitting a leaf node with prefix < 30', () => {
      const state = setupTree();
      const root = state.networkPlan!.tree;

      expect(canSplit(root)).toBe(true);
      expect(root.children).toBeNull();

      state.splitSubnet(root.id);
      const updated = useAppStore.getState().networkPlan!.tree;

      expect(updated.children).not.toBeNull();
      expect(updated.children![0].cidr.prefixLength).toBe(17);
      expect(updated.children![1].cidr.prefixLength).toBe(17);
    });

    it('should disable split at /30 prefix', () => {
      const node: SubnetNode = {
        id: 'test-node',
        cidr: { networkAddress: { bits: 0x0a000000 }, prefixLength: 30 },
        children: null,
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };

      expect(canSplit(node)).toBe(false);
    });

    it('should not allow splitting a non-leaf node', () => {
      const state = setupTree();
      const root = state.networkPlan!.tree;

      // Split the root first
      state.splitSubnet(root.id);
      const updated = useAppStore.getState().networkPlan!.tree;

      // Root is now a non-leaf
      expect(canSplit(updated)).toBe(false);
    });

    it('should complete split operation and update state', () => {
      const state = setupTree();
      const root = state.networkPlan!.tree;

      const startTime = performance.now();
      state.splitSubnet(root.id);
      const elapsed = performance.now() - startTime;

      // Verify operation completes within 100ms
      expect(elapsed).toBeLessThan(100);

      const updated = useAppStore.getState();
      expect(updated.networkPlan!.tree.children).not.toBeNull();
      expect(updated.summary).not.toBeNull();
    });
  });

  describe('Join controls', () => {
    it('should allow joining when parent has two leaf children', () => {
      const state = setupTree();
      const root = state.networkPlan!.tree;

      // Split to create two leaf children
      state.splitSubnet(root.id);
      const afterSplit = useAppStore.getState().networkPlan!.tree;

      expect(canJoin(afterSplit)).toBe(true);
    });

    it('should not allow joining when children are not both leaves', () => {
      const state = setupTree();
      const root = state.networkPlan!.tree;

      // Split root, then split one child
      state.splitSubnet(root.id);
      const afterFirstSplit = useAppStore.getState().networkPlan!.tree;
      const leftChild = afterFirstSplit.children![0];

      useAppStore.getState().splitSubnet(leftChild.id);
      const afterSecondSplit = useAppStore.getState().networkPlan!.tree;

      // Root now has a non-leaf child, so canJoin should be false
      expect(canJoin(afterSecondSplit)).toBe(false);
    });

    it('should perform join and restore parent as leaf', () => {
      const state = setupTree();
      const root = state.networkPlan!.tree;

      state.splitSubnet(root.id);
      const afterSplit = useAppStore.getState();

      afterSplit.joinSubnet(afterSplit.networkPlan!.tree.id);
      const afterJoin = useAppStore.getState().networkPlan!.tree;

      expect(afterJoin.children).toBeNull();
      expect(afterJoin.cidr.prefixLength).toBe(16);
    });

    it('should complete join operation within 100ms', () => {
      const state = setupTree();
      const root = state.networkPlan!.tree;

      state.splitSubnet(root.id);
      const afterSplit = useAppStore.getState();

      const startTime = performance.now();
      afterSplit.joinSubnet(afterSplit.networkPlan!.tree.id);
      const elapsed = performance.now() - startTime;

      expect(elapsed).toBeLessThan(100);
    });

    it('should detect assignments on children for confirmation dialog', () => {
      const state = setupTree();
      const root = state.networkPlan!.tree;

      // Split root
      state.splitSubnet(root.id);
      const afterSplit = useAppStore.getState();
      const leftChild = afterSplit.networkPlan!.tree.children![0];

      // Assign a tag to the left child
      const awsTag = afterSplit.providerProfile!.defaultTags[0];
      afterSplit.assignTag(leftChild.id, awsTag);

      const withTag = useAppStore.getState().networkPlan!.tree;
      const left = withTag.children![0];
      const right = withTag.children![1];

      // Children have assignments — the UI should show confirmation
      const hasAssignments =
        left.tags.length > 0 ||
        left.workloadAccount !== null ||
        left.availabilityZone !== null ||
        left.label !== null ||
        right.tags.length > 0 ||
        right.workloadAccount !== null ||
        right.availabilityZone !== null ||
        right.label !== null;

      expect(hasAssignments).toBe(true);
    });

    it('should discard assignments after confirmed join', () => {
      const state = setupTree();
      const root = state.networkPlan!.tree;

      // Split root
      state.splitSubnet(root.id);
      const afterSplit = useAppStore.getState();
      const leftChild = afterSplit.networkPlan!.tree.children![0];

      // Assign metadata to the left child
      const awsTag = afterSplit.providerProfile!.defaultTags[0];
      afterSplit.assignTag(leftChild.id, awsTag);
      useAppStore.getState().setWorkloadAccount(leftChild.id, 'prod-account');
      useAppStore.getState().setAvailabilityZone(leftChild.id, 'us-east-1a');
      useAppStore.getState().setLabel(leftChild.id, 'Transit');

      // Now join — this simulates the user confirming the dialog
      const beforeJoin = useAppStore.getState();
      beforeJoin.joinSubnet(beforeJoin.networkPlan!.tree.id);

      const afterJoin = useAppStore.getState().networkPlan!.tree;
      expect(afterJoin.children).toBeNull();
      expect(afterJoin.tags).toHaveLength(0);
      expect(afterJoin.workloadAccount).toBeNull();
      expect(afterJoin.availabilityZone).toBeNull();
      expect(afterJoin.label).toBeNull();
    });

    it('should not show join button on leaf nodes', () => {
      const state = setupTree();
      const root = state.networkPlan!.tree;

      // Root is a leaf — canJoin should be false
      expect(canJoin(root)).toBe(false);
    });
  });
});
