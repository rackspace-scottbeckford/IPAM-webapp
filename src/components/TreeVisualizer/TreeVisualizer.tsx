import { useRef, useCallback, useState } from 'react';
import { useAppStore } from '../../store/app-store';
import { computeSubnetInfo, numberToIp } from '../../core/subnet-calculator';
import { canSplit, canJoin } from '../../core/tree-operations';
import { useAnnouncer } from '../Announcer/Announcer';
import { useTreeKeyboardNav } from '../../hooks/useTreeKeyboardNav';
import type { SubnetNode } from '../../core/types';
import styles from './TreeVisualizer.module.css';

/**
 * Maximum width (in pixels) for the proportional width bar at the root level.
 */
const MAX_BAR_WIDTH_PX = 300;

/**
 * Minimum rendered width for any visible subnet bar.
 */
const MIN_BAR_WIDTH_PX = 4;

/**
 * TreeVisualizer renders the subnet hierarchy as a tree with parent-child edges.
 *
 * Each node displays: CIDR notation, address range, subnet mask, and usable hosts
 * (adjusted for the active cloud provider's reserved addresses).
 *
 * Proportional width bars show relative address space. Leaf nodes have solid fill
 * and solid border; intermediate nodes have transparent fill and dashed border.
 * Non-leaf subtrees have collapse/expand toggles, defaulting to expanded.
 *
 * Accessibility:
 * - Full keyboard navigation (arrow keys, Home, End)
 * - ARIA tree roles with proper expanded/collapsed states
 * - Screen reader announcements for split/join operations
 * - Focus management after state changes
 * - Visual distinction without relying on color alone (solid vs dashed borders)
 *
 * Requirements: 3.2, 7.1, 7.2, 7.3, 7.4, 7.6
 */
export function TreeVisualizer() {
  const networkPlan = useAppStore((state) => state.networkPlan);
  const providerProfile = useAppStore((state) => state.providerProfile);
  const expandedNodes = useAppStore((state) => state.expandedNodes);
  const splitSubnet = useAppStore((state) => state.splitSubnet);
  const joinSubnet = useAppStore((state) => state.joinSubnet);
  const { announce } = useAnnouncer();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleToggleExpand = useCallback((nodeId: string) => {
    const current = useAppStore.getState().expandedNodes;
    const newExpanded = new Set(current);
    const collapseKey = `__collapsed__${nodeId}`;
    if (newExpanded.has(collapseKey)) {
      newExpanded.delete(collapseKey);
    } else {
      newExpanded.add(collapseKey);
    }
    useAppStore.setState({ expandedNodes: newExpanded });
  }, []);

  const { handleKeyDown, focusNode } = useTreeKeyboardNav({
    tree: networkPlan?.tree ?? null,
    expandedNodes,
    onToggleExpand: handleToggleExpand,
    containerRef,
  });

  const handleSplit = useCallback((node: SubnetNode) => {
    const cidrLabel = `${numberToIp(node.cidr.networkAddress.bits)}/${node.cidr.prefixLength}`;
    splitSubnet(node.id);

    // Announce the split to screen readers
    announce(`Subnet ${cidrLabel} split into two /${node.cidr.prefixLength + 1} subnets`);

    // Focus the first child after split (next render cycle)
    requestAnimationFrame(() => {
      if (containerRef.current) {
        // Find nodes that are children of the split node
        const parentEl = containerRef.current.querySelector(
          `[data-node-id="${node.id}"]`
        );
        if (parentEl) {
          const childNodes = parentEl.querySelectorAll(':scope > [class*="children"] > [data-node-id]');
          if (childNodes.length > 0) {
            (childNodes[0] as HTMLElement).focus();
          }
        }
      }
    });
  }, [splitSubnet, announce, focusNode]);

  const handleJoin = useCallback((node: SubnetNode) => {
    const cidrLabel = `${numberToIp(node.cidr.networkAddress.bits)}/${node.cidr.prefixLength}`;
    joinSubnet(node.id);

    // Announce the join to screen readers
    announce(`Subnets joined into ${cidrLabel}`);

    // Focus the parent node after join
    requestAnimationFrame(() => {
      focusNode(node.id);
    });
  }, [joinSubnet, announce, focusNode]);

  if (!networkPlan || !providerProfile) {
    return (
      <div className={styles.emptyState}>
        Enter a CIDR block to begin visualizing your subnet hierarchy.
      </div>
    );
  }

  const rootPrefix = networkPlan.tree.cidr.prefixLength;
  const reservedCount = networkPlan.privateCloudReservedCount ?? providerProfile.reservedIPs;

  return (
    <div
      ref={containerRef}
      className={styles.container}
      role="tree"
      aria-label="Subnet hierarchy"
      onKeyDown={handleKeyDown}
    >
      <TreeNodeRow
        node={networkPlan.tree}
        rootPrefix={rootPrefix}
        reservedCount={reservedCount}
        depth={0}
        isRoot
        onSplit={handleSplit}
        onJoin={handleJoin}
        onToggleExpand={handleToggleExpand}
      />
    </div>
  );
}

