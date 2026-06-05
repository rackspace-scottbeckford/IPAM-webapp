import { useState, useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '../../store/app-store';
import { getAvailableTags } from '../../config/cloud-profiles';
import { findNode } from '../../core/tree-operations';
import type { SubnetNode, UseCaseTag } from '../../core/types';
import styles from './SubnetDetails.module.css';

interface SubnetDetailsProps {
  /** The ID of the currently selected subnet node */
  selectedNodeId: string | null;
}

/**
 * SubnetDetails displays tag assignment, workload account, availability zone,
 * and label controls for the selected subnet node.
 *
 * - Tag picker shows only tags valid for the current Target_Cloud (max 5 per subnet)
 * - Prevents tag assignment on non-leaf nodes with a message
 * - Each assigned tag shows with its unique color and a remove button
 * - Text inputs for workload account (1–64 chars), AZ (up to 64 chars), label (1–64 chars)
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9
 */
export function SubnetDetails({ selectedNodeId }: SubnetDetailsProps) {
  const networkPlan = useAppStore((s) => s.networkPlan);
  const providerProfile = useAppStore((s) => s.providerProfile);
  const customTags = useAppStore((s) => s.customTags);
  const assignTag = useAppStore((s) => s.assignTag);
  const removeTag = useAppStore((s) => s.removeTag);
  const setWorkloadAccount = useAppStore((s) => s.setWorkloadAccount);
  const setAvailabilityZone = useAppStore((s) => s.setAvailabilityZone);
  const setLabel = useAppStore((s) => s.setLabel);

  if (!selectedNodeId || !networkPlan || !providerProfile) {
    return (
      <div className={styles.emptyState}>
        Select a subnet to view and edit its details.
      </div>
    );
  }

  const node = findNode(networkPlan.tree, selectedNodeId);
  if (!node) {
    return (
      <div className={styles.emptyState}>
        Selected subnet not found.
      </div>
    );
  }

  const isLeaf = node.children === null;
  const availableTags = getAvailableTags(providerProfile, customTags);

  return (
    <div className={styles.container} aria-label="Subnet details">
      <div className={styles.header}>
        <span className={styles.title}>Subnet Details</span>
        <span className={styles.cidrLabel}>
          {numberToIp(node.cidr.networkAddress.bits)}/{node.cidr.prefixLength}
        </span>
      </div>

      {!isLeaf ? (
        <div className={styles.nonLeafMessage} role="alert">
          <span className={styles.nonLeafIcon} aria-hidden="true">⚠</span>
          <span>Only leaf subnets can be tagged</span>
        </div>
      ) : (
        <>
          <TagSection
            node={node}
            availableTags={availableTags}
            onAssign={assignTag}
            onRemove={removeTag}
          />
          <MetadataInputs
            node={node}
            onSetWorkloadAccount={setWorkloadAccount}
            onSetAvailabilityZone={setAvailabilityZone}
            onSetLabel={setLabel}
          />
        </>
      )}
    </div>
  );
}

// === Tag Section ===

interface TagSectionProps {
  node: SubnetNode;
  availableTags: UseCaseTag[];
  onAssign: (nodeId: string, tag: UseCaseTag) => void;
  onRemove: (nodeId: string, tagId: string) => void;
}

function TagSection({ node, availableTags, onAssign, onRemove }: TagSectionProps) {
  const assignedTagIds = new Set(node.tags.map((t) => t.id));
  const unassignedTags = availableTags.filter((t) => !assignedTagIds.has(t.id));
  const atMaxTags = node.tags.length >= 5;

  return (
    <div className={styles.section}>
      <span className={styles.sectionLabel} id="tags-label">
        Tags ({node.tags.length}/5)
      </span>

      {/* Assigned tags */}
      {node.tags.length > 0 && (
        <ul className={styles.tagList} aria-labelledby="tags-label">
          {node.tags.map((tag) => (
            <li key={tag.id}>
              <span
                className={styles.tagChip}
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
                <button
                  className={styles.tagRemoveButton}
                  onClick={() => onRemove(node.id, tag.id)}
                  aria-label={`Remove tag ${tag.name}`}
                  title={`Remove ${tag.name}`}
                  type="button"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Tag picker */}
      {atMaxTags ? (
        <span className={styles.maxTagsMessage}>Maximum 5 tags reached</span>
      ) : (
        <div className={styles.tagPicker} role="group" aria-label="Available tags">
          {unassignedTags.map((tag) => (
            <button
              key={tag.id}
              className={styles.tagPickerButton}
              onClick={() => onAssign(node.id, tag)}
              disabled={atMaxTags}
              aria-label={`Assign tag ${tag.name}`}
              title={tag.name}
              type="button"
              style={{ borderLeftColor: tag.color, borderLeftWidth: '3px' }}
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// === Metadata Inputs ===

interface MetadataInputsProps {
  node: SubnetNode;
  onSetWorkloadAccount: (nodeId: string, account: string | null) => void;
  onSetAvailabilityZone: (nodeId: string, az: string | null) => void;
  onSetLabel: (nodeId: string, label: string | null) => void;
}

function MetadataInputs({
  node,
  onSetWorkloadAccount,
  onSetAvailabilityZone,
  onSetLabel,
}: MetadataInputsProps) {
  return (
    <>
      <TextFieldInput
        label="Workload Account"
        value={node.workloadAccount}
        maxLength={64}
        placeholder="e.g., prod-account-01"
        onCommit={(val) => onSetWorkloadAccount(node.id, val)}
        onClear={() => onSetWorkloadAccount(node.id, null)}
      />
      <TextFieldInput
        label="Availability Zone"
        value={node.availabilityZone}
        maxLength={64}
        placeholder="e.g., us-east-1a"
        onCommit={(val) => onSetAvailabilityZone(node.id, val)}
        onClear={() => onSetAvailabilityZone(node.id, null)}
      />
      <TextFieldInput
        label="Label"
        value={node.label}
        maxLength={64}
        placeholder="e.g., Transit subnet"
        onCommit={(val) => onSetLabel(node.id, val)}
        onClear={() => onSetLabel(node.id, null)}
      />
    </>
  );
}

// === Reusable Text Field Input ===

interface TextFieldInputProps {
  label: string;
  value: string | null;
  maxLength: number;
  placeholder: string;
  onCommit: (value: string) => void;
  onClear: () => void;
}

function TextFieldInput({
  label,
  value,
  maxLength,
  placeholder,
  onCommit,
  onClear,
}: TextFieldInputProps) {
  const [localValue, setLocalValue] = useState(value ?? '');
  const inputRef = useRef<HTMLInputElement>(null);
  const isFocusedRef = useRef(false);

  // Sync local state when the external value changes (but not while user is typing)
  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalValue(value ?? '');
    }
  }, [value]);

  const handleBlur = useCallback(() => {
    isFocusedRef.current = false;
    const trimmed = localValue.trim();
    if (trimmed.length === 0) {
      if (value !== null) {
        onClear();
      }
      setLocalValue('');
    } else if (trimmed.length >= 1 && trimmed.length <= maxLength) {
      if (trimmed !== value) {
        onCommit(trimmed);
      }
    }
  }, [localValue, value, maxLength, onCommit, onClear]);

  const handleFocus = useCallback(() => {
    isFocusedRef.current = true;
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        (e.target as HTMLInputElement).blur();
      }
    },
    []
  );

  const handleClear = useCallback(() => {
    setLocalValue('');
    onClear();
  }, [onClear]);

  const inputId = `subnet-detail-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className={styles.section}>
      <label className={styles.sectionLabel} htmlFor={inputId}>
        {label}
      </label>
      <div className={styles.inputRow}>
        <input
          ref={inputRef}
          id={inputId}
          className={styles.textInput}
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-describedby={`${inputId}-hint`}
        />
        {value !== null && (
          <button
            className={styles.clearButton}
            onClick={handleClear}
            aria-label={`Clear ${label}`}
            title={`Clear ${label}`}
            type="button"
          >
            ×
          </button>
        )}
      </div>
      <span id={`${inputId}-hint`} hidden>
        1 to {maxLength} characters
      </span>
    </div>
  );
}

// === Utility ===

/**
 * Convert a 32-bit unsigned integer to dotted-decimal notation.
 */
function numberToIp(bits: number): string {
  const unsigned = bits >>> 0;
  return [
    (unsigned >>> 24) & 0xff,
    (unsigned >>> 16) & 0xff,
    (unsigned >>> 8) & 0xff,
    unsigned & 0xff,
  ].join('.');
}
