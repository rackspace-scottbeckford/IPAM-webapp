import { describe, it, expect } from 'vitest';
import { toJSON, fromJSON, toURL, fromURL } from './plan-serializer';
import type { NetworkPlan, SubnetNode, SerializationError } from '../core/types';

/**
 * Helper to create a minimal valid NetworkPlan for testing.
 */
function createTestPlan(overrides?: Partial<NetworkPlan>): NetworkPlan {
  const rootNode: SubnetNode = {
    id: 'root-1',
    cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 16 }, // 10.0.0.0/16
    children: null,
    tags: [],
    workloadAccount: null,
    availabilityZone: null,
    label: null,
  };

  return {
    version: 1,
    targetCloud: 'aws',
    rootCIDR: { networkAddress: { bits: 0x0A000000 }, prefixLength: 16 },
    tree: rootNode,
    customTags: [],
    ...overrides,
  };
}

/**
 * Helper to create a plan with a split tree (parent with two leaf children).
 */
function createSplitPlan(): NetworkPlan {
  const leftChild: SubnetNode = {
    id: 'child-left',
    cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 17 }, // 10.0.0.0/17
    children: null,
    tags: [{ id: 'aws-wl', name: 'workload', isCustom: false, color: '#2E73B8' }],
    workloadAccount: 'account-1',
    availabilityZone: 'us-east-1a',
    label: 'Production VPC',
  };

  const rightChild: SubnetNode = {
    id: 'child-right',
    cidr: { networkAddress: { bits: 0x0A008000 }, prefixLength: 17 }, // 10.0.128.0/17
    children: null,
    tags: [{ id: 'aws-ss', name: 'shared-services', isCustom: false, color: '#8C4FFF' }],
    workloadAccount: 'account-2',
    availabilityZone: 'us-east-1b',
    label: 'Shared Services',
  };

  const rootNode: SubnetNode = {
    id: 'root-1',
    cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 16 }, // 10.0.0.0/16
    children: [leftChild, rightChild],
    tags: [],
    workloadAccount: null,
    availabilityZone: null,
    label: null,
  };

  return {
    version: 1,
    targetCloud: 'aws',
    rootCIDR: { networkAddress: { bits: 0x0A000000 }, prefixLength: 16 },
    tree: rootNode,
    customTags: [
      { id: 'custom-1', name: 'my-custom-tag', isCustom: true, color: '#AABBCC' },
    ],
  };
}

function isSerializationError(result: unknown): result is SerializationError {
  return typeof result === 'object' && result !== null && 'type' in result && 'message' in result;
}

