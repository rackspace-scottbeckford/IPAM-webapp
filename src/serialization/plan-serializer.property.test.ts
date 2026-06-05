import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { toJSON, fromJSON, toURL, fromURL } from './plan-serializer';
import { prefixToMask } from '../core/subnet-calculator';
import { getLeaves } from '../core/tree-operations';
import { getProfile } from '../config/cloud-profiles';
import type { NetworkPlan, SubnetNode, UseCaseTag, TargetCloud, SerializationError } from '../core/types';

// === Generators ===

/**
 * Generator for a valid TargetCloud value.
 */
const targetCloudArb: fc.Arbitrary<TargetCloud> = fc.constantFrom('aws', 'azure', 'gcp', 'private');

/**
 * Generator for a valid hex color string.
 */
const hexColorArb: fc.Arbitrary<string> = fc.integer({ min: 0, max: 0xFFFFFF }).map(
  n => `#${n.toString(16).padStart(6, '0').toUpperCase()}`
);

/**
 * Generator for a valid UseCaseTag.
 */
function useCaseTagArb(index: number): fc.Arbitrary<UseCaseTag> {
  return fc.tuple(
    fc.stringOf(fc.char(), { minLength: 1, maxLength: 32 }).filter(s => s.length >= 1 && s.length <= 32),
    hexColorArb
  ).map(([name, color]) => ({
    id: `tag-${index}-${name.slice(0, 8)}`,
    name,
    isCustom: true,
    color,
  }));
}

/**
 * Generator for an array of 0-5 unique tags for leaf annotation.
 */
const leafTagsArb: fc.Arbitrary<UseCaseTag[]> = fc.integer({ min: 0, max: 5 }).chain(count =>
  fc.tuple(...Array.from({ length: count }, (_, i) => useCaseTagArb(i))).map(tags => tags as UseCaseTag[])
);

/**
 * Generator for optional workload account (1-64 chars or null).
 */
const workloadAccountArb: fc.Arbitrary<string | null> = fc.oneof(
  fc.constant(null),
  fc.stringOf(fc.char(), { minLength: 1, maxLength: 64 }).filter(s => s.length >= 1 && s.length <= 64)
);

/**
 * Generator for optional availability zone (1-64 chars or null).
 */
const availabilityZoneArb: fc.Arbitrary<string | null> = fc.oneof(
  fc.constant(null),
  fc.stringOf(fc.char(), { minLength: 1, maxLength: 64 }).filter(s => s.length >= 1 && s.length <= 64)
);

/**
 * Generator for optional label (1-64 chars or null).
 */
const labelArb: fc.Arbitrary<string | null> = fc.oneof(
  fc.constant(null),
  fc.stringOf(fc.char(), { minLength: 1, maxLength: 64 }).filter(s => s.length >= 1 && s.length <= 64)
);

/**
 * Generator for custom tags (0-5 custom tags for the plan).
 */
const customTagsArb: fc.Arbitrary<UseCaseTag[]> = fc.integer({ min: 0, max: 5 }).chain(count =>
  fc.tuple(...Array.from({ length: count }, (_, i) => useCaseTagArb(100 + i))).map(tags => tags as UseCaseTag[])
);

/**
 * Build a random subnet tree by starting with a root leaf and applying random splits.
 * Returns a tree with leaves annotated with random tags, AZs, workload accounts, and labels.
 */
function subnetTreeArb(rootPrefix: number): fc.Arbitrary<SubnetNode> {
  const maxSplits = Math.min(30 - rootPrefix, 5);
  return fc.integer({ min: 0, max: maxSplits }).chain(numSplits => {
    return fc.tuple(
      fc.array(fc.integer({ min: 0, max: 100 }), { minLength: numSplits, maxLength: numSplits }),
      fc.array(leafTagsArb, { minLength: numSplits + 10, maxLength: numSplits + 10 }),
      fc.array(workloadAccountArb, { minLength: numSplits + 10, maxLength: numSplits + 10 }),
      fc.array(availabilityZoneArb, { minLength: numSplits + 10, maxLength: numSplits + 10 }),
      fc.array(labelArb, { minLength: numSplits + 10, maxLength: numSplits + 10 })
    ).map(([splitSeeds, tagSets, accountSets, azSets, labelSets]) => {
      const mask = prefixToMask(rootPrefix);
      const rootNetwork = (0x0A000000 & mask) >>> 0; // 10.0.0.0 aligned

      let tree: SubnetNode = {
        id: 'root',
        cidr: { networkAddress: { bits: rootNetwork }, prefixLength: rootPrefix },
        children: null,
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };

      // Apply splits to random leaves
      let nodeCounter = 0;
      for (let i = 0; i < numSplits; i++) {
        const leaves = getLeaves(tree);
        const splittableLeaves = leaves.filter(l => l.cidr.prefixLength < 30);
        if (splittableLeaves.length === 0) break;

        const targetIndex = splitSeeds[i] % splittableLeaves.length;
        const targetLeaf = splittableLeaves[targetIndex];
        tree = splitNodeInTree(tree, targetLeaf.id, ++nodeCounter);
      }

      // Annotate leaves with tags, accounts, AZs, and labels
      const leaves = getLeaves(tree);
      tree = annotateLeaves(tree, leaves, tagSets, accountSets, azSets, labelSets);

      return tree;
    });
  });
}

