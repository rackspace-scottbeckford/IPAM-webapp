import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/app-store';
import { applyCloudAccent, clearCloudAccent } from './theme-engine';

/**
 * CSS class applied to the document root during theme transitions.
 * Enables 300ms transition on all cloud-accent-related CSS custom properties.
 */
const THEME_TRANSITION_CLASS = 'cloud-theme-transitioning';

/**
 * Duration of the cloud theme transition in milliseconds.
 * Requirement 12.4: theme transition within 300ms on cloud change.
 */
const TRANSITION_DURATION_MS = 300;

/**
 * Hook that applies cloud-specific accent colors to the document
 * whenever the selected cloud provider changes.
 *
 * - Applies the cloud accent color as a CSS custom property (--cloud-accent)
 * - Adds a transition class to enable smooth 300ms color transitions
 * - Removes the transition class after the transition completes
 *
 * Requirements: 12.2, 12.4, 12.6
 */
export function useCloudTheme(): void {
  const providerProfile = useAppStore((s) => s.providerProfile);
  const previousCloudRef = useRef<string | null>(null);

  useEffect(() => {
    if (!providerProfile) {
      clearCloudAccent();
      previousCloudRef.current = null;
      return;
    }

    const currentCloud = providerProfile.cloudId;
    const isCloudChange = previousCloudRef.current !== null && previousCloudRef.current !== currentCloud;

    if (isCloudChange) {
      // Enable transition for smooth theme change
      document.documentElement.classList.add(THEME_TRANSITION_CLASS);

      // Remove transition class after animation completes
      const timer = setTimeout(() => {
        document.documentElement.classList.remove(THEME_TRANSITION_CLASS);
      }, TRANSITION_DURATION_MS);

      applyCloudAccent(providerProfile.accentColor);
      previousCloudRef.current = currentCloud;

      return () => {
        clearTimeout(timer);
      };
    }

    // Initial application (no transition needed)
    applyCloudAccent(providerProfile.accentColor);
    previousCloudRef.current = currentCloud;
  }, [providerProfile]);
}