describe('PlanSerializer', () => {
  describe('toJSON', () => {
    it('produces valid JSON with version field', () => {
      const plan = createTestPlan();
      const json = toJSON(plan);

      const parsed = JSON.parse(json);
      expect(parsed.version).toBe(1);
      expect(parsed.targetCloud).toBe('aws');
      expect(parsed.rootCIDR).toBe('10.0.0.0/16');
    });

    it('serializes CIDR blocks as readable strings', () => {
      const plan = createSplitPlan();
      const json = toJSON(plan);
      const parsed = JSON.parse(json);

      expect(parsed.rootCIDR).toBe('10.0.0.0/16');
      expect(parsed.tree.cidr).toBe('10.0.0.0/16');
      expect(parsed.tree.children[0].cidr).toBe('10.0.0.0/17');
      expect(parsed.tree.children[1].cidr).toBe('10.0.128.0/17');
    });

    it('includes custom tags in output', () => {
      const plan = createSplitPlan();
      const json = toJSON(plan);
      const parsed = JSON.parse(json);

      expect(parsed.customTags).toHaveLength(1);
      expect(parsed.customTags[0].name).toBe('my-custom-tag');
      expect(parsed.customTags[0].color).toBe('#AABBCC');
    });

    it('includes privateCloudReservedCount when present', () => {
      const plan = createTestPlan({ targetCloud: 'private', privateCloudReservedCount: 5 });
      const json = toJSON(plan);
      const parsed = JSON.parse(json);

      expect(parsed.privateCloudReservedCount).toBe(5);
    });

    it('omits privateCloudReservedCount when undefined', () => {
      const plan = createTestPlan();
      const json = toJSON(plan);
      const parsed = JSON.parse(json);

      expect(parsed.privateCloudReservedCount).toBeUndefined();
    });

    it('serializes tags and metadata on leaf nodes', () => {
      const plan = createSplitPlan();
      const json = toJSON(plan);
      const parsed = JSON.parse(json);

      const leftChild = parsed.tree.children[0];
      expect(leftChild.tags).toHaveLength(1);
      expect(leftChild.tags[0].name).toBe('workload');
      expect(leftChild.workloadAccount).toBe('account-1');
      expect(leftChild.availabilityZone).toBe('us-east-1a');
      expect(leftChild.label).toBe('Production VPC');
    });
  });

  describe('fromJSON — round trip', () => {
    it('round-trips a simple leaf plan', () => {
      const plan = createTestPlan();
      const json = toJSON(plan);
      const result = fromJSON(json);

      expect(isSerializationError(result)).toBe(false);
      const restored = result as NetworkPlan;
      expect(restored.version).toBe(1);
      expect(restored.targetCloud).toBe('aws');
      expect(restored.rootCIDR.networkAddress.bits).toBe(plan.rootCIDR.networkAddress.bits);
      expect(restored.rootCIDR.prefixLength).toBe(plan.rootCIDR.prefixLength);
      expect(restored.tree.id).toBe('root-1');
      expect(restored.tree.children).toBeNull();
    });

    it('round-trips a plan with split tree and metadata', () => {
      const plan = createSplitPlan();
      const json = toJSON(plan);
      const result = fromJSON(json);

      expect(isSerializationError(result)).toBe(false);
      const restored = result as NetworkPlan;
      expect(restored.targetCloud).toBe('aws');
      expect(restored.tree.children).not.toBeNull();
      expect(restored.tree.children![0].tags[0].name).toBe('workload');
      expect(restored.tree.children![0].workloadAccount).toBe('account-1');
      expect(restored.tree.children![0].availabilityZone).toBe('us-east-1a');
      expect(restored.tree.children![0].label).toBe('Production VPC');
      expect(restored.tree.children![1].tags[0].name).toBe('shared-services');
      expect(restored.customTags).toHaveLength(1);
      expect(restored.customTags[0].name).toBe('my-custom-tag');
    });

    it('round-trips a private cloud plan with reserved count', () => {
      const plan = createTestPlan({
        targetCloud: 'private',
        privateCloudReservedCount: 7,
        privateCloudIcon: 'data:image/png;base64,abc123',
      });
      const json = toJSON(plan);
      const result = fromJSON(json);

      expect(isSerializationError(result)).toBe(false);
      const restored = result as NetworkPlan;
      expect(restored.targetCloud).toBe('private');
      expect(restored.privateCloudReservedCount).toBe(7);
      expect(restored.privateCloudIcon).toBe('data:image/png;base64,abc123');
    });
  });

  describe('fromJSON — invalid JSON', () => {
    it('rejects non-JSON input', () => {
      const result = fromJSON('this is not json');
      expect(isSerializationError(result)).toBe(true);
      expect((result as SerializationError).type).toBe('invalid_format');
    });

    it('rejects empty string', () => {
      const result = fromJSON('');
      expect(isSerializationError(result)).toBe(true);
      expect((result as SerializationError).type).toBe('invalid_format');
    });

    it('rejects JSON array', () => {
      const result = fromJSON('[]');
      expect(isSerializationError(result)).toBe(true);
      expect((result as SerializationError).type).toBe('invalid_format');
    });

    it('rejects JSON primitive', () => {
      const result = fromJSON('"hello"');
      expect(isSerializationError(result)).toBe(true);
      expect((result as SerializationError).type).toBe('invalid_format');
    });
  });

  describe('fromJSON — oversized input', () => {
    it('rejects input exceeding 5MB', () => {
      // Create a string just over 5MB
      const oversized = '{"version":1,' + ' '.repeat(5 * 1024 * 1024) + '}';
      const result = fromJSON(oversized);
      expect(isSerializationError(result)).toBe(true);
      expect((result as SerializationError).type).toBe('size_exceeded');
      expect((result as SerializationError).message).toContain('5 MB');
    });
  });

  describe('fromJSON — invalid tree structure', () => {
    it('rejects tree with non-binary children (3 children)', () => {
      const json = JSON.stringify({
        version: 1,
        targetCloud: 'aws',
        rootCIDR: '10.0.0.0/16',
        tree: {
          id: 'root',
          cidr: '10.0.0.0/16',
          children: [
            { id: 'c1', cidr: '10.0.0.0/17', children: null, tags: [] },
            { id: 'c2', cidr: '10.0.128.0/17', children: null, tags: [] },
            { id: 'c3', cidr: '10.0.64.0/18', children: null, tags: [] },
          ],
          tags: [],
        },
        customTags: [],
      });
      const result = fromJSON(json);
      expect(isSerializationError(result)).toBe(true);
      expect((result as SerializationError).type).toBe('invalid_data');
    });

    it('rejects tree with single child', () => {
      const json = JSON.stringify({
        version: 1,
        targetCloud: 'aws',
        rootCIDR: '10.0.0.0/16',
        tree: {
          id: 'root',
          cidr: '10.0.0.0/16',
          children: [
            { id: 'c1', cidr: '10.0.0.0/17', children: null, tags: [] },
          ],
          tags: [],
        },
        customTags: [],
      });
      const result = fromJSON(json);
      expect(isSerializationError(result)).toBe(true);
      expect((result as SerializationError).type).toBe('invalid_data');
    });

    it('rejects tree with wrong child prefix length', () => {
      const json = JSON.stringify({
        version: 1,
        targetCloud: 'aws',
        rootCIDR: '10.0.0.0/16',
        tree: {
          id: 'root',
          cidr: '10.0.0.0/16',
          children: [
            { id: 'c1', cidr: '10.0.0.0/18', children: null, tags: [] }, // should be /17
            { id: 'c2', cidr: '10.0.128.0/17', children: null, tags: [] },
          ],
          tags: [],
        },
        customTags: [],
      });
      const result = fromJSON(json);
      expect(isSerializationError(result)).toBe(true);
      expect((result as SerializationError).type).toBe('invalid_data');
    });

    it('rejects tree with wrong second child network address', () => {
      const json = JSON.stringify({
        version: 1,
        targetCloud: 'aws',
        rootCIDR: '10.0.0.0/16',
        tree: {
          id: 'root',
          cidr: '10.0.0.0/16',
          children: [
            { id: 'c1', cidr: '10.0.0.0/17', children: null, tags: [] },
            { id: 'c2', cidr: '10.1.0.0/17', children: null, tags: [] }, // wrong address
          ],
          tags: [],
        },
        customTags: [],
      });
      const result = fromJSON(json);
      expect(isSerializationError(result)).toBe(true);
      expect((result as SerializationError).type).toBe('invalid_data');
    });

    it('rejects tree with tags on non-leaf node', () => {
      const json = JSON.stringify({
        version: 1,
        targetCloud: 'aws',
        rootCIDR: '10.0.0.0/16',
        tree: {
          id: 'root',
          cidr: '10.0.0.0/16',
          children: [
            { id: 'c1', cidr: '10.0.0.0/17', children: null, tags: [] },
            { id: 'c2', cidr: '10.0.128.0/17', children: null, tags: [] },
          ],
          tags: [{ id: 'aws-wl', name: 'workload', isCustom: false, color: '#2E73B8' }],
        },
        customTags: [],
      });
      const result = fromJSON(json);
      expect(isSerializationError(result)).toBe(true);
      expect((result as SerializationError).type).toBe('invalid_data');
    });
  });

  describe('fromJSON — invalid targetCloud', () => {
    it('rejects unknown cloud provider', () => {
      const json = JSON.stringify({
        version: 1,
        targetCloud: 'oracle',
        rootCIDR: '10.0.0.0/16',
        tree: { id: 'root', cidr: '10.0.0.0/16', children: null, tags: [] },
        customTags: [],
      });
      const result = fromJSON(json);
      expect(isSerializationError(result)).toBe(true);
      expect((result as SerializationError).type).toBe('invalid_data');
      expect((result as SerializationError).message).toContain('targetCloud');
    });

    it('rejects missing targetCloud', () => {
      const json = JSON.stringify({
        version: 1,
        rootCIDR: '10.0.0.0/16',
        tree: { id: 'root', cidr: '10.0.0.0/16', children: null, tags: [] },
        customTags: [],
      });
      const result = fromJSON(json);
      expect(isSerializationError(result)).toBe(true);
      expect((result as SerializationError).type).toBe('invalid_data');
    });
  });

  describe('fromJSON — schema validation', () => {
    it('rejects wrong version', () => {
      const json = JSON.stringify({
        version: 99,
        targetCloud: 'aws',
        rootCIDR: '10.0.0.0/16',
        tree: { id: 'root', cidr: '10.0.0.0/16', children: null, tags: [] },
        customTags: [],
      });
      const result = fromJSON(json);
      expect(isSerializationError(result)).toBe(true);
      expect((result as SerializationError).type).toBe('invalid_data');
    });

    it('rejects invalid rootCIDR format', () => {
      const json = JSON.stringify({
        version: 1,
        targetCloud: 'aws',
        rootCIDR: 'not-a-cidr',
        tree: { id: 'root', cidr: '10.0.0.0/16', children: null, tags: [] },
        customTags: [],
      });
      const result = fromJSON(json);
      expect(isSerializationError(result)).toBe(true);
      expect((result as SerializationError).type).toBe('invalid_data');
    });

    it('rejects rootCIDR with prefix out of range', () => {
      const json = JSON.stringify({
        version: 1,
        targetCloud: 'aws',
        rootCIDR: '10.0.0.0/4',
        tree: { id: 'root', cidr: '10.0.0.0/4', children: null, tags: [] },
        customTags: [],
      });
      const result = fromJSON(json);
      expect(isSerializationError(result)).toBe(true);
      expect((result as SerializationError).type).toBe('invalid_data');
    });

    it('rejects tree root that does not match rootCIDR', () => {
      const json = JSON.stringify({
        version: 1,
        targetCloud: 'aws',
        rootCIDR: '10.0.0.0/16',
        tree: { id: 'root', cidr: '192.168.0.0/16', children: null, tags: [] },
        customTags: [],
      });
      const result = fromJSON(json);
      expect(isSerializationError(result)).toBe(true);
      expect((result as SerializationError).type).toBe('invalid_data');
      expect((result as SerializationError).message).toContain('does not match');
    });

    it('rejects more than 20 custom tags', () => {
      const tooManyTags = Array.from({ length: 21 }, (_, i) => ({
        id: `tag-${i}`,
        name: `tag${i}`,
        isCustom: true,
        color: `#${String(i).padStart(6, '0')}`,
      }));
      const json = JSON.stringify({
        version: 1,
        targetCloud: 'aws',
        rootCIDR: '10.0.0.0/16',
        tree: { id: 'root', cidr: '10.0.0.0/16', children: null, tags: [] },
        customTags: tooManyTags,
      });
      const result = fromJSON(json);
      expect(isSerializationError(result)).toBe(true);
      expect((result as SerializationError).type).toBe('invalid_data');
      expect((result as SerializationError).message).toContain('20');
    });

    it('rejects invalid privateCloudReservedCount', () => {
      const json = JSON.stringify({
        version: 1,
        targetCloud: 'private',
        rootCIDR: '10.0.0.0/16',
        tree: { id: 'root', cidr: '10.0.0.0/16', children: null, tags: [] },
        customTags: [],
        privateCloudReservedCount: 15,
      });
      const result = fromJSON(json);
      expect(isSerializationError(result)).toBe(true);
      expect((result as SerializationError).type).toBe('invalid_data');
    });
  });

  describe('fromJSON — validates imported target cloud loads profile', () => {
    it('accepts all valid target clouds', () => {
      for (const cloud of ['aws', 'azure', 'gcp', 'private'] as const) {
        const plan = createTestPlan({ targetCloud: cloud });
        const json = toJSON(plan);
        const result = fromJSON(json);
        expect(isSerializationError(result)).toBe(false);
        expect((result as NetworkPlan).targetCloud).toBe(cloud);
      }
    });
  });
});