/**
 * Immutably split a node in the tree by ID, producing two children.
 */
function splitNodeInTree(tree: SubnetNode, nodeId: string, counter: number): SubnetNode {
  if (tree.id === nodeId && tree.children === null && tree.cidr.prefixLength < 30) {
    const newPrefix = tree.cidr.prefixLength + 1;
    const parentNetwork = tree.cidr.networkAddress.bits;
    const secondOffset = Math.pow(2, 32 - newPrefix);
    const secondNetwork = (parentNetwork + secondOffset) >>> 0;

    const firstChild: SubnetNode = {
      id: `node-${counter}-a`,
      cidr: { networkAddress: { bits: parentNetwork }, prefixLength: newPrefix },
      children: null,
      tags: [],
      workloadAccount: null,
      availabilityZone: null,
      label: null,
    };

    const secondChild: SubnetNode = {
      id: `node-${counter}-b`,
      cidr: { networkAddress: { bits: secondNetwork }, prefixLength: newPrefix },
      children: null,
      tags: [],
      workloadAccount: null,
      availabilityZone: null,
      label: null,
    };

    return {
      ...tree,
      children: [firstChild, secondChild],
      tags: [],
      workloadAccount: null,
      availabilityZone: null,
      label: null,
    };
  }

  if (tree.children === null) return tree;

  const [left, right] = tree.children;
  return {
    ...tree,
    children: [splitNodeInTree(left, nodeId, counter), splitNodeInTree(right, nodeId, counter)],
  };
}

/**
 * Annotate leaves with tags, accounts, AZs, and labels from generated arrays.
 */
function annotateLeaves(
  tree: SubnetNode,
  leaves: SubnetNode[],
  tagSets: UseCaseTag[][],
  accountSets: (string | null)[],
  azSets: (string | null)[],
  labelSets: (string | null)[]
): SubnetNode {
  const annotations = new Map<string, {
    tags: UseCaseTag[];
    account: string | null;
    az: string | null;
    label: string | null;
  }>();
  for (let i = 0; i < leaves.length; i++) {
    annotations.set(leaves[i].id, {
      tags: tagSets[i % tagSets.length] || [],
      account: accountSets[i % accountSets.length] || null,
      az: azSets[i % azSets.length] || null,
      label: labelSets[i % labelSets.length] || null,
    });
  }
  return applyAnnotations(tree, annotations);
}

function applyAnnotations(
  tree: SubnetNode,
  annotations: Map<string, {
    tags: UseCaseTag[];
    account: string | null;
    az: string | null;
    label: string | null;
  }>
): SubnetNode {
  if (tree.children === null) {
    const ann = annotations.get(tree.id);
    if (ann) {
      return {
        ...tree,
        tags: ann.tags,
        workloadAccount: ann.account,
        availabilityZone: ann.az,
        label: ann.label,
      };
    }
    return tree;
  }

  const [left, right] = tree.children;
  return {
    ...tree,
    children: [applyAnnotations(left, annotations), applyAnnotations(right, annotations)],
  };
}

/**
 * Generator for a complete valid NetworkPlan.
 */
const networkPlanArb: fc.Arbitrary<NetworkPlan> = fc.integer({ min: 8, max: 24 }).chain(rootPrefix => {
  return fc.tuple(
    targetCloudArb,
    subnetTreeArb(rootPrefix),
    customTagsArb
  ).map(([targetCloud, tree, customTags]) => {
    const mask = prefixToMask(rootPrefix);
    const rootNetwork = (0x0A000000 & mask) >>> 0;
    const rootCIDR = { networkAddress: { bits: rootNetwork }, prefixLength: rootPrefix };

    const plan: NetworkPlan = {
      version: 1,
      targetCloud,
      rootCIDR,
      tree,
      customTags,
      ...(targetCloud === 'private' ? { privateCloudReservedCount: 5 } : {}),
    };
    return plan;
  });
});

