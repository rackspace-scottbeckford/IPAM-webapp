import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { useAppStore } from './app-store';

/**
 * Property 1: Operations require cloud selection
 *
 * For any subnet operation (split, join, tag assignment, workload assignment),
 * if no Target_Cloud has been selected, the operation SHALL be rejected and
 * the state SHALL remain unchanged.
 *
 * **Validates: Requirements 1.1**
 */
describe('Property 1: Operations require cloud selection', () => {
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

  it('all tree-modifying operations are no-ops when no cloud is selected', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (nodeId, tagId) => {
        const store = useAppStore.getState();

        // Try all operations
        store.splitSubnet(nodeId);
        expect(useAppStore.getState().networkPlan).toBeNull();

        store.joinSubnet(nodeId);
        expect(useAppStore.getState().networkPlan).toBeNull();

        store.removeTag(nodeId, tagId);
        expect(useAppStore.getState().networkPlan).toBeNull();

        store.setWorkloadAccount(nodeId, 'account');
        expect(useAppStore.getState().networkPlan).toBeNull();

        store.setAvailabilityZone(nodeId, 'us-east-1a');
        expect(useAppStore.getState().networkPlan).toBeNull();

        store.setLabel(nodeId, 'label');
        expect(useAppStore.getState().networkPlan).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('assignTag returns error when no cloud is selected', () => {
    fc.assert(
      fc.property(fc.string(), (nodeId) => {
        const store = useAppStore.getState();
        const result = store.assignTag(nodeId, { id: 'test', name: 'test', isCustom: false, color: '#000000' });
        expect(result).not.toBeNull();
        expect(useAppStore.getState().networkPlan).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('setRootCIDR returns invalid result when no cloud is selected', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 8, max: 30 })
        ).map(([a, b, c, d, p]) => `${a}.${b}.${c}.${d}/${p}`),
        (cidr) => {
          const store = useAppStore.getState();
          const result = store.setRootCIDR(cidr);
          expect(result.valid).toBe(false);
          expect(useAppStore.getState().networkPlan).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
