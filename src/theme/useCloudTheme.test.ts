// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { applyCloudAccent, clearCloudAccent, CSS_VARS } from './theme-engine';

describe('Cloud Visual Theming', () => {
  beforeEach(() => {
    // Reset CSS custom properties
    document.documentElement.style.removeProperty(CSS_VARS.CLOUD_ACCENT);
    document.documentElement.classList.remove('cloud-theme-transitioning');
  });

  afterEach(() => {
    document.documentElement.style.removeProperty(CSS_VARS.CLOUD_ACCENT);
    document.documentElement.classList.remove('cloud-theme-transitioning');
  });

  describe('applyCloudAccent', () => {
    it('sets the --cloud-accent CSS variable for AWS orange', () => {
      applyCloudAccent('#FF9900');
      expect(document.documentElement.style.getPropertyValue(CSS_VARS.CLOUD_ACCENT)).toBe('#FF9900');
    });

    it('sets the --cloud-accent CSS variable for Azure blue', () => {
      applyCloudAccent('#0078D4');
      expect(document.documentElement.style.getPropertyValue(CSS_VARS.CLOUD_ACCENT)).toBe('#0078D4');
    });

    it('sets the --cloud-accent CSS variable for GCP blue', () => {
      applyCloudAccent('#4285F4');
      expect(document.documentElement.style.getPropertyValue(CSS_VARS.CLOUD_ACCENT)).toBe('#4285F4');
    });

    it('sets the --cloud-accent CSS variable for Private Cloud gray', () => {
      applyCloudAccent('#6B7280');
      expect(document.documentElement.style.getPropertyValue(CSS_VARS.CLOUD_ACCENT)).toBe('#6B7280');
    });
  });

  describe('clearCloudAccent', () => {
    it('removes the --cloud-accent CSS variable', () => {
      applyCloudAccent('#FF9900');
      clearCloudAccent();
      expect(document.documentElement.style.getPropertyValue(CSS_VARS.CLOUD_ACCENT)).toBe('');
    });
  });

  describe('theme transition class', () => {
    it('can be added and removed from document root', () => {
      document.documentElement.classList.add('cloud-theme-transitioning');
      expect(document.documentElement.classList.contains('cloud-theme-transitioning')).toBe(true);

      document.documentElement.classList.remove('cloud-theme-transitioning');
      expect(document.documentElement.classList.contains('cloud-theme-transitioning')).toBe(false);
    });
  });
});
