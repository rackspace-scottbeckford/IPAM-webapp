// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { validateAndMerge, RACKSPACE_DEFAULTS } from './branding-config';
import { applyBrandTheme, applyCloudAccent, CSS_VARS } from './theme-engine';
import type { BrandingConfiguration, TargetCloud } from '../core/types';

/**
 * Feature: cloud-ipam-webapp, Property 25: Branding fallback for invalid configuration
 *
 * For any BrandingConfiguration where one or more fields contain invalid values
 * (malformed hex color, title exceeding 64 characters, unsupported image format),
 * the system SHALL use the Rackspace default value for each invalid field while
 * applying valid fields normally.
 *
 * **Validates: Requirements 11.8**
 */
describe('Property 25: Branding fallback for invalid configuration', () => {
  // --- Generators ---

  /** Valid hex color: # followed by exactly 6 hex digits */
  const validHexColorArb = fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => `#${s}`);

  /** Invalid hex color: various malformed formats */
  const invalidHexColorArb = fc.oneof(
    // Missing # prefix
    fc.hexaString({ minLength: 6, maxLength: 6 }),
    // Too short
    fc.hexaString({ minLength: 1, maxLength: 5 }).map(s => `#${s}`),
    // Too long
    fc.hexaString({ minLength: 7, maxLength: 10 }).map(s => `#${s}`),
    // Non-hex characters
    fc.stringOf(fc.constantFrom('g', 'h', 'z', 'x', '!', '@'), { minLength: 6, maxLength: 6 }).map(s => `#${s}`),
    // Empty string
    fc.constant(''),
    // Number instead of string
    fc.integer() as fc.Arbitrary<unknown>,
    // Null
    fc.constant(null) as fc.Arbitrary<unknown>,
  ) as fc.Arbitrary<unknown>;

  /** Valid title: 1–64 characters */
  const validTitleArb = fc.string({ minLength: 1, maxLength: 64 }).filter(s => s.length >= 1);

  /** Invalid title: exceeds 64 characters or empty */
  const invalidTitleArb = fc.oneof(
    fc.string({ minLength: 65, maxLength: 200 }),
    fc.constant(''),
    fc.integer() as fc.Arbitrary<unknown>,
    fc.constant(null) as fc.Arbitrary<unknown>,
  ) as fc.Arbitrary<unknown>;

  /** Valid logo URL: ends with supported format */
  const validLogoUrlArb = fc.oneof(
    fc.webUrl().map(u => `${u}/logo.svg`),
    fc.webUrl().map(u => `${u}/logo.png`),
    fc.webUrl().map(u => `${u}/logo.jpg`),
    fc.webUrl().map(u => `${u}/logo.jpeg`),
    fc.constant(null),
  );

  /** Invalid logo URL: unsupported format */
  const invalidLogoUrlArb = fc.oneof(
    fc.webUrl().map(u => `${u}/logo.gif`),
    fc.webUrl().map(u => `${u}/logo.bmp`),
    fc.webUrl().map(u => `${u}/logo.webp`),
    fc.constant(''),
    fc.integer() as fc.Arbitrary<unknown>,
  ) as fc.Arbitrary<unknown>;

  /** Valid favicon URL: ICO or PNG */
  const validFaviconUrlArb = fc.oneof(
    fc.webUrl().map(u => `${u}/favicon.ico`),
    fc.webUrl().map(u => `${u}/favicon.png`),
    fc.constant(null),
  );

  /** Invalid favicon URL: unsupported format */
  const invalidFaviconUrlArb = fc.oneof(
    fc.webUrl().map(u => `${u}/favicon.svg`),
    fc.webUrl().map(u => `${u}/favicon.gif`),
    fc.constant(''),
    fc.integer() as fc.Arbitrary<unknown>,
  ) as fc.Arbitrary<unknown>;

  // --- Property Tests ---

  it('invalid primaryColor falls back to Rackspace default while valid fields are applied', () => {
    fc.assert(
      fc.property(
        invalidHexColorArb,
        validHexColorArb,
        validTitleArb,
        (invalidPrimary, validSecondary, validTitle) => {
          const result = validateAndMerge({
            primaryColor: invalidPrimary,
            secondaryColor: validSecondary,
            title: validTitle,
          });

          // Invalid primary should fall back to default
          expect(result.primaryColor).toBe(RACKSPACE_DEFAULTS.primaryColor);
          // Valid fields should be applied
          expect(result.secondaryColor).toBe(validSecondary);
          expect(result.title).toBe(validTitle);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('invalid secondaryColor falls back to Rackspace default while valid fields are applied', () => {
    fc.assert(
      fc.property(
        validHexColorArb,
        invalidHexColorArb,
        validTitleArb,
        (validPrimary, invalidSecondary, validTitle) => {
          const result = validateAndMerge({
            primaryColor: validPrimary,
            secondaryColor: invalidSecondary,
            title: validTitle,
          });

          // Valid primary should be applied
          expect(result.primaryColor).toBe(validPrimary);
          // Invalid secondary should fall back to default
          expect(result.secondaryColor).toBe(RACKSPACE_DEFAULTS.secondaryColor);
          // Valid title should be applied
          expect(result.title).toBe(validTitle);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('invalid title falls back to Rackspace default while valid fields are applied', () => {
    fc.assert(
      fc.property(
        validHexColorArb,
        validHexColorArb,
        invalidTitleArb,
        (validPrimary, validSecondary, invalidTitle) => {
          const result = validateAndMerge({
            primaryColor: validPrimary,
            secondaryColor: validSecondary,
            title: invalidTitle,
          });

          // Valid colors should be applied
          expect(result.primaryColor).toBe(validPrimary);
          expect(result.secondaryColor).toBe(validSecondary);
          // Invalid title should fall back to default
          expect(result.title).toBe(RACKSPACE_DEFAULTS.title);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('invalid logoUrl falls back to Rackspace default while valid fields are applied', () => {
    fc.assert(
      fc.property(
        invalidLogoUrlArb,
        validHexColorArb,
        validHexColorArb,
        (invalidLogo, validPrimary, validSecondary) => {
          const result = validateAndMerge({
            logoUrl: invalidLogo,
            primaryColor: validPrimary,
            secondaryColor: validSecondary,
          });

          // Invalid logo should fall back to default
          expect(result.logoUrl).toBe(RACKSPACE_DEFAULTS.logoUrl);
          // Valid colors should be applied
          expect(result.primaryColor).toBe(validPrimary);
          expect(result.secondaryColor).toBe(validSecondary);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('invalid faviconUrl falls back to Rackspace default while valid fields are applied', () => {
    fc.assert(
      fc.property(
        invalidFaviconUrlArb,
        validHexColorArb,
        validTitleArb,
        (invalidFavicon, validPrimary, validTitle) => {
          const result = validateAndMerge({
            faviconUrl: invalidFavicon,
            primaryColor: validPrimary,
            title: validTitle,
          });

          // Invalid favicon should fall back to default
          expect(result.faviconUrl).toBe(RACKSPACE_DEFAULTS.faviconUrl);
          // Valid fields should be applied
          expect(result.primaryColor).toBe(validPrimary);
          expect(result.title).toBe(validTitle);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all valid fields are applied without any fallback', () => {
    fc.assert(
      fc.property(
        validHexColorArb,
        validHexColorArb,
        validTitleArb,
        validLogoUrlArb,
        validFaviconUrlArb,
        (primary, secondary, title, logo, favicon) => {
          const result = validateAndMerge({
            primaryColor: primary,
            secondaryColor: secondary,
            title: title,
            logoUrl: logo,
            faviconUrl: favicon,
          });

          expect(result.primaryColor).toBe(primary);
          expect(result.secondaryColor).toBe(secondary);
          expect(result.title).toBe(title);
          expect(result.logoUrl).toBe(logo);
          expect(result.faviconUrl).toBe(favicon);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('multiple invalid fields each independently fall back to their respective defaults', () => {
    fc.assert(
      fc.property(
        invalidHexColorArb,
        invalidHexColorArb,
        invalidTitleArb,
        invalidLogoUrlArb,
        invalidFaviconUrlArb,
        (invalidPrimary, invalidSecondary, invalidTitle, invalidLogo, invalidFavicon) => {
          const result = validateAndMerge({
            primaryColor: invalidPrimary,
            secondaryColor: invalidSecondary,
            title: invalidTitle,
            logoUrl: invalidLogo,
            faviconUrl: invalidFavicon,
          });

          // All fields should fall back to Rackspace defaults
          expect(result.primaryColor).toBe(RACKSPACE_DEFAULTS.primaryColor);
          expect(result.secondaryColor).toBe(RACKSPACE_DEFAULTS.secondaryColor);
          expect(result.title).toBe(RACKSPACE_DEFAULTS.title);
          expect(result.logoUrl).toBe(RACKSPACE_DEFAULTS.logoUrl);
          expect(result.faviconUrl).toBe(RACKSPACE_DEFAULTS.faviconUrl);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: cloud-ipam-webapp, Property 26: Cloud accent colors do not override brand colors
 *
 * For any combination of BrandingConfiguration and Target_Cloud selection, the
 * application header background and primary action buttons SHALL use the brand
 * primary color (not the cloud accent color), and cloud accent colors SHALL only
 * be applied to cloud-context elements (provider icon backgrounds, tag color coding,
 * subnet visualization borders).
 *
 * **Validates: Requirements 12.6**
 */
describe('Property 26: Cloud accent colors do not override brand colors', () => {
  // --- Setup ---

  beforeEach(() => {
    // Reset all CSS custom properties before each test
    const root = document.documentElement;
    Object.values(CSS_VARS).forEach(varName => {
      root.style.removeProperty(varName);
    });
  });

  // --- Generators ---

  const validHexColorArb = fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => `#${s}`);

  const brandingConfigArb: fc.Arbitrary<BrandingConfiguration> = fc.record({
    logoUrl: fc.constant(null),
    primaryColor: validHexColorArb,
    secondaryColor: validHexColorArb,
    title: fc.string({ minLength: 1, maxLength: 64 }).filter(s => s.length >= 1),
    faviconUrl: fc.constant(null),
  });

  /** Cloud accent colors from the design doc */
  const cloudAccentColors: Record<TargetCloud, string> = {
    aws: '#FF9900',
    azure: '#0078D4',
    gcp: '#4285F4',
    stackit: '#1A5C5C',
    private: '#6B7280',
  };

  const targetCloudArb = fc.constantFrom<TargetCloud>('aws', 'azure', 'gcp', 'stackit', 'private');

  // --- Property Tests ---

  it('after applying brand theme then cloud accent, header background uses brand primary color', () => {
    fc.assert(
      fc.property(brandingConfigArb, targetCloudArb, (branding, cloud) => {
        const accentColor = cloudAccentColors[cloud];

        // Apply brand theme first
        applyBrandTheme(branding);
        // Then apply cloud accent
        applyCloudAccent(accentColor);

        // Header background should still be the brand primary color
        const root = document.documentElement;
        const headerBg = root.style.getPropertyValue(CSS_VARS.HEADER_BG);
        expect(headerBg).toBe(branding.primaryColor);
      }),
      { numRuns: 100 }
    );
  });

  it('after applying brand theme then cloud accent, primary button background uses brand primary color', () => {
    fc.assert(
      fc.property(brandingConfigArb, targetCloudArb, (branding, cloud) => {
        const accentColor = cloudAccentColors[cloud];

        applyBrandTheme(branding);
        applyCloudAccent(accentColor);

        const root = document.documentElement;
        const buttonBg = root.style.getPropertyValue(CSS_VARS.BUTTON_PRIMARY_BG);
        expect(buttonBg).toBe(branding.primaryColor);
      }),
      { numRuns: 100 }
    );
  });

  it('after applying brand theme then cloud accent, active nav uses brand primary color', () => {
    fc.assert(
      fc.property(brandingConfigArb, targetCloudArb, (branding, cloud) => {
        const accentColor = cloudAccentColors[cloud];

        applyBrandTheme(branding);
        applyCloudAccent(accentColor);

        const root = document.documentElement;
        const activeNav = root.style.getPropertyValue(CSS_VARS.ACTIVE_NAV);
        expect(activeNav).toBe(branding.primaryColor);
      }),
      { numRuns: 100 }
    );
  });

  it('after applying brand theme then cloud accent, secondary elements use brand secondary color', () => {
    fc.assert(
      fc.property(brandingConfigArb, targetCloudArb, (branding, cloud) => {
        const accentColor = cloudAccentColors[cloud];

        applyBrandTheme(branding);
        applyCloudAccent(accentColor);

        const root = document.documentElement;
        const hoverState = root.style.getPropertyValue(CSS_VARS.HOVER_STATE);
        const borderAccent = root.style.getPropertyValue(CSS_VARS.BORDER_ACCENT);
        const accentHighlight = root.style.getPropertyValue(CSS_VARS.ACCENT_HIGHLIGHT);

        expect(hoverState).toBe(branding.secondaryColor);
        expect(borderAccent).toBe(branding.secondaryColor);
        expect(accentHighlight).toBe(branding.secondaryColor);
      }),
      { numRuns: 100 }
    );
  });

  it('cloud accent color is applied only to the cloud accent CSS variable', () => {
    fc.assert(
      fc.property(brandingConfigArb, targetCloudArb, (branding, cloud) => {
        const accentColor = cloudAccentColors[cloud];

        applyBrandTheme(branding);
        applyCloudAccent(accentColor);

        const root = document.documentElement;

        // Cloud accent should be set to the cloud's accent color
        const cloudAccentValue = root.style.getPropertyValue(CSS_VARS.CLOUD_ACCENT);
        expect(cloudAccentValue).toBe(accentColor);

        // Brand vars should NOT be the cloud accent color (unless they happen to match)
        const headerBg = root.style.getPropertyValue(CSS_VARS.HEADER_BG);
        const buttonBg = root.style.getPropertyValue(CSS_VARS.BUTTON_PRIMARY_BG);

        // These should be the brand primary, not the cloud accent
        expect(headerBg).toBe(branding.primaryColor);
        expect(buttonBg).toBe(branding.primaryColor);
      }),
      { numRuns: 100 }
    );
  });

  it('applying cloud accent after brand theme does not modify any brand CSS variables', () => {
    fc.assert(
      fc.property(brandingConfigArb, targetCloudArb, (branding, cloud) => {
        const accentColor = cloudAccentColors[cloud];

        // Apply brand theme
        applyBrandTheme(branding);

        // Capture brand CSS var values
        const root = document.documentElement;
        const brandPrimaryBefore = root.style.getPropertyValue(CSS_VARS.BRAND_PRIMARY);
        const brandSecondaryBefore = root.style.getPropertyValue(CSS_VARS.BRAND_SECONDARY);
        const headerBgBefore = root.style.getPropertyValue(CSS_VARS.HEADER_BG);
        const buttonBgBefore = root.style.getPropertyValue(CSS_VARS.BUTTON_PRIMARY_BG);
        const activeNavBefore = root.style.getPropertyValue(CSS_VARS.ACTIVE_NAV);
        const hoverBefore = root.style.getPropertyValue(CSS_VARS.HOVER_STATE);
        const borderBefore = root.style.getPropertyValue(CSS_VARS.BORDER_ACCENT);
        const highlightBefore = root.style.getPropertyValue(CSS_VARS.ACCENT_HIGHLIGHT);

        // Apply cloud accent
        applyCloudAccent(accentColor);

        // All brand CSS vars should remain unchanged
        expect(root.style.getPropertyValue(CSS_VARS.BRAND_PRIMARY)).toBe(brandPrimaryBefore);
        expect(root.style.getPropertyValue(CSS_VARS.BRAND_SECONDARY)).toBe(brandSecondaryBefore);
        expect(root.style.getPropertyValue(CSS_VARS.HEADER_BG)).toBe(headerBgBefore);
        expect(root.style.getPropertyValue(CSS_VARS.BUTTON_PRIMARY_BG)).toBe(buttonBgBefore);
        expect(root.style.getPropertyValue(CSS_VARS.ACTIVE_NAV)).toBe(activeNavBefore);
        expect(root.style.getPropertyValue(CSS_VARS.HOVER_STATE)).toBe(hoverBefore);
        expect(root.style.getPropertyValue(CSS_VARS.BORDER_ACCENT)).toBe(borderBefore);
        expect(root.style.getPropertyValue(CSS_VARS.ACCENT_HIGHLIGHT)).toBe(highlightBefore);
      }),
      { numRuns: 100 }
    );
  });
});
