/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../store/app-store';

describe('URL state synchronization', () => {
  beforeEach(() => {
    // Reset store state
    useAppStore.setState({
      targetCloud: null,
      providerProfile: null,
      networkPlan: null,
      customTags: [],
      summary: null,
      expandedNodes: new Set(),
      activeView: 'tree',
    });
    // Clear URL hash
    window.location.hash = '';
  });

  it('syncToURL writes the network plan to the URL hash', () => {
    const store = useAppStore.getState();
    store.selectCloud('aws');
    store.setRootCIDR('10.0.0.0/16');

    // Sync to URL
    useAppStore.getState().syncToURL();

    // URL hash should now contain plan data
    expect(window.location.hash).not.toBe('');
    expect(window.location.hash).toContain('c=10.0.0.0/16');
    expect(window.location.hash).toContain('t=aws');
  });

  it('loadFromURL restores state from a valid URL hash', () => {
    // First, create a plan and sync to URL
    const store = useAppStore.getState();
    store.selectCloud('azure');
    store.setRootCIDR('192.168.0.0/24');
    useAppStore.getState().syncToURL();

    const savedHash = window.location.hash;

    // Reset state
    useAppStore.setState({
      targetCloud: null,
      providerProfile: null,
      networkPlan: null,
      customTags: [],
      summary: null,
    });

    // Restore the hash and load
    window.location.hash = savedHash.replace('#', '');
    const error = useAppStore.getState().loadFromURL();

    expect(error).toBeNull();
    expect(useAppStore.getState().targetCloud).toBe('azure');
    expect(useAppStore.getState().networkPlan).not.toBeNull();
    expect(useAppStore.getState().networkPlan!.rootCIDR.prefixLength).toBe(24);
  });

  it('loadFromURL returns SerializationError for invalid URL hash', () => {
    window.location.hash = '#c=invalid&t=bad&s=!!!';

    const error = useAppStore.getState().loadFromURL();

    expect(error).not.toBeNull();
    expect(error!.type).toBeDefined();
    expect(error!.message).toBeDefined();
  });

  it('loadFromURL returns null when hash is empty', () => {
    window.location.hash = '';

    const error = useAppStore.getState().loadFromURL();

    expect(error).toBeNull();
  });

  it('syncToURL does nothing when networkPlan is null', () => {
    window.location.hash = '';
    useAppStore.getState().syncToURL();

    expect(window.location.hash).toBe('');
  });

  it('syncToURL updates URL after split operation', () => {
    const store = useAppStore.getState();
    store.selectCloud('gcp');
    store.setRootCIDR('172.16.0.0/12');

    const plan = useAppStore.getState().networkPlan!;
    useAppStore.getState().splitSubnet(plan.tree.id);
    useAppStore.getState().syncToURL();

    // URL should contain the tree structure encoding
    expect(window.location.hash).toContain('s=');
  });

  it('round-trips a plan with tags and assignments through URL', () => {
    const store = useAppStore.getState();
    store.selectCloud('aws');
    store.setRootCIDR('10.0.0.0/16');

    // Split and assign metadata
    const plan = useAppStore.getState().networkPlan!;
    useAppStore.getState().splitSubnet(plan.tree.id);

    const updatedPlan = useAppStore.getState().networkPlan!;
    const leaves = getLeafIds(updatedPlan.tree);

    // Assign tag to first leaf
    const awsTags = useAppStore.getState().providerProfile!.defaultTags;
    useAppStore.getState().assignTag(leaves[0], awsTags[0]);
    useAppStore.getState().setLabel(leaves[0], 'Transit');

    // Sync to URL
    useAppStore.getState().syncToURL();
    const savedHash = window.location.hash;

    // Reset and reload
    useAppStore.setState({
      targetCloud: null,
      providerProfile: null,
      networkPlan: null,
      customTags: [],
      summary: null,
    });

    window.location.hash = savedHash.replace('#', '');
    const error = useAppStore.getState().loadFromURL();

    expect(error).toBeNull();
    const restored = useAppStore.getState().networkPlan!;
    expect(restored.targetCloud).toBe('aws');

    // Verify tree structure was restored
    expect(restored.tree.children).not.toBeNull();
  });
});

/** Helper to collect leaf node IDs from a tree */
function getLeafIds(node: { id: string; children: readonly [any, any] | null }): string[] {
  if (node.children === null) return [node.id];
  return [...getLeafIds(node.children[0]), ...getLeafIds(node.children[1])];
}