describe('PlanSerializer — URL Encoding', () => {
  describe('toURL', () => {
    it('produces a valid URL hash string starting with #', () => {
      const plan = createTestPlan();
      const url = toURL(plan);

      expect(url.startsWith('#')).toBe(true);
      expect(url).toContain('c=10.0.0.0/16');
      expect(url).toContain('t=aws');
      expect(url).toContain('s=');
    });

    it('encodes root CIDR correctly', () => {
      const plan = createTestPlan();
      const url = toURL(plan);
      const params = new URLSearchParams(url.slice(1));

      expect(params.get('c')).toBe('10.0.0.0/16');
    });

    it('encodes target cloud correctly', () => {
      const plan = createTestPlan({ targetCloud: 'azure' });
      const url = toURL(plan);
      const params = new URLSearchParams(url.slice(1));

      expect(params.get('t')).toBe('azure');
    });

    it('includes custom tags when present', () => {
      const plan = createSplitPlan();
      const url = toURL(plan);

      expect(url).toContain('ct=');
    });

    it('omits custom tags when empty', () => {
      const plan = createTestPlan();
      const url = toURL(plan);

      expect(url).not.toContain('ct=');
    });

    it('includes private cloud reserved count when present', () => {
      const plan = createTestPlan({ targetCloud: 'private', privateCloudReservedCount: 5 });
      const url = toURL(plan);

      expect(url).toContain('r=5');
    });

    it('omits private cloud reserved count when undefined', () => {
      const plan = createTestPlan();
      const url = toURL(plan);

      expect(url).not.toContain('r=');
    });

    it('includes assignments data when leaves have tags', () => {
      const plan = createSplitPlan();
      const url = toURL(plan);

      expect(url).toContain('d=');
    });

    it('omits assignments data when no leaves have metadata', () => {
      const plan = createTestPlan();
      const url = toURL(plan);

      expect(url).not.toContain('d=');
    });
  });

  describe('fromURL — round trip', () => {
    it('round-trips a simple leaf plan', () => {
      const plan = createTestPlan();
      const url = toURL(plan);
      const result = fromURL(url);

      expect(isSerializationError(result)).toBe(false);
      const restored = result as NetworkPlan;
      expect(restored.version).toBe(1);
      expect(restored.targetCloud).toBe('aws');
      expect(restored.rootCIDR.networkAddress.bits).toBe(plan.rootCIDR.networkAddress.bits);
      expect(restored.rootCIDR.prefixLength).toBe(plan.rootCIDR.prefixLength);
      expect(restored.tree.children).toBeNull();
    });

    it('round-trips a plan with splits and assignments', () => {
      const plan = createSplitPlan();
      const url = toURL(plan);
      const result = fromURL(url);

      expect(isSerializationError(result)).toBe(false);
      const restored = result as NetworkPlan;
      expect(restored.targetCloud).toBe('aws');
      expect(restored.tree.children).not.toBeNull();

      // Verify left child assignments
      const leftChild = restored.tree.children![0];
      expect(leftChild.tags).toHaveLength(1);
      expect(leftChild.tags[0].id).toBe('aws-wl');
      expect(leftChild.workloadAccount).toBe('account-1');
      expect(leftChild.availabilityZone).toBe('us-east-1a');
      expect(leftChild.label).toBe('Production VPC');

      // Verify right child assignments
      const rightChild = restored.tree.children![1];
      expect(rightChild.tags).toHaveLength(1);
      expect(rightChild.tags[0].id).toBe('aws-ss');
      expect(rightChild.workloadAccount).toBe('account-2');
      expect(rightChild.availabilityZone).toBe('us-east-1b');
      expect(rightChild.label).toBe('Shared Services');

      // Verify custom tags
      expect(restored.customTags).toHaveLength(1);
      expect(restored.customTags[0].name).toBe('my-custom-tag');
      expect(restored.customTags[0].color).toBe('#AABBCC');
    });

    it('round-trips a private cloud plan with reserved count', () => {
      const plan = createTestPlan({ targetCloud: 'private', privateCloudReservedCount: 7 });
      const url = toURL(plan);
      const result = fromURL(url);

      expect(isSerializationError(result)).toBe(false);
      const restored = result as NetworkPlan;
      expect(restored.targetCloud).toBe('private');
      expect(restored.privateCloudReservedCount).toBe(7);
    });

    it('round-trips all target clouds', () => {
      for (const cloud of ['aws', 'azure', 'gcp', 'private'] as const) {
        const plan = createTestPlan({ targetCloud: cloud });
        const url = toURL(plan);
        const result = fromURL(url);
        expect(isSerializationError(result)).toBe(false);
        expect((result as NetworkPlan).targetCloud).toBe(cloud);
      }
    });

    it('round-trips a deeply split tree', () => {
      // Create a tree with 3 levels of splits
      const leaf1: SubnetNode = {
        id: 'l1',
        cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 18 },
        children: null,
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };
      const leaf2: SubnetNode = {
        id: 'l2',
        cidr: { networkAddress: { bits: 0x0A004000 }, prefixLength: 18 },
        children: null,
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };
      const leftChild: SubnetNode = {
        id: 'left',
        cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 17 },
        children: [leaf1, leaf2],
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };
      const rightChild: SubnetNode = {
        id: 'right',
        cidr: { networkAddress: { bits: 0x0A008000 }, prefixLength: 17 },
        children: null,
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };
      const root: SubnetNode = {
        id: 'root',
        cidr: { networkAddress: { bits: 0x0A000000 }, prefixLength: 16 },
        children: [leftChild, rightChild],
        tags: [],
        workloadAccount: null,
        availabilityZone: null,
        label: null,
      };

      const plan: NetworkPlan = {
        version: 1,
        targetCloud: 'aws',
        rootCIDR: { networkAddress: { bits: 0x0A000000 }, prefixLength: 16 },
        tree: root,
        customTags: [],
      };

      const url = toURL(plan);
      const result = fromURL(url);

      expect(isSerializationError(result)).toBe(false);
      const restored = result as NetworkPlan;
      // Verify tree structure: root has children, left child has children, right child is leaf
      expect(restored.tree.children).not.toBeNull();
      expect(restored.tree.children![0].children).not.toBeNull();
      expect(restored.tree.children![0].children![0].children).toBeNull();
      expect(restored.tree.children![0].children![1].children).toBeNull();
      expect(restored.tree.children![1].children).toBeNull();

      // Verify CIDR values
      expect(restored.tree.children![0].cidr.prefixLength).toBe(17);
      expect(restored.tree.children![0].children![0].cidr.prefixLength).toBe(18);
      expect(restored.tree.children![0].children![1].cidr.prefixLength).toBe(18);
    });
  });

  describe('fromURL — invalid input', () => {
    it('rejects empty URL', () => {
      const result = fromURL('');
      expect(isSerializationError(result)).toBe(true);
      expect((result as SerializationError).type).toBe('invalid_format');
    });

    it('rejects URL with only hash', () => {
      const result = fromURL('#');
      expect(isSerializationError(result)).toBe(true);
      expect((result as SerializationError).type).toBe('invalid_format');
    });

    it('rejects URL missing root CIDR', () => {
      const result = fromURL('#t=aws&s=AAA');
      expect(isSerializationError(result)).toBe(true);
      expect((result as SerializationError).message).toContain('c');
    });

    it('rejects URL missing target cloud', () => {
      const result = fromURL('#c=10.0.0.0/16&s=AAA');
      expect(isSerializationError(result)).toBe(true);
      expect((result as SerializationError).message).toContain('t');
    });

    it('rejects URL missing tree structure', () => {
      const result = fromURL('#c=10.0.0.0/16&t=aws');
      expect(isSerializationError(result)).toBe(true);
      expect((result as SerializationError).message).toContain('s');
    });

    it('rejects invalid target cloud', () => {
      const result = fromURL('#c=10.0.0.0/16&t=oracle&s=AQA');
      expect(isSerializationError(result)).toBe(true);
      expect((result as SerializationError).type).toBe('invalid_data');
      expect((result as SerializationError).message).toContain('target cloud');
    });

    it('rejects invalid root CIDR', () => {
      const result = fromURL('#c=not-a-cidr&t=aws&s=AQA');
      expect(isSerializationError(result)).toBe(true);
      expect((result as SerializationError).type).toBe('invalid_data');
    });

    it('rejects invalid Base64 in tree structure', () => {
      const result = fromURL('#c=10.0.0.0/16&t=aws&s=!!!invalid!!!');
      expect(isSerializationError(result)).toBe(true);
      expect((result as SerializationError).type).toBe('invalid_format');
    });

    it('rejects invalid privateCloudReservedCount', () => {
      const result = fromURL('#c=10.0.0.0/16&t=private&s=AQA&r=15');
      expect(isSerializationError(result)).toBe(true);
      expect((result as SerializationError).type).toBe('invalid_data');
    });

    it('handles missing parameters gracefully with specific error messages', () => {
      const result = fromURL('#c=10.0.0.0/16');
      expect(isSerializationError(result)).toBe(true);
      const error = result as SerializationError;
      expect(error.type).toBe('invalid_format');
      expect(error.message.length).toBeGreaterThan(0);
    });
  });
});
