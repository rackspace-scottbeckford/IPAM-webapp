// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { applyBrandTheme, applyCloudAccent, clearCloudAccent, CSS_VARS } from './theme-engine';
import type { BrandingConfiguration } from '../core/types';

describe('theme-engine', () => {
  beforeEach(() => {
    // Reset all CSS custom properties before each test
    const root = document.documentElement;
    Object.values(CSS_VARS).forEach((varName) => {
      root.style.removeProperty(varName);
    });
    document.title = '';
    // Remove any favicon link elements from previous tests
    const existingFavicon = document.querySelector('link[rel="icon"]');
    if (existingFavicon) {
      existingFavicon.remove();
    }
  });

  describe('applyBrandTheme', () => {
    const testBranding: BrandingConfiguration = {
      logoUrl: '/test-logo.svg',
      primaryColor: '#FF0000',
      secondaryColor: '#00FF00',
      title: 'Test IPAM App',
      faviconUrl: '/test-favicon.ico',
    };

    it('sets brand primary CSS custom property', () => {
      applyBrandTheme(testBranding);
      const root = document.documentElement;
      expect(root.style.getPropertyValue(CSS_VARS.BRAND_PRIMARY)).toBe('#FF0000');
    });

    it('sets brand secondary CSS custom property', () => {
      applyBrandTheme(testBranding);
      const root = document.documentElement;
      expect(root.style.getPropertyValue(CSS_VARS.BRAND_SECONDARY)).toBe('#00FF00');
    });

    it('applies primary color to header background', () => {
      applyBrandTheme(testBranding);
      const root = document.documentElement;
      expect(root.style.getPropertyValue(CSS_VARS.HEADER_BG)).toBe('#FF0000');
    });

    it('applies primary color to primary button background', () => {
      applyBrandTheme(testBranding);
      const root = document.documentElement;
      expect(root.style.getPropertyValue(CSS_VARS.BUTTON_PRIMARY_BG)).toBe('#FF0000');
    });

    it('applies primary color to active nav', () => {
      applyBrandTheme(testBranding);
      const root = document.documentElement;
      expect(root.style.getPropertyValue(CSS_VARS.ACTIVE_NAV)).toBe('#FF0000');
    });

    it('applies secondary color to hover state', () => {
      applyBrandTheme(testBranding);
      const root = document.documentElement;
      expect(root.style.getPropertyValue(CSS_VARS.HOVER_STATE)).toBe('#00FF00');
    });

    it('applies secondary color to border accent', () => {
      applyBrandTheme(testBranding);
      const root = document.documentElement;
      expect(root.style.getPropertyValue(CSS_VARS.BORDER_ACCENT)).toBe('#00FF00');
    });

    it('applies secondary color to accent highlight', () => {
      applyBrandTheme(testBranding);
      const root = document.documentElement;
      expect(root.style.getPropertyValue(CSS_VARS.ACCENT_HIGHLIGHT)).toBe('#00FF00');
    });

    it('sets the document title', () => {
      applyBrandTheme(testBranding);
      expect(document.title).toBe('Test IPAM App');
    });

    it('sets the favicon link element', () => {
      applyBrandTheme(testBranding);
      const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      expect(link).not.toBeNull();
      expect(link!.href).toContain('test-favicon.ico');
    });

    it('does not set favicon when faviconUrl is null', () => {
      const brandingNoFavicon: BrandingConfiguration = {
        ...testBranding,
        faviconUrl: null,
      };
      applyBrandTheme(brandingNoFavicon);
      // No favicon link should be added (unless one already existed)
      const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      // If no link existed before, it should still not exist
      expect(link).toBeNull();
    });
  });

  describe('applyCloudAccent', () => {
    it('sets the cloud accent CSS custom property', () => {
      applyCloudAccent('#FF9900');
      const root = document.documentElement;
      expect(root.style.getPropertyValue(CSS_VARS.CLOUD_ACCENT)).toBe('#FF9900');
    });

    it('can be updated to a different accent color', () => {
      applyCloudAccent('#FF9900');
      applyCloudAccent('#0078D4');
      const root = document.documentElement;
      expect(root.style.getPropertyValue(CSS_VARS.CLOUD_ACCENT)).toBe('#0078D4');
    });

    it('does not affect brand primary or secondary colors', () => {
      const branding: BrandingConfiguration = {
        logoUrl: null,
        primaryColor: '#EB0000',
        secondaryColor: '#1A1A1A',
        title: 'Test',
        faviconUrl: null,
      };
      applyBrandTheme(branding);
      applyCloudAccent('#FF9900');

      const root = document.documentElement;
      // Brand colors should remain unchanged
      expect(root.style.getPropertyValue(CSS_VARS.BRAND_PRIMARY)).toBe('#EB0000');
      expect(root.style.getPropertyValue(CSS_VARS.BRAND_SECONDARY)).toBe('#1A1A1A');
      expect(root.style.getPropertyValue(CSS_VARS.HEADER_BG)).toBe('#EB0000');
      expect(root.style.getPropertyValue(CSS_VARS.BUTTON_PRIMARY_BG)).toBe('#EB0000');
      // Cloud accent is separate
      expect(root.style.getPropertyValue(CSS_VARS.CLOUD_ACCENT)).toBe('#FF9900');
    });
  });

  describe('clearCloudAccent', () => {
    it('removes the cloud accent CSS custom property', () => {
      applyCloudAccent('#FF9900');
      clearCloudAccent();
      const root = document.documentElement;
      expect(root.style.getPropertyValue(CSS_VARS.CLOUD_ACCENT)).toBe('');
    });
  });
});
