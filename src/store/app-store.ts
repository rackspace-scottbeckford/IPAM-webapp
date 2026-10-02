import { create } from 'zustand';
import type {
  TargetCloud,
  CloudProviderProfile,
  NetworkPlan,
  UseCaseTag,
  VPCSummary,
  BrandingConfiguration,
  SubnetNode,
  CIDRBlock,
  ValidationResult,
  SerializationError,
  TagError,
} from '../core/types';
import { adjustToNetworkAddress } from '../core/subnet-calculator';
import {
  split,
  join,
  canSplit,
  canJoin,
  assignTag as treeAssignTag,
  removeTag as treeRemoveTag,
  setWorkloadAccount as treeSetWorkloadAccount,
  setAvailabilityZone as treeSetAvailabilityZone,
  setLabel as treeSetLabel,
  findNode,
  generateId,
} from '../core/tree-operations';
import { validateCIDR } from '../core/input-validator';
import { validateMapExisting } from '../core/map-existing-calculator';
import type { MapExistingError } from '../core/map-existing-calculator';

/**
 * Successful result of the mapExistingCIDR store action.
 */
export interface MapExistingSuccess {
  readonly ok: true;
  /** The mapped CIDR block (adjusted to its network address). */
  readonly cidr: CIDRBlock;
  /** The workload name assigned to the mapped subnet. */
  readonly name: string;
}
import { computeSummary } from '../core/summary-calculator';
import { getProfile } from '../config/cloud-profiles';
import { reconcileTags } from '../config/cloud-change';
import { toJSON, fromJSON, toURL, fromURL } from '../serialization/plan-serializer';

/** Default Rackspace branding configuration */
const DEFAULT_BRANDING: BrandingConfiguration = {
  logoUrl: null,
  primaryColor: '#EB0000',
  secondaryColor: '#1A1A1A',
  title: 'Cloud IP Address Management Tool',
  faviconUrl: null,
};

export interface AppState {
  // Core state
  targetCloud: TargetCloud | null;
  providerProfile: CloudProviderProfile | null;
  networkPlan: NetworkPlan | null;
  customTags: UseCaseTag[];
  privateCloudIcon: string | null;

  // Derived
  summary: VPCSummary | null;

  // UI state
  expandedNodes: Set<string>;
  activeView: 'tree' | 'grouped';

  // Branding
  branding: BrandingConfiguration;

  // Actions
  selectCloud: (cloud: TargetCloud) => { removedTags?: string[] };
  setRootCIDR: (input: string) => ValidationResult;
  splitSubnet: (nodeId: string) => void;
  joinSubnet: (parentId: string) => void;
  assignTag: (nodeId: string, tag: UseCaseTag) => TagError | null;
  removeTag: (nodeId: string, tagId: string) => void;
  setWorkloadAccount: (nodeId: string, account: string | null) => void;
  setAvailabilityZone: (nodeId: string, az: string | null) => void;
  setLabel: (nodeId: string, label: string | null) => void;
  mapExistingCIDR: (input: string, name: string) => MapExistingSuccess | MapExistingError;
  exportJSON: () => string | null;
  importJSON: (json: string) => SerializationError | null;
  syncToURL: () => void;
  loadFromURL: () => SerializationError | null;
  addCustomTag: (name: string, color: string) => boolean;
  setPrivateCloudIcon: (dataUri: string | null) => void;
}

/**
 * Helper to recompute the VPC summary from the current network plan and profile.
 */
function recomputeSummary(
  networkPlan: NetworkPlan | null,
  providerProfile: CloudProviderProfile | null
): VPCSummary | null {
  if (!networkPlan || !providerProfile) return null;
  return computeSummary(networkPlan.tree, providerProfile);
}

/**
 * Helper to update the network plan tree immutably and recompute summary.
 */
