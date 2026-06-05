import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/app-store';
import { showToast } from '../components/Toast/Toast';

/**
 * Hook that synchronizes the NetworkPlan state with the URL hash.
 *
 * On mount:
 * - Calls loadFromURL() to restore state from the URL hash
 * - If loadFromURL returns a SerializationError, shows an error toast and falls back to empty state
 *
 * On state changes:
 * - Subscribes to store changes and calls syncToURL() whenever the networkPlan changes
 */
export function useURLSync(): void {
  const hasInitialized = useRef(false);

  // Load from URL on mount (once)
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const error = useAppStore.getState().loadFromURL();
    if (error) {
      showToast(
        'error',
        'Could not load plan from URL',
        error.message
      );
    }
  }, []);

  // Subscribe to networkPlan changes and sync to URL
  useEffect(() => {
    const unsubscribe = useAppStore.subscribe(
      (state, prevState) => {
        // Only sync when networkPlan reference changes
        if (state.networkPlan !== prevState.networkPlan) {
          state.syncToURL();
        }
      }
    );

    return unsubscribe;
  }, []);
}
