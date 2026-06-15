import { useState } from 'react';
import { useAppStore } from '../../store/app-store';
import { useI18n } from '../../i18n';
import {
  calculateReverseCIDR,
  validateFitsInRoot,
  findAvailableLeaf,
  splitsNeeded,
} from '../../core/reverse-cidr-calculator';
import type { ReverseCIDRResult } from '../../core/reverse-cidr-calculator';
import styles from './CreateWorkload.module.css';

/**
 * Dialog state machine for the Create Workload flow.
 */
type DialogState =
  | { step: 'closed' }
  | { step: 'input' }
  | { step: 'confirm'; name: string; requestedIPs: number; result: ReverseCIDRResult }
  | { step: 'error'; message: string }
  | { step: 'success'; name: string; prefix: number };

/**
 * CreateWorkload component implementing Requirement 14.
 *
 * Provides a "Create Workload" button that opens a dialog asking how many IPs
 * are needed, calculates the smallest suitable CIDR prefix, and auto-allocates
 * a subnet in the tree.
 *
 * Requirements: 14.1–14.8
 */
export function CreateWorkload() {
  const [dialogState, setDialogState] = useState<DialogState>({ step: 'closed' });
  const [workloadName, setWorkloadName] = useState('');
  const [requiredIPs, setRequiredIPs] = useState('');

  const networkPlan = useAppStore((state) => state.networkPlan);
  const providerProfile = useAppStore((state) => state.providerProfile);
  const splitSubnet = useAppStore((state) => state.splitSubnet);
  const setWorkloadAccount = useAppStore((state) => state.setWorkloadAccount);
  const setLabel = useAppStore((state) => state.setLabel);
  const t = useI18n((s) => s.t);

  const canCreate = networkPlan !== null && providerProfile !== null;

  const handleOpen = () => {
    setWorkloadName('');
    setRequiredIPs('');
    setDialogState({ step: 'input' });
  };

  const handleClose = () => {
    setDialogState({ step: 'closed' });
  };

  const handleCalculate = () => {
    if (!networkPlan || !providerProfile) return;

    const name = workloadName.trim();
    if (name.length < 1 || name.length > 64) {
      setDialogState({ step: 'error', message: 'Workload name must be 1–64 characters.' });
      return;
    }

    const requestedIPs = parseInt(requiredIPs, 10);
    if (!Number.isFinite(requestedIPs) || requestedIPs < 1 || requestedIPs > 16777214) {
      setDialogState({
        step: 'error',
        message: 'Required IPs must be a positive integer between 1 and 16,777,214.',
      });
      return;
    }

    // Calculate the smallest suitable prefix
    const calcResult = calculateReverseCIDR(requestedIPs, providerProfile.reservedIPs);

    if ('type' in calcResult) {
      setDialogState({ step: 'error', message: calcResult.message });
      return;
    }

    // Check if it fits within the root CIDR
    const fitError = validateFitsInRoot(
      calcResult.suggestedPrefix,
      networkPlan.rootCIDR,
      providerProfile.reservedIPs,
      requestedIPs
    );

    if (fitError) {
      setDialogState({ step: 'error', message: fitError });
      return;
    }

    // Check if space is available in the tree
    const availableLeafId = findAvailableLeaf(networkPlan.tree, calcResult.suggestedPrefix);
    if (!availableLeafId) {
      setDialogState({
        step: 'error',
        message:
          'No contiguous address space available at the required size. Reorganize the plan or use a larger root CIDR block.',
      });
      return;
    }

    // Show confirmation
    setDialogState({
      step: 'confirm',
      name,
      requestedIPs,
      result: calcResult,
    });
  };

  const handleConfirm = () => {
    if (dialogState.step !== 'confirm') return;
    if (!networkPlan || !providerProfile) return;

    const { name, result } = dialogState;
    const targetPrefix = result.suggestedPrefix;

    // Find the available leaf again (state may have changed, but unlikely in this flow)
    let leafId = findAvailableLeaf(networkPlan.tree, targetPrefix);
    if (!leafId) {
      setDialogState({
        step: 'error',
        message: 'Space is no longer available. Please try again.',
      });
      return;
    }

    // Split down to the target prefix if needed
    // We need to get the current state fresh from the store for each split
    const currentPlan = useAppStore.getState().networkPlan;
    if (!currentPlan) return;

    const leafNode = findNodeInTree(currentPlan.tree, leafId);
    if (!leafNode) return;

    const numSplits = splitsNeeded(leafNode.cidr.prefixLength, targetPrefix);

    // Perform successive splits, always taking the first (left) child
    let currentNodeId = leafId;
    for (let i = 0; i < numSplits; i++) {
      splitSubnet(currentNodeId);
      // After split, the node now has children. The first child is our path.
      const updatedPlan = useAppStore.getState().networkPlan;
      if (!updatedPlan) break;
      const updatedNode = findNodeInTree(updatedPlan.tree, currentNodeId);
      if (!updatedNode || !updatedNode.children) break;
      currentNodeId = updatedNode.children[0].id;
    }

    // Assign the workload name as label and workload account
    setLabel(currentNodeId, name);
    setWorkloadAccount(currentNodeId, name);

    setDialogState({ step: 'success', name, prefix: targetPrefix });
  };

  return (
    <>
      <button
        type="button"
        className={styles.createButton}
        onClick={handleOpen}
        disabled={!canCreate}
        aria-label={t.createWorkload}
        title={!canCreate ? t.selectCloudFirst : t.createWorkload}
      >
        {t.createWorkload}
      </button>

      {dialogState.step !== 'closed' && (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={t.createWorkloadTitle}>
          <div className={styles.dialog}>
            {dialogState.step === 'input' && (
              <>
                <h2 className={styles.title}>{t.createWorkloadTitle}</h2>
                <p className={styles.description}>
                  {t.createWorkloadDescription}
                </p>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="workload-name">
                    {t.workloadName}
                  </label>
                  <input
                    id="workload-name"
                    type="text"
                    className={styles.input}
                    value={workloadName}
                    onChange={(e) => setWorkloadName(e.target.value)}
                    maxLength={64}
                    placeholder="e.g., Production API"
                    autoFocus
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="required-ips">
                    {t.requiredUsableIPs}
                  </label>
                  <input
                    id="required-ips"
                    type="number"
                    className={styles.input}
                    value={requiredIPs}
                    onChange={(e) => setRequiredIPs(e.target.value)}
                    min={1}
                    max={16777214}
                    placeholder="e.g., 40000"
                  />
                  {providerProfile && (
                    <span className={styles.hint}>
                      {providerProfile.displayName} {t.reservedPerSubnet.replace('{count}', String(providerProfile.reservedIPs))}
                    </span>
                  )}
                </div>

                <div className={styles.actions}>
                  <button type="button" className={styles.cancelButton} onClick={handleClose}>
                    {t.cancel}
                  </button>
                  <button type="button" className={styles.primaryButton} onClick={handleCalculate}>
                    {t.calculate}
                  </button>
                </div>
              </>
            )}

            {dialogState.step === 'confirm' && (
              <>
                <h2 className={styles.title}>{t.suggestedAllocation}</h2>

                <div className={styles.suggestion}>
                  <div className={styles.suggestionRow}>
                    <span className={styles.suggestionLabel}>{t.workloadName}:</span>
                    <span className={styles.suggestionValue}>{dialogState.name}</span>
                  </div>
                  <div className={styles.suggestionRow}>
                    <span className={styles.suggestionLabel}>{t.suggestedPrefix}:</span>
                    <span className={styles.suggestionValue}>/{dialogState.result.suggestedPrefix}</span>
                  </div>
                  <div className={styles.suggestionRow}>
                    <span className={styles.suggestionLabel}>{t.totalAddresses}:</span>
                    <span className={styles.suggestionValue}>
                      {dialogState.result.totalAddresses.toLocaleString()}
                    </span>
                  </div>
                  <div className={styles.suggestionRow}>
                    <span className={styles.suggestionLabel}>{t.usableAddresses}:</span>
                    <span className={styles.suggestionValue}>
                      {dialogState.result.usableAddresses.toLocaleString()}
                    </span>
                  </div>
                  <div className={styles.suggestionRow}>
                    <span className={styles.suggestionLabel}>{t.surplus}:</span>
                    <span className={styles.suggestionValue}>
                      +{dialogState.result.surplus.toLocaleString()} {t.extraUsableIPs}
                    </span>
                  </div>
                </div>

                <div className={styles.actions}>
                  <button type="button" className={styles.cancelButton} onClick={handleClose}>
                    {t.cancel}
                  </button>
                  <button type="button" className={styles.primaryButton} onClick={handleConfirm}>
                    {t.allocateSubnet}
                  </button>
                </div>
              </>
            )}

            {dialogState.step === 'error' && (
              <>
                <h2 className={styles.title}>{t.cannotCreateWorkload}</h2>
                <p className={styles.errorMessage}>{dialogState.message}</p>
                <div className={styles.actions}>
                  <button type="button" className={styles.cancelButton} onClick={handleClose}>
                    {t.close}
                  </button>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => setDialogState({ step: 'input' })}
                  >
                    {t.tryAgain}
                  </button>
                </div>
              </>
            )}

            {dialogState.step === 'success' && (
              <>
                <h2 className={styles.title}>{t.workloadCreated}</h2>
                <p className={styles.successMessage}>
                  {t.allocatedSubnetFor.replace('{prefix}', String(dialogState.prefix)).replace('{name}', dialogState.name)}
                </p>
                <div className={styles.actions}>
                  <button type="button" className={styles.primaryButton} onClick={handleClose}>
                    {t.done}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Helper to find a node in the tree by ID. Uses simple recursive search.
 */
function findNodeInTree(tree: import('../../core/types').SubnetNode, id: string): import('../../core/types').SubnetNode | null {
  if (tree.id === id) return tree;
  if (tree.children === null) return null;
  return findNodeInTree(tree.children[0], id) ?? findNodeInTree(tree.children[1], id);
}
