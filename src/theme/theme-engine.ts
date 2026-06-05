import type { BrandingConfiguration } from '../core/types';

/**
 * CSS custom property names used by the theme engine.
 */
export const CSS_VARS = {
  // Brand colors (from BrandingConfiguration)
  BRAND_PRIMARY: '--brand-primary',
  BRAND_SECONDARY: '--brand-secondary',

  // Cloud accent color (tertiary, applied only to cloud-context elements)
  CLOUD_ACCENT: '--cloud-accent',

  // Derived properties for specific UI elements
  HEADER_BG: '--header-bg',
  BUTTON_PRIMARY_BG: '--button-primary-bg',
  ACTIVE_NAV: '--active-nav',
  HOVER_STATE: '--hover-state',
  BORDER_ACCENT: '--border-accent',
  ACCENT_HIGHLIGHT: '--accent-highlight',
} as const;

/**
 * Applies the brand theme to the document by setting CSS custom properties.
 * 
 * Primary color is applied to:
 * - Application header background
 * - Primary action buttons
 * - Active navigation elements
 * 
 * Secondary color is applied to:
 * - Hover states
 * - Borders
 * - Accent highlights
 * 
 * @param branding - The validated branding configuration to apply
 */
export function applyBrandTheme(branding: BrandingConfiguration): void {
  const root = document.documentElement;

  // Set brand primary color and its derived usages
  root.style.setProperty(CSS_VARS.BRAND_PRIMARY, branding.primaryColor);
  root.style.setProperty(CSS_VARS.HEADER_BG, branding.primaryColor);
  root.style.setProperty(CSS_VARS.BUTTON_PRIMARY_BG, branding.primaryColor);
  root.style.setProperty(CSS_VARS.ACTIVE_NAV, branding.primaryColor);

  // Set brand secondary color and its derived usages
  root.style.setProperty(CSS_VARS.BRAND_SECONDARY, branding.secondaryColor);
  root.style.setProperty(CSS_VARS.HOVER_STATE, branding.secondaryColor);
  root.style.setProperty(CSS_VARS.BORDER_ACCENT, branding.secondaryColor);
  root.style.setProperty(CSS_VARS.ACCENT_HIGHLIGHT, branding.secondaryColor);

  // Set document title
  if (branding.title) {
    document.title = branding.title;
  }

  // Set favicon if provided
  if (branding.faviconUrl) {
    setFavicon(branding.faviconUrl);
  }
}

/**
 * Applies a cloud-specific accent color as a tertiary color.
 * This color is used ONLY on cloud-context elements:
 * - Provider icon backgrounds
 * - Tag color coding
 * - Subnet visualization borders
 * 
 * Cloud accent colors do NOT override brand primary/secondary colors.
 * 
 * @param accentColor - The cloud provider's accent color (hex)
 */
export function applyCloudAccent(accentColor: string): void {
  const root = document.documentElement;
  root.style.setProperty(CSS_VARS.CLOUD_ACCENT, accentColor);
}

/**
 * Removes the cloud accent color (e.g., when no cloud is selected).
 */
export function clearCloudAccent(): void {
  const root = document.documentElement;
  root.style.removeProperty(CSS_VARS.CLOUD_ACCENT);
}

/**
 * Sets the document favicon to the specified URL.
 */
function setFavicon(url: string): void {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = url;
}

/**
 * Retrieves the current value of a CSS custom property from the document root.
 * Useful for testing and debugging.
 */
export function getCSSVar(varName: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}