function updateTree(
  state: Pick<AppState, 'networkPlan' | 'providerProfile' | 'targetCloud' | 'customTags'>,
  newTree: SubnetNode
): { networkPlan: NetworkPlan; summary: VPCSummary | null } {
  const networkPlan: NetworkPlan = {
    ...state.networkPlan!,
    tree: newTree,
  };
  const summary = recomputeSummary(networkPlan, state.providerProfile);
  return { networkPlan, summary };
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  targetCloud: null,
  providerProfile: null,
  networkPlan: null,
  customTags: [],
  privateCloudIcon: null,
  summary: null,
  expandedNodes: new Set<string>(),
  activeView: 'tree',
  branding: DEFAULT_BRANDING,

  selectCloud: (cloud: TargetCloud) => {
    const state = get();
    const newProfile = getProfile(cloud);
    let removedTags: string[] | undefined;

    if (state.networkPlan && state.providerProfile) {
      // Reconcile tags when switching clouds with an existing plan
      const result = reconcileTags(
        state.networkPlan.tree,
        state.providerProfile,
        newProfile,
        state.customTags
      );
      removedTags = result.removedTags.length > 0 ? result.removedTags : undefined;

      const updatedPlan: NetworkPlan = {
        ...state.networkPlan,
        targetCloud: cloud,
        tree: result.tree,
      };
      const summary = recomputeSummary(updatedPlan, newProfile);

      set({
        targetCloud: cloud,
        providerProfile: newProfile,
        networkPlan: updatedPlan,
        summary,
      });
    } else {
      set({
        targetCloud: cloud,
        providerProfile: newProfile,
      });
    }

    return { removedTags };
  },

  setRootCIDR: (input: string) => {
    const state = get();

    // Require cloud selection first
    if (!state.targetCloud || !state.providerProfile) {
      return {
        valid: false,
        error: {
          type: 'malformed_format' as const,
          message: 'Please select a target cloud before entering a CIDR block',
        },
      };
    }

    const validationResult = validateCIDR(input);
    if (!validationResult.valid) {
      return validationResult;
    }

    // Auto-adjust host bits to get the correct network address
    const adjustedCIDR = adjustToNetworkAddress(
      validationResult.cidr.networkAddress.bits,
      validationResult.cidr.prefixLength
    );

    // Create the root node
    const rootNode: SubnetNode = {
      id: generateId(),
      cidr: adjustedCIDR,
      children: null,
      tags: [],
      workloadAccount: null,
      availabilityZone: null,
      label: null,
    };

    const networkPlan: NetworkPlan = {
      version: 1,
      targetCloud: state.targetCloud,
      rootCIDR: adjustedCIDR,
      tree: rootNode,
      customTags: state.customTags,
    };

    const summary = recomputeSummary(networkPlan, state.providerProfile);

    set({ networkPlan, summary });

    return validationResult;
  },

  splitSubnet: (nodeId: string) => {
    const state = get();
    if (!state.targetCloud || !state.networkPlan) return;

    const node = findNode(state.networkPlan.tree, nodeId);
    if (!node || !canSplit(node)) return;

    const result = split(node);
    if ('type' in result) return; // SplitError

    const [firstChild, secondChild] = result;

    // Immutably update the tree: replace the node with a version that has children
    const newTree = replaceNode(state.networkPlan.tree, nodeId, (n) => ({
      ...n,
      children: [firstChild, secondChild] as readonly [SubnetNode, SubnetNode],
      tags: [],
      workloadAccount: null,
      availabilityZone: null,
      // Preserve the label on the parent after split
    }));

    const { networkPlan, summary } = updateTree(state, newTree);
    set({ networkPlan, summary });
  },

  joinSubnet: (parentId: string) => {
    const state = get();
    if (!state.targetCloud || !state.networkPlan) return;

    const node = findNode(state.networkPlan.tree, parentId);
    if (!node || !canJoin(node)) return;

    const result = join(node);
    if ('type' in result) return; // JoinError

    // Replace the parent node with the joined (leaf) version
    const newTree = replaceNode(state.networkPlan.tree, parentId, () => result);

    const { networkPlan, summary } = updateTree(state, newTree);
    set({ networkPlan, summary });
  },

  assignTag: (nodeId: string, tag: UseCaseTag) => {
    const state = get();
    if (!state.targetCloud || !state.networkPlan) return { type: 'not_leaf' as const, message: 'No cloud selected' };

    const result = treeAssignTag(state.networkPlan.tree, nodeId, tag);
    if ('type' in result) return result; // TagError

    const { networkPlan, summary } = updateTree(state, result);
    set({ networkPlan, summary });
    return null;
  },

  removeTag: (nodeId: string, tagId: string) => {
    const state = get();
    if (!state.targetCloud || !state.networkPlan) return;

    const newTree = treeRemoveTag(state.networkPlan.tree, nodeId, tagId);
    const { networkPlan, summary } = updateTree(state, newTree);
    set({ networkPlan, summary });
  },

  setWorkloadAccount: (nodeId: string, account: string | null) => {
    const state = get();
    if (!state.targetCloud || !state.networkPlan) return;

    const newTree = treeSetWorkloadAccount(state.networkPlan.tree, nodeId, account);
    const { networkPlan, summary } = updateTree(state, newTree);
    set({ networkPlan, summary });
  },

  setAvailabilityZone: (nodeId: string, az: string | null) => {
    const state = get();
    if (!state.targetCloud || !state.networkPlan) return;

    const newTree = treeSetAvailabilityZone(state.networkPlan.tree, nodeId, az);
    const { networkPlan, summary } = updateTree(state, newTree);
    set({ networkPlan, summary });
  },

  setLabel: (nodeId: string, label: string | null) => {
    const state = get();
    if (!state.targetCloud || !state.networkPlan) return;

    const newTree = treeSetLabel(state.networkPlan.tree, nodeId, label);
    const { networkPlan, summary } = updateTree(state, newTree);
    set({ networkPlan, summary });
  },

  mapExistingCIDR: (input: string, name: string) => {
    const state = get();

    if (!state.targetCloud || !state.networkPlan) {
      return {
        type: 'not_contained' as const,
        message: 'Select a cloud and define a root CIDR block before mapping existing subnets.',
      };
    }

    // Validate and parse the CIDR syntax.
    const parsed = validateCIDR(input);
    if (!parsed.valid) {
      return { type: 'not_contained' as const, message: parsed.error.message };
    }

    // Adjust host bits to the network address so the mapping is canonical.
    const target = adjustToNetworkAddress(
      parsed.cidr.networkAddress.bits,
      parsed.cidr.prefixLength
    );

    // Validate containment / overlap and compute the navigation path.
    const result = validateMapExisting(
      state.networkPlan.tree,
      state.networkPlan.rootCIDR,
      target
    );
    if ('type' in result) {
      return result;
    }

    // Walk the path from the root to the target CIDR, splitting as needed and
    // following the correct (left/right) child at each level. We re-read the
    // store after each split so we operate on the freshest tree.
    let currentNodeId = state.networkPlan.tree.id;
    for (const choice of result.path) {
      const currentPlan = get().networkPlan;
      if (!currentPlan) break;
      let node = findNode(currentPlan.tree, currentNodeId);
      if (!node) break;

      // Split the node if it is still a leaf; existing children are reused.
      if (node.children === null) {
        get().splitSubnet(currentNodeId);
        const updatedPlan = get().networkPlan;
        if (!updatedPlan) break;
        node = findNode(updatedPlan.tree, currentNodeId);
        if (!node || node.children === null) break;
      }

      currentNodeId = node.children[choice].id;
    }

    // Assign the workload name as both label and workload account on the target.
    get().setLabel(currentNodeId, name);
    get().setWorkloadAccount(currentNodeId, name);

    return { ok: true as const, cidr: target, name };
  },

  exportJSON: () => {
    const state = get();
    if (!state.networkPlan) return null;
    return toJSON(state.networkPlan);
  },

  importJSON: (json: string) => {
    const result = fromJSON(json);

    if ('type' in result && 'message' in result && !('version' in result)) {
      return result as SerializationError;
    }

    const plan = result as NetworkPlan;
    const profile = getProfile(plan.targetCloud);
    const summary = recomputeSummary(plan, profile);

    set({
      targetCloud: plan.targetCloud,
      providerProfile: profile,
      networkPlan: plan,
      customTags: [...plan.customTags],
      summary,
    });

    return null;
  },

  syncToURL: () => {
    const state = get();
    if (!state.networkPlan) return;

    const urlHash = toURL(state.networkPlan);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', urlHash);
    }
  },

  loadFromURL: () => {
    if (typeof window === 'undefined') return null;

    const hash = window.location.hash;
    if (!hash || hash === '#') return null;

    const result = fromURL(hash);

    if ('type' in result && 'message' in result && !('version' in result)) {
      return result as SerializationError;
    }

    const plan = result as NetworkPlan;
    const profile = getProfile(plan.targetCloud);
    const summary = recomputeSummary(plan, profile);

    set({
      targetCloud: plan.targetCloud,
      providerProfile: profile,
      networkPlan: plan,
      customTags: [...plan.customTags],
      summary,
    });

    return null;
  },

  addCustomTag: (name: string, color: string) => {
    const state = get();
    if (state.customTags.length >= 20) return false;
    if (name.length < 1 || name.length > 32) return false;

    const newTag: UseCaseTag = {
      id: `custom-${Date.now()}-${name.toLowerCase().replace(/\s+/g, '-')}`,
      name,
      isCustom: true,
      color,
    };

    set({ customTags: [...state.customTags, newTag] });
    return true;
  },

  setPrivateCloudIcon: (dataUri: string | null) => {
    const state = get();
    set({ privateCloudIcon: dataUri });

    // Also update the network plan if it exists
    if (state.networkPlan && state.targetCloud === 'private') {
      const updatedPlan: NetworkPlan = {
        ...state.networkPlan,
        privateCloudIcon: dataUri ?? undefined,
      };
      set({ networkPlan: updatedPlan });
    }
  },
}));

/**
 * Immutably replace a node in the tree by ID.
 */
function replaceNode(
  tree: SubnetNode,
  nodeId: string,
  updater: (node: SubnetNode) => SubnetNode
): SubnetNode {
  if (tree.id === nodeId) {
    return updater(tree);
  }
  if (tree.children === null) {
    return tree;
  }
  const [left, right] = tree.children;
  return {
    ...tree,
    children: [replaceNode(left, nodeId, updater), replaceNode(right, nodeId, updater)],
  };
}