interface TreeNodeRowProps {
  node: SubnetNode;
  rootPrefix: number;
  reservedCount: number;
  depth: number;
  isRoot?: boolean;
  onSplit: (node: SubnetNode) => void;
  onJoin: (node: SubnetNode) => void;
  onToggleExpand: (nodeId: string) => void;
}

/**
 * Recursive component rendering a single node in the subnet tree.
 */
function TreeNodeRow({
  node,
  rootPrefix,
  reservedCount,
  depth,
  isRoot,
  onSplit,
  onJoin,
  onToggleExpand,
}: TreeNodeRowProps) {
  const expandedNodes = useAppStore((state) => state.expandedNodes);

  const isLeaf = node.children === null;
  const providerProfile = useAppStore((state) => state.providerProfile);
  const minPrefix = providerProfile?.minSubnetPrefix ?? 30;
  const canSplitNode = canSplit(node) && node.cidr.prefixLength < minPrefix;
  const canJoinNode = canJoin(node);

  // Default to expanded: a node is collapsed only if explicitly marked as collapsed
  const isCollapsed = expandedNodes.has(`__collapsed__${node.id}`);
  const showChildren = !isLeaf && !isCollapsed;

  // Compute subnet info for display
  const info = computeSubnetInfo(node.cidr, reservedCount);

  // Compute proportional width bar
  const nodeSize = Math.pow(2, 32 - node.cidr.prefixLength);
  const rootSize = Math.pow(2, 32 - rootPrefix);
  const proportionalWidth = (nodeSize / rootSize) * MAX_BAR_WIDTH_PX;
  const isNotToScale = proportionalWidth < MIN_BAR_WIDTH_PX;
  const barWidth = Math.max(MIN_BAR_WIDTH_PX, proportionalWidth);

  const handleToggle = () => {
    onToggleExpand(node.id);
  };

  const nodeClassName = `${styles.nodeContent} ${isLeaf ? styles.leafNode : styles.intermediateNode}`;
  const cidrLabel = `${info.networkAddress}/${node.cidr.prefixLength}`;

  return (
    <div
      className={`${styles.nodeRow} ${!isRoot ? styles.edge : ''}`}
      role="treeitem"
      aria-expanded={isLeaf ? undefined : showChildren}
      aria-label={`${isLeaf ? 'Leaf subnet' : 'Subnet'} ${cidrLabel}, ${info.usableHosts} usable hosts`}
      data-node-id={node.id}
      tabIndex={isRoot ? 0 : -1}
    >
      <div className={nodeClassName}>
        {/* Collapse/expand toggle for non-leaf nodes */}
        {!isLeaf && (
          <button
            className={styles.collapseToggle}
            onClick={handleToggle}
            aria-label={showChildren ? `Collapse ${cidrLabel}` : `Expand ${cidrLabel}`}
            title={showChildren ? 'Collapse' : 'Expand'}
            type="button"
            tabIndex={-1}
          >
            {showChildren ? '−' : '+'}
          </button>
        )}

        <div className={styles.nodeInfo}>
          <span className={styles.cidr}>
            {cidrLabel}
          </span>
          {/* Visual indicator for node type (not relying on color alone) */}
          <span className={styles.nodeTypeIndicator} aria-hidden="true">
            {isLeaf ? '●' : '◌'}
          </span>
          <span className={styles.detail}>
            <span className={styles.detailLabel}>Range:</span>
            {info.networkAddress} – {info.broadcastAddress}
          </span>
          <span className={styles.detail}>
            <span className={styles.detailLabel}>Mask:</span>
            {info.subnetMask}
          </span>
          <span className={styles.detail}>
            <span className={styles.detailLabel}>Hosts:</span>
            {info.usableHosts.toLocaleString()}
          </span>
        </div>

        {/* Inline label for annotating subnet purpose */}
        <InlineLabel nodeId={node.id} label={node.label} cidrLabel={cidrLabel} />

        {/* Split/Join action buttons */}
        <div className={styles.actions}>
          {isLeaf && (
            <button
              className={styles.actionButton}
              onClick={() => onSplit(node)}
              disabled={!canSplitNode}
              aria-label={
                canSplitNode
                  ? `Split subnet ${cidrLabel}`
                  : `Cannot split ${cidrLabel}: maximum split depth reached`
              }
              title={canSplitNode ? 'Split subnet' : `Minimum subnet size reached (/${minPrefix})`}
              type="button"
              tabIndex={-1}
            >
              ✂ Split
            </button>
          )}
          {!isLeaf && canJoinNode && (
            <button
              className={styles.actionButton}
              onClick={() => onJoin(node)}
              aria-label={`Join children of ${cidrLabel}`}
              title="Join child subnets"
              type="button"
              tabIndex={-1}
            >
              ⊕ Join
            </button>
          )}
          {!isLeaf && !canJoinNode && node.children && (
            <button
              className={styles.actionButton}
              disabled
              aria-label={`Cannot join children of ${cidrLabel}: children have been further subdivided`}
              title="Cannot join: children have been further subdivided"
              type="button"
              tabIndex={-1}
            >
              ⊕ Join
            </button>
          )}
        </div>
      </div>

      {/* Proportional width bar */}
      <div className={styles.widthBarContainer}>
        <div
          className={`${styles.widthBar} ${isLeaf ? styles.widthBarLeaf : styles.widthBarIntermediate}`}
          style={{ width: `${barWidth}px` }}
          aria-label={`Address space: ${info.totalAddresses.toLocaleString()} addresses`}
          role="img"
        />
        {isNotToScale && (
          <span className={styles.notToScale} aria-label="Bar is not to scale">
            ⚠ not to scale
          </span>
        )}
      </div>

      {/* Children */}
      {showChildren && node.children && (
        <div className={styles.children} role="group" aria-label={`Children of ${cidrLabel}`}>
          {node.children.map((child) => (
            <TreeNodeRow
              key={child.id}
              node={child}
              rootPrefix={rootPrefix}
              reservedCount={reservedCount}
              depth={depth + 1}
              onSplit={onSplit}
              onJoin={onJoin}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Inline label input that appears on each subnet node.
 * Allows quick annotation of what the subnet is used for (max 64 chars).
 */
function InlineLabel({ nodeId, label, cidrLabel }: { nodeId: string; label: string | null; cidrLabel: string }) {
  const setLabel = useAppStore((s) => s.setLabel);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    setValue(label ?? '');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleBlur = () => {
    setEditing(false);
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      if (label !== null) setLabel(nodeId, null);
    } else if (trimmed !== label && trimmed.length <= 64) {
      setLabel(nodeId, trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Stop propagation so tree keyboard nav doesn't intercept typing (especially Space)
    e.stopPropagation();
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setValue(label ?? '');
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <div className={styles.inlineLabelRow}>
        <input
          ref={inputRef}
          className={styles.inlineLabelInput}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          maxLength={64}
          placeholder="What is this subnet for?"
          aria-label={`Label for subnet ${cidrLabel}`}
        />
      </div>
    );
  }

  return (
    <div className={styles.inlineLabelRow}>
      {label ? (
        <button
          className={styles.inlineLabelText}
          onClick={handleClick}
          title="Click to edit label"
          aria-label={`Label: ${label}. Click to edit.`}
          type="button"
          tabIndex={-1}
        >
          💬 {label}
        </button>
      ) : (
        <button
          className={styles.inlineLabelPlaceholder}
          onClick={handleClick}
          title="Add a label for this subnet"
          aria-label={`Add label for subnet ${cidrLabel}`}
          type="button"
          tabIndex={-1}
        >
          + Add comment
        </button>
      )}
    </div>
  );
}
