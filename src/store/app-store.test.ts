import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './app-store';

describe('AppStore', () => {
  beforeEach(() => {
    // Reset the store to initial state before each test
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

  describe('selectCloud', () => {
    it('sets the target cloud and loads the provider profile', () => {
      const store = useAppStore.getState();
      store.selectCloud('aws');

      const state = useAppStore.getState();
      expect(state.targetCloud).toBe('aws');
      expect(state.providerProfile).not.toBeNull();
      expect(state.providerProfile!.cloudId).toBe('aws');
      expect(state.providerProfile!.reservedIPs).toBe(5);
    });

    it('loads the correct profile for each cloud', () => {
      const store = useAppStore.getState();

      store.selectCloud('azure');
      expect(useAppStore.getState().providerProfile!.cloudId).toBe('azure');
      expect(useAppStore.getState().providerProfile!.reservedIPs).toBe(5);

      store.selectCloud('gcp');
      expect(useAppStore.getState().providerProfile!.cloudId).toBe('gcp');
      expect(useAppStore.getState().providerProfile!.reservedIPs).toBe(4);

      store.selectCloud('private');
      expect(useAppStore.getState().providerProfile!.cloudId).toBe('private');
      expect(useAppStore.getState().providerProfile!.reservedIPs).toBe(2);
    });

    it('reconciles tags when switching clouds with an existing plan', () => {
      const store = useAppStore.getState();
      store.selectCloud('aws');
      store.setRootCIDR('10.0.0.0/16');

      // Assign an AWS-specific tag
      const state = useAppStore.getState();
      const awsTag = state.providerProfile!.defaultTags[0]; // transit-gateway
      store.assignTag(state.networkPlan!.tree.id, awsTag);

      // Switch to Azure — transit-gateway is not in Azure's tags
      const result = store.selectCloud('azure');
      expect(result.removedTags).toContain('transit-gateway');

      // The tag should be removed from the tree
      const newState = useAppStore.getState();
      expect(newState.networkPlan!.tree.tags).toHaveLength(0);
    });
  });

  describe('operations without cloud selection', () => {
    it('setRootCIDR returns error when no cloud is selected', () => {
      const store = useAppStore.getState();
      const result = store.setRootCIDR('10.0.0.0/16');
      expect(result.valid).toBe(false);
    });

    it('splitSubnet is a no-op when no cloud is selected', () => {
      const store = useAppStore.getState();
      store.splitSubnet('some-id');
      expect(useAppStore.getState().networkPlan).toBeNull();
    });

    it('joinSubnet is a no-op when no cloud is selected', () => {
      const store = useAppStore.getState();
      store.joinSubnet('some-id');
      expect(useAppStore.getState().networkPlan).toBeNull();
    });

    it('assignTag returns error when no cloud is selected', () => {
      const store = useAppStore.getState();
      const result = store.assignTag('some-id', {
        id: 'test',
        name: 'test',
        isCustom: false,
        color: '#000000',
      });
      expect(result).not.toBeNull();
      expect(result!.type).toBe('not_leaf');
    });

    it('removeTag is a no-op when no cloud is selected', () => {
      const store = useAppStore.getState();
      store.removeTag('some-id', 'tag-id');
      expect(useAppStore.getState().networkPlan).toBeNull();
    });

    it('setWorkloadAccount is a no-op when no cloud is selected', () => {
      const store = useAppStore.getState();
      store.setWorkloadAccount('some-id', 'account-1');
      expect(useAppStore.getState().networkPlan).toBeNull();
    });

    it('setAvailabilityZone is a no-op when no cloud is selected', () => {
      const store = useAppStore.getState();
      store.setAvailabilityZone('some-id', 'us-east-1a');
      expect(useAppStore.getState().networkPlan).toBeNull();
    });

    it('setLabel is a no-op when no cloud is selected', () => {
      const store = useAppStore.getState();
      store.setLabel('some-id', 'my-label');
      expect(useAppStore.getState().networkPlan).toBeNull();
    });
  });

  describe('setRootCIDR', () => {
    beforeEach(() => {
      useAppStore.getState().selectCloud('aws');
    });

    it('creates a root node for a valid CIDR', () => {
      const store = useAppStore.getState();
      const result = store.setRootCIDR('10.0.0.0/16');

      expect(result.valid).toBe(true);
      const state = useAppStore.getState();
      expect(state.networkPlan).not.toBeNull();
      expect(state.networkPlan!.tree.cidr.prefixLength).toBe(16);
      expect(state.networkPlan!.tree.children).toBeNull();
    });

    it('auto-adjusts host bits to network address', () => {
      const store = useAppStore.getState();
      store.setRootCIDR('10.0.1.5/16');

      const state = useAppStore.getState();
      // Should be adjusted to 10.0.0.0/16
      expect(state.networkPlan!.tree.cidr.networkAddress.bits).toBe(0x0A000000);
    });

    it('returns validation error for invalid CIDR', () => {
      const store = useAppStore.getState();
      const result = store.setRootCIDR('invalid');
      expect(result.valid).toBe(false);
      expect(useAppStore.getState().networkPlan).toBeNull();
    });

    it('recomputes summary after setting root CIDR', () => {
      const store = useAppStore.getState();
      store.setRootCIDR('10.0.0.0/16');

      const state = useAppStore.getState();
      expect(state.summary).not.toBeNull();
      expect(state.summary!.totalSubnets).toBe(1);
    });
  });

  describe('splitSubnet', () => {
    beforeEach(() => {
      const store = useAppStore.getState();
      store.selectCloud('aws');
      store.setRootCIDR('10.0.0.0/16');
    });

    it('creates two children when splitting a leaf node', () => {
      const state = useAppStore.getState();
      const rootId = state.networkPlan!.tree.id;

      state.splitSubnet(rootId);

      const newState = useAppStore.getState();
      expect(newState.networkPlan!.tree.children).not.toBeNull();
      expect(newState.networkPlan!.tree.children![0].cidr.prefixLength).toBe(17);
      expect(newState.networkPlan!.tree.children![1].cidr.prefixLength).toBe(17);
    });

    it('updates the summary after splitting', () => {
      const state = useAppStore.getState();
      const rootId = state.networkPlan!.tree.id;

      state.splitSubnet(rootId);

      const newState = useAppStore.getState();
      expect(newState.summary!.totalSubnets).toBe(2);
    });

    it('does nothing for a non-existent node', () => {
      const state = useAppStore.getState();
      state.splitSubnet('non-existent-id');

      const newState = useAppStore.getState();
      expect(newState.networkPlan!.tree.children).toBeNull();
    });

    it('does nothing for a node at /30 (max depth)', () => {
      // Set up a /30 root
      useAppStore.setState({
        targetCloud: null,
        providerProfile: null,
        networkPlan: null,
        customTags: [],
        summary: null,
      });
      const store = useAppStore.getState();
      store.selectCloud('aws');
      store.setRootCIDR('10.0.0.0/30');

      const state = useAppStore.getState();
      const rootId = state.networkPlan!.tree.id;
      state.splitSubnet(rootId);

      const newState = useAppStore.getState();
      expect(newState.networkPlan!.tree.children).toBeNull();
    });
  });

  describe('joinSubnet', () => {
    beforeEach(() => {
      const store = useAppStore.getState();
      store.selectCloud('aws');
      store.setRootCIDR('10.0.0.0/16');
    });

    it('joins two leaf children back into the parent', () => {
      const state = useAppStore.getState();
      const rootId = state.networkPlan!.tree.id;

      // Split first
      state.splitSubnet(rootId);
      expect(useAppStore.getState().networkPlan!.tree.children).not.toBeNull();

      // Then join
      useAppStore.getState().joinSubnet(rootId);
      const newState = useAppStore.getState();
      expect(newState.networkPlan!.tree.children).toBeNull();
    });

    it('updates the summary after joining', () => {
      const state = useAppStore.getState();
      const rootId = state.networkPlan!.tree.id;

      state.splitSubnet(rootId);
      expect(useAppStore.getState().summary!.totalSubnets).toBe(2);

      useAppStore.getState().joinSubnet(rootId);
      expect(useAppStore.getState().summary!.totalSubnets).toBe(1);
    });
  });

  describe('tag and metadata operations', () => {
    beforeEach(() => {
      const store = useAppStore.getState();
      store.selectCloud('aws');
      store.setRootCIDR('10.0.0.0/16');
    });

    it('assigns a tag to a leaf node', () => {
      const state = useAppStore.getState();
      const rootId = state.networkPlan!.tree.id;
      const tag = state.providerProfile!.defaultTags[0];

      const result = state.assignTag(rootId, tag);
      expect(result).toBeNull();

      const newState = useAppStore.getState();
      expect(newState.networkPlan!.tree.tags).toHaveLength(1);
      expect(newState.networkPlan!.tree.tags[0].id).toBe(tag.id);
    });

    it('removes a tag from a node', () => {
      const state = useAppStore.getState();
      const rootId = state.networkPlan!.tree.id;
      const tag = state.providerProfile!.defaultTags[0];

      state.assignTag(rootId, tag);
      useAppStore.getState().removeTag(rootId, tag.id);

      const newState = useAppStore.getState();
      expect(newState.networkPlan!.tree.tags).toHaveLength(0);
    });

    it('sets workload account on a node', () => {
      const state = useAppStore.getState();
      const rootId = state.networkPlan!.tree.id;

      state.setWorkloadAccount(rootId, 'prod-account-1');

      const newState = useAppStore.getState();
      expect(newState.networkPlan!.tree.workloadAccount).toBe('prod-account-1');
    });

    it('sets availability zone on a node', () => {
      const state = useAppStore.getState();
      const rootId = state.networkPlan!.tree.id;

      state.setAvailabilityZone(rootId, 'us-east-1a');

      const newState = useAppStore.getState();
      expect(newState.networkPlan!.tree.availabilityZone).toBe('us-east-1a');
    });

    it('sets label on a node', () => {
      const state = useAppStore.getState();
      const rootId = state.networkPlan!.tree.id;

      state.setLabel(rootId, 'Production VPC');

      const newState = useAppStore.getState();
      expect(newState.networkPlan!.tree.label).toBe('Production VPC');
    });
  });

  describe('exportJSON and importJSON', () => {
    it('exportJSON returns null when no plan exists', () => {
      const store = useAppStore.getState();
      expect(store.exportJSON()).toBeNull();
    });

    it('exports and imports a plan round-trip', () => {
      const store = useAppStore.getState();
      store.selectCloud('aws');
      store.setRootCIDR('10.0.0.0/16');

      const json = useAppStore.getState().exportJSON();
      expect(json).not.toBeNull();

      // Reset state
      useAppStore.setState({
        targetCloud: null,
        providerProfile: null,
        networkPlan: null,
        customTags: [],
        summary: null,
      });

      const error = useAppStore.getState().importJSON(json!);
      expect(error).toBeNull();

      const state = useAppStore.getState();
      expect(state.targetCloud).toBe('aws');
      expect(state.networkPlan).not.toBeNull();
      expect(state.networkPlan!.tree.cidr.prefixLength).toBe(16);
    });

    it('importJSON returns error for invalid JSON', () => {
      const store = useAppStore.getState();
      const error = store.importJSON('not valid json');
      expect(error).not.toBeNull();
      expect(error!.type).toBe('invalid_format');
    });
  });

  describe('addCustomTag', () => {
    it('adds a custom tag', () => {
      const store = useAppStore.getState();
      const result = store.addCustomTag('my-tag', '#FF0000');
      expect(result).toBe(true);
      expect(useAppStore.getState().customTags).toHaveLength(1);
      expect(useAppStore.getState().customTags[0].name).toBe('my-tag');
    });

    it('rejects tag names that are too long', () => {
      const store = useAppStore.getState();
      const result = store.addCustomTag('a'.repeat(33), '#FF0000');
      expect(result).toBe(false);
      expect(useAppStore.getState().customTags).toHaveLength(0);
    });

    it('rejects when at max custom tags (20)', () => {
      // Add 20 tags
      for (let i = 0; i < 20; i++) {
        useAppStore.getState().addCustomTag(`tag-${i}`, '#FF0000');
      }
      expect(useAppStore.getState().customTags).toHaveLength(20);

      // 21st should fail
      const result = useAppStore.getState().addCustomTag('tag-21', '#FF0000');
      expect(result).toBe(false);
      expect(useAppStore.getState().customTags).toHaveLength(20);
    });
  });
});