// === Helpers ===

function isSerializationError(result: unknown): result is SerializationError {
  return typeof result === 'object' && result !== null && 'type' in result && 'message' in result;
}

/**
 * Deep equality check for SubnetNode trees (ignoring object identity).
 */
function treesEqual(a: SubnetNode, b: SubnetNode): boolean {
  if (a.id !== b.id) return false;
  if (a.cidr.networkAddress.bits !== b.cidr.networkAddress.bits) return false;
  if (a.cidr.prefixLength !== b.cidr.prefixLength) return false;
  if (a.workloadAccount !== b.workloadAccount) return false;
  if (a.availabilityZone !== b.availabilityZone) return false;
  if (a.label !== b.label) return false;

  // Compare tags
  if (a.tags.length !== b.tags.length) return false;
  for (let i = 0; i < a.tags.length; i++) {
    if (a.tags[i].id !== b.tags[i].id) return false;
    if (a.tags[i].name !== b.tags[i].name) return false;
    if (a.tags[i].isCustom !== b.tags[i].isCustom) return false;
    if (a.tags[i].color !== b.tags[i].color) return false;
  }

  // Compare children
  if (a.children === null && b.children === null) return true;
  if (a.children === null || b.children === null) return false;
  return treesEqual(a.children[0], b.children[0]) && treesEqual(a.children[1], b.children[1]);
}

/**
 * Deep equality check for NetworkPlan objects.
 */
function plansEqual(a: NetworkPlan, b: NetworkPlan): boolean {
  if (a.version !== b.version) return false;
  if (a.targetCloud !== b.targetCloud) return false;
  if (a.rootCIDR.networkAddress.bits !== b.rootCIDR.networkAddress.bits) return false;
  if (a.rootCIDR.prefixLength !== b.rootCIDR.prefixLength) return false;
  if (a.privateCloudReservedCount !== b.privateCloudReservedCount) return false;
  if (a.privateCloudIcon !== b.privateCloudIcon) return false;

  // Compare custom tags
  if (a.customTags.length !== b.customTags.length) return false;
  for (let i = 0; i < a.customTags.length; i++) {
    if (a.customTags[i].id !== b.customTags[i].id) return false;
    if (a.customTags[i].name !== b.customTags[i].name) return false;
    if (a.customTags[i].isCustom !== b.customTags[i].isCustom) return false;
    if (a.customTags[i].color !== b.customTags[i].color) return false;
  }

  return treesEqual(a.tree, b.tree);
}

// === Property Tests ===

/**
 * Feature: cloud-ipam-webapp, Property 18: JSON serialization round trip
 * Validates: Requirements 8.4, 8.9
 *
 * For any valid NetworkPlan (including root CIDR, target cloud, all splits, tags,
 * workload accounts, availability zones, labels, and custom tags), exporting to JSON
 * and then importing SHALL produce a NetworkPlan equivalent to the original.
 */
describe('Property 18: JSON serialization round trip', () => {
  it('toJSON then fromJSON produces an equivalent NetworkPlan', () => {
    fc.assert(
      fc.property(networkPlanArb, (plan) => {
        const json = toJSON(plan);
        const result = fromJSON(json);

        // Must not be an error
        expect(isSerializationError(result)).toBe(false);

        const restored = result as NetworkPlan;

        // Verify structural equivalence
        expect(plansEqual(plan, restored)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('round trip preserves targetCloud for all cloud types', () => {
    fc.assert(
      fc.property(networkPlanArb, (plan) => {
        const json = toJSON(plan);
        const result = fromJSON(json);

        expect(isSerializationError(result)).toBe(false);
        const restored = result as NetworkPlan;
        expect(restored.targetCloud).toBe(plan.targetCloud);
      }),
      { numRuns: 100 }
    );
  });

  it('round trip preserves all leaf annotations (tags, accounts, AZs, labels)', () => {
    fc.assert(
      fc.property(networkPlanArb, (plan) => {
        const json = toJSON(plan);
        const result = fromJSON(json);

        expect(isSerializationError(result)).toBe(false);
        const restored = result as NetworkPlan;

        const originalLeaves = getLeaves(plan.tree);
        const restoredLeaves = getLeaves(restored.tree);

        expect(restoredLeaves.length).toBe(originalLeaves.length);

        for (let i = 0; i < originalLeaves.length; i++) {
          expect(restoredLeaves[i].workloadAccount).toBe(originalLeaves[i].workloadAccount);
          expect(restoredLeaves[i].availabilityZone).toBe(originalLeaves[i].availabilityZone);
          expect(restoredLeaves[i].label).toBe(originalLeaves[i].label);
          expect(restoredLeaves[i].tags.length).toBe(originalLeaves[i].tags.length);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('round trip preserves custom tags', () => {
    fc.assert(
      fc.property(networkPlanArb, (plan) => {
        const json = toJSON(plan);
        const result = fromJSON(json);

        expect(isSerializationError(result)).toBe(false);
        const restored = result as NetworkPlan;

        expect(restored.customTags.length).toBe(plan.customTags.length);
        for (let i = 0; i < plan.customTags.length; i++) {
          expect(restored.customTags[i].id).toBe(plan.customTags[i].id);
          expect(restored.customTags[i].name).toBe(plan.customTags[i].name);
          expect(restored.customTags[i].color).toBe(plan.customTags[i].color);
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: cloud-ipam-webapp, Property 19: Invalid serialized input produces error (JSON)
 * Validates: Requirements 8.6
 *
 * For any string that is not a valid encoded NetworkPlan (malformed JSON),
 * deserialization SHALL return a SerializationError and SHALL not produce a valid NetworkPlan.
 */
describe('Property 19: Invalid serialized input produces error (JSON)', () => {
  it('random strings that are not valid JSON produce SerializationError', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => {
          try { JSON.parse(s); return false; } catch { return true; }
        }),
        (invalidInput) => {
          const result = fromJSON(invalidInput);
          expect(isSerializationError(result)).toBe(true);
          expect((result as SerializationError).type).toBe('invalid_format');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('valid JSON that is not an object produces SerializationError', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer().map(n => JSON.stringify(n)),
          fc.boolean().map(b => JSON.stringify(b)),
          fc.string().map(s => JSON.stringify(s)),
          fc.array(fc.integer()).map(a => JSON.stringify(a)),
          fc.constant('null')
        ),
        (jsonPrimitive) => {
          const result = fromJSON(jsonPrimitive);
          expect(isSerializationError(result)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('JSON objects missing required fields produce SerializationError', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Missing version
          fc.constant(JSON.stringify({ targetCloud: 'aws', rootCIDR: '10.0.0.0/16', tree: { id: 'r', cidr: '10.0.0.0/16', children: null, tags: [] } })),
          // Missing targetCloud
          fc.constant(JSON.stringify({ version: 1, rootCIDR: '10.0.0.0/16', tree: { id: 'r', cidr: '10.0.0.0/16', children: null, tags: [] } })),
          // Missing rootCIDR
          fc.constant(JSON.stringify({ version: 1, targetCloud: 'aws', tree: { id: 'r', cidr: '10.0.0.0/16', children: null, tags: [] } })),
          // Missing tree
          fc.constant(JSON.stringify({ version: 1, targetCloud: 'aws', rootCIDR: '10.0.0.0/16' })),
          // Wrong version
          fc.integer({ min: 2, max: 100 }).map(v => JSON.stringify({ version: v, targetCloud: 'aws', rootCIDR: '10.0.0.0/16', tree: { id: 'r', cidr: '10.0.0.0/16', children: null, tags: [] } })),
          // Invalid targetCloud
          fc.stringOf(fc.char(), { minLength: 1, maxLength: 10 })
            .filter(s => !['aws', 'azure', 'gcp', 'private'].includes(s))
            .map(cloud => JSON.stringify({ version: 1, targetCloud: cloud, rootCIDR: '10.0.0.0/16', tree: { id: 'r', cidr: '10.0.0.0/16', children: null, tags: [] } }))
        ),
        (invalidJson) => {
          const result = fromJSON(invalidJson);
          expect(isSerializationError(result)).toBe(true);
          const err = result as SerializationError;
          expect(err.type === 'invalid_data' || err.type === 'invalid_format').toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('JSON objects with invalid CIDR values produce SerializationError', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Invalid CIDR format
          fc.constant(JSON.stringify({ version: 1, targetCloud: 'aws', rootCIDR: 'not-a-cidr', tree: { id: 'r', cidr: 'not-a-cidr', children: null, tags: [] } })),
          // Prefix out of range
          fc.constant(JSON.stringify({ version: 1, targetCloud: 'aws', rootCIDR: '10.0.0.0/4', tree: { id: 'r', cidr: '10.0.0.0/4', children: null, tags: [] } })),
          fc.constant(JSON.stringify({ version: 1, targetCloud: 'aws', rootCIDR: '10.0.0.0/31', tree: { id: 'r', cidr: '10.0.0.0/31', children: null, tags: [] } })),
          // Octet out of range
          fc.constant(JSON.stringify({ version: 1, targetCloud: 'aws', rootCIDR: '256.0.0.0/16', tree: { id: 'r', cidr: '256.0.0.0/16', children: null, tags: [] } }))
        ),
        (invalidJson) => {
          const result = fromJSON(invalidJson);
          expect(isSerializationError(result)).toBe(true);
          expect((result as SerializationError).type).toBe('invalid_data');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('empty string produces SerializationError', () => {
    const result = fromJSON('');
    expect(isSerializationError(result)).toBe(true);
    expect((result as SerializationError).type).toBe('invalid_format');
  });
});


// === URL-specific Generators ===

/**
 * Generator for a safe tag name that uses printable ASCII characters.
 * Includes delimiter characters (: , | \) to test escaping.
 */
const safeTagNameArb: fc.Arbitrary<string> = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.:,|\\/ '.split('')),
  { minLength: 1, maxLength: 32 }
).filter(s => s.length >= 1 && s.length <= 32);

/**
 * Generator for a safe UseCaseTag for URL tests.
 */
function safeUseCaseTagArb(index: number): fc.Arbitrary<UseCaseTag> {
  return fc.tuple(safeTagNameArb, hexColorArb).map(([name, color]) => ({
    id: `custom-${index}-${name.slice(0, 8).replace(/[^a-zA-Z0-9]/g, 'x')}`,
    name,
    isCustom: true,
    color,
  }));
}

/**
 * Generator for custom tags safe for URL encoding (0-5 custom tags).
 */
const safeCustomTagsArb: fc.Arbitrary<UseCaseTag[]> = fc.integer({ min: 0, max: 5 }).chain(count =>
  fc.tuple(...Array.from({ length: count }, (_, i) => safeUseCaseTagArb(i))).map(tags => tags as UseCaseTag[])
);

/**
 * Generator for a NetworkPlan where leaf tags are drawn from the cloud profile's
 * default tags + custom tags. This is required for URL round trip because fromURL
 * resolves tag IDs against the available tag set.
 */
const networkPlanForURLArb: fc.Arbitrary<NetworkPlan> = fc.integer({ min: 8, max: 24 }).chain(rootPrefix => {
  return fc.tuple(
    targetCloudArb,
    safeCustomTagsArb
  ).chain(([targetCloud, customTags]) => {
    // Get available tags for this cloud + custom tags
    const profile = getProfile(targetCloud);
    const availableTags = [...profile.defaultTags, ...customTags];

    return subnetTreeForURLArb(rootPrefix, availableTags).map(tree => {
      const mask = prefixToMask(rootPrefix);
      const rootNetwork = (0x0A000000 & mask) >>> 0;
      const rootCIDR = { networkAddress: { bits: rootNetwork }, prefixLength: rootPrefix };

      const plan: NetworkPlan = {
        version: 1,
        targetCloud,
        rootCIDR,
        tree,
        customTags,
        ...(targetCloud === 'private' ? { privateCloudReservedCount: 5 } : {}),
      };
      return plan;
    });
  });
});

/**
 * Build a random subnet tree where leaf tags are drawn from the provided available tags.
 * This ensures URL round trip can resolve tag IDs correctly.
 */
function subnetTreeForURLArb(rootPrefix: number, availableTags: readonly UseCaseTag[]): fc.Arbitrary<SubnetNode> {
  const maxSplits = Math.min(30 - rootPrefix, 5);

  // Generator for leaf tags drawn from available tags
  const leafTagsFromAvailableArb: fc.Arbitrary<UseCaseTag[]> = availableTags.length === 0
    ? fc.constant([])
    : fc.integer({ min: 0, max: Math.min(5, availableTags.length) }).chain(count => {
        if (count === 0) return fc.constant([]);
        return fc.shuffledSubarray([...availableTags], { minLength: count, maxLength: count })
          .map(tags => tags as UseCaseTag[]);
      });

  // Generator for workload accounts that don't contain colons (colons are delimiters in URL encoding)
  const safeWorkloadAccountArb: fc.Arbitrary<string | null> = fc.oneof(
    fc.constant(null),
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_ '.split('')), { minLength: 1, maxLength: 32 })
  );

  // Generator for AZ that doesn't contain colons
  const safeAZArb: fc.Arbitrary<string | null> = fc.oneof(
    fc.constant(null),
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')), { minLength: 1, maxLength: 20 })
  );

  // Generator for labels that don't contain colons
  const safeLabelArb: fc.Arbitrary<string | null> = fc.oneof(
    fc.constant(null),
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_ '.split('')), { minLength: 1, maxLength: 32 })
  );

  return fc.integer({ min: 0, max: maxSplits }).chain(numSplits => {
    return fc.tuple(
      fc.array(fc.integer({ min: 0, max: 100 }), { minLength: numSplits, maxLength: numSplits }),
      fc.array(leafTagsFromAvailableArb, { minLength: numSplits + 10, maxLength: numSplits + 10 }),
      fc.array(safeWorkloadAccountArb, { minLength: numSplits + 10, maxLength: numSplits + 10 }),
      fc.array(safeAZArb, { minLength: numSplits + 10, maxLength: numSplits + 10 }),
      fc.array(safeLabelArb, { minLength: numSplits + 10, maxLength: numSplits + 10 })
    ).map(([splitSeeds, tagSets, accountSets, azSets, labelSets]) => {
      const mask = prefixToMask(rootPrefix);
      const rootNetwork = (0x0A000000 & mask) >>> 0;

      let tree: SubnetNode = {
        id: 'root',
        cidr: { networkAddress: { bits: rootNetwork }, prefixLength: rootPrefix },
        children: null,
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };

      // Apply splits to random leaves
      let nodeCounter = 0;
      for (let i = 0; i < numSplits; i++) {
        const leaves = getLeaves(tree);
        const splittableLeaves = leaves.filter(l => l.cidr.prefixLength < 30);
        if (splittableLeaves.length === 0) break;

        const targetIndex = splitSeeds[i] % splittableLeaves.length;
        const targetLeaf = splittableLeaves[targetIndex];
        tree = splitNodeInTree(tree, targetLeaf.id, ++nodeCounter);
      }

      // Annotate leaves with tags, accounts, AZs, and labels
      const leaves = getLeaves(tree);
      tree = annotateLeaves(tree, leaves, tagSets, accountSets, azSets, labelSets);

      return tree;
    });
  });
}

// === URL Structure Comparison Helpers ===

/**
 * Compare two SubnetNode trees by structure (ignoring node IDs, which get regenerated in URL decode).
 * Compares: CIDR blocks, tree shape, tags (by id/name/color), workload accounts, AZs, labels.
 */
function treesStructurallyEqual(a: SubnetNode, b: SubnetNode): boolean {
  // Compare CIDR
  if (a.cidr.networkAddress.bits !== b.cidr.networkAddress.bits) return false;
  if (a.cidr.prefixLength !== b.cidr.prefixLength) return false;

  // Compare leaf annotations
  if (a.workloadAccount !== b.workloadAccount) return false;
  if (a.availabilityZone !== b.availabilityZone) return false;
  if (a.label !== b.label) return false;

  // Compare tags (by id, name, color)
  if (a.tags.length !== b.tags.length) return false;
  for (let i = 0; i < a.tags.length; i++) {
    if (a.tags[i].id !== b.tags[i].id) return false;
    if (a.tags[i].name !== b.tags[i].name) return false;
    if (a.tags[i].color !== b.tags[i].color) return false;
  }

  // Compare children structure
  if (a.children === null && b.children === null) return true;
  if (a.children === null || b.children === null) return false;
  return treesStructurallyEqual(a.children[0], b.children[0]) &&
         treesStructurallyEqual(a.children[1], b.children[1]);
}

/**
 * Compare two NetworkPlans by structure for URL round trip (ignoring node IDs).
 */
function plansStructurallyEqual(a: NetworkPlan, b: NetworkPlan): boolean {
  if (a.targetCloud !== b.targetCloud) return false;
  if (a.rootCIDR.networkAddress.bits !== b.rootCIDR.networkAddress.bits) return false;
  if (a.rootCIDR.prefixLength !== b.rootCIDR.prefixLength) return false;
  if (a.privateCloudReservedCount !== b.privateCloudReservedCount) return false;

  // Compare custom tags
  if (a.customTags.length !== b.customTags.length) return false;
  for (let i = 0; i < a.customTags.length; i++) {
    if (a.customTags[i].id !== b.customTags[i].id) return false;
    if (a.customTags[i].name !== b.customTags[i].name) return false;
    if (a.customTags[i].color !== b.customTags[i].color) return false;
  }

  return treesStructurallyEqual(a.tree, b.tree);
}

// === Property Tests: URL Serialization ===

/**
 * Feature: cloud-ipam-webapp, Property 17: URL serialization round trip
 * Validates: Requirements 8.1, 8.2, 8.9
 *
 * For any valid NetworkPlan (including root CIDR, target cloud, all splits, tags,
 * workload accounts, availability zones, labels, and custom tags), encoding to URL
 * parameters and then decoding SHALL produce a NetworkPlan equivalent to the original.
 */
describe('Property 17: URL serialization round trip', () => {
  it('toURL then fromURL produces a structurally equivalent NetworkPlan', () => {
    fc.assert(
      fc.property(networkPlanForURLArb, (plan) => {
        const url = toURL(plan);
        const result = fromURL(url);

        // Must not be an error
        expect(isSerializationError(result)).toBe(false);

        const restored = result as NetworkPlan;

        // Verify structural equivalence (ignoring regenerated node IDs)
        expect(plansStructurallyEqual(plan, restored)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('round trip preserves targetCloud for all cloud types', () => {
    fc.assert(
      fc.property(networkPlanForURLArb, (plan) => {
        const url = toURL(plan);
        const result = fromURL(url);

        expect(isSerializationError(result)).toBe(false);
        const restored = result as NetworkPlan;
        expect(restored.targetCloud).toBe(plan.targetCloud);
      }),
      { numRuns: 100 }
    );
  });

  it('round trip preserves rootCIDR (network address and prefix)', () => {
    fc.assert(
      fc.property(networkPlanForURLArb, (plan) => {
        const url = toURL(plan);
        const result = fromURL(url);

        expect(isSerializationError(result)).toBe(false);
        const restored = result as NetworkPlan;
        expect(restored.rootCIDR.networkAddress.bits).toBe(plan.rootCIDR.networkAddress.bits);
        expect(restored.rootCIDR.prefixLength).toBe(plan.rootCIDR.prefixLength);
      }),
      { numRuns: 100 }
    );
  });

  it('round trip preserves tree structure (same number of leaves, same CIDR blocks)', () => {
    fc.assert(
      fc.property(networkPlanForURLArb, (plan) => {
        const url = toURL(plan);
        const result = fromURL(url);

        expect(isSerializationError(result)).toBe(false);
        const restored = result as NetworkPlan;

        const originalLeaves = getLeaves(plan.tree);
        const restoredLeaves = getLeaves(restored.tree);

        // Same number of leaves
        expect(restoredLeaves.length).toBe(originalLeaves.length);

        // Same CIDR blocks on each leaf (in order)
        for (let i = 0; i < originalLeaves.length; i++) {
          expect(restoredLeaves[i].cidr.networkAddress.bits).toBe(originalLeaves[i].cidr.networkAddress.bits);
          expect(restoredLeaves[i].cidr.prefixLength).toBe(originalLeaves[i].cidr.prefixLength);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('round trip preserves leaf tags (same tag IDs and names)', () => {
    fc.assert(
      fc.property(networkPlanForURLArb, (plan) => {
        const url = toURL(plan);
        const result = fromURL(url);

        expect(isSerializationError(result)).toBe(false);
        const restored = result as NetworkPlan;

        const originalLeaves = getLeaves(plan.tree);
        const restoredLeaves = getLeaves(restored.tree);

        for (let i = 0; i < originalLeaves.length; i++) {
          expect(restoredLeaves[i].tags.length).toBe(originalLeaves[i].tags.length);
          for (let j = 0; j < originalLeaves[i].tags.length; j++) {
            expect(restoredLeaves[i].tags[j].id).toBe(originalLeaves[i].tags[j].id);
            expect(restoredLeaves[i].tags[j].name).toBe(originalLeaves[i].tags[j].name);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('round trip preserves leaf workload accounts, AZs, and labels', () => {
    fc.assert(
      fc.property(networkPlanForURLArb, (plan) => {
        const url = toURL(plan);
        const result = fromURL(url);

        expect(isSerializationError(result)).toBe(false);
        const restored = result as NetworkPlan;

        const originalLeaves = getLeaves(plan.tree);
        const restoredLeaves = getLeaves(restored.tree);

        for (let i = 0; i < originalLeaves.length; i++) {
          expect(restoredLeaves[i].workloadAccount).toBe(originalLeaves[i].workloadAccount);
          expect(restoredLeaves[i].availabilityZone).toBe(originalLeaves[i].availabilityZone);
          expect(restoredLeaves[i].label).toBe(originalLeaves[i].label);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('round trip preserves custom tags', () => {
    fc.assert(
      fc.property(networkPlanForURLArb, (plan) => {
        const url = toURL(plan);
        const result = fromURL(url);

        expect(isSerializationError(result)).toBe(false);
        const restored = result as NetworkPlan;

        expect(restored.customTags.length).toBe(plan.customTags.length);
        for (let i = 0; i < plan.customTags.length; i++) {
          expect(restored.customTags[i].id).toBe(plan.customTags[i].id);
          expect(restored.customTags[i].name).toBe(plan.customTags[i].name);
          expect(restored.customTags[i].color).toBe(plan.customTags[i].color);
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: cloud-ipam-webapp, Property 19: Invalid serialized input produces error (URL)
 * Validates: Requirements 8.3
 *
 * For any string that is not a valid encoded NetworkPlan (malformed URL parameters),
 * deserialization SHALL return a SerializationError and SHALL not produce a valid NetworkPlan.
 */
describe('Property 19: Invalid serialized input produces error (URL)', () => {
  it('random strings produce SerializationError', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        (randomStr) => {
          const result = fromURL(randomStr);
          expect(isSerializationError(result)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('strings without hash or valid parameters produce SerializationError', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1, maxLength: 50 })
          .filter(s => !s.includes('=')),
        (noParamStr) => {
          const result = fromURL(noParamStr);
          expect(isSerializationError(result)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('URL parameters with missing required fields produce SerializationError', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Missing 'c' (root CIDR)
          fc.constant('#t=aws&s=AAA'),
          // Missing 't' (target cloud)
          fc.constant('#c=10.0.0.0/16&s=AAA'),
          // Missing 's' (tree structure)
          fc.constant('#c=10.0.0.0/16&t=aws'),
          // All missing
          fc.constant('#x=1&y=2&z=3')
        ),
        (invalidURL) => {
          const result = fromURL(invalidURL);
          expect(isSerializationError(result)).toBe(true);
          const err = result as SerializationError;
          expect(err.type === 'invalid_format' || err.type === 'invalid_data').toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('URL parameters with invalid CIDR produce SerializationError', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('#c=not-a-cidr&t=aws&s=AAA'),
          fc.constant('#c=256.0.0.0/16&t=aws&s=AAA'),
          fc.constant('#c=10.0.0.0/4&t=aws&s=AAA'),
          fc.constant('#c=10.0.0.0/31&t=aws&s=AAA'),
          fc.constant('#c=10.0.0/16&t=aws&s=AAA')
        ),
        (invalidURL) => {
          const result = fromURL(invalidURL);
          expect(isSerializationError(result)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('URL parameters with invalid target cloud produce SerializationError', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 10 })
          .filter(s => !['aws', 'azure', 'gcp', 'private'].includes(s)),
        (invalidCloud) => {
          const result = fromURL(`#c=10.0.0.0/16&t=${invalidCloud}&s=AAA`);
          expect(isSerializationError(result)).toBe(true);
          expect((result as SerializationError).type).toBe('invalid_data');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('URL parameters with invalid Base64 tree structure produce SerializationError', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(...'!@#$%^&*()[]{}|<>?'.split('')), { minLength: 1, maxLength: 20 }),
        (invalidBase64) => {
          const result = fromURL(`#c=10.0.0.0/16&t=aws&s=${invalidBase64}`);
          expect(isSerializationError(result)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('empty URL string produces SerializationError', () => {
    const result = fromURL('');
    expect(isSerializationError(result)).toBe(true);
    expect((result as SerializationError).type).toBe('invalid_format');
  });

  it('URL with only hash produces SerializationError', () => {
    const result = fromURL('#');
    expect(isSerializationError(result)).toBe(true);
    expect((result as SerializationError).type).toBe('invalid_format');
  });
});
