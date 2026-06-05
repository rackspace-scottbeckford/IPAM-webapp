import type { BrandingConfiguration } from '../core/types';

/**
 * Rackspace default branding configuration.
 * Used as fallback for any invalid or missing branding fields.
 */
export const RACKSPACE_DEFAULTS: BrandingConfiguration = {
  logoUrl: null,
  primaryColor: '#EB0000',
  secondaryColor: '#1A1A1A',
  title: 'Cloud IP Address Management Tool',
  faviconUrl: null,
};

/**
 * Validates a hex color string (6-digit format with # prefix).
 */
export function isValidHexColor(color: unknown): boolean {
  return typeof color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(color);
}

/**
 * Validates a branding title (string, 1–64 characters).
 */
export function isValidTitle(title: unknown): boolean {
  return typeof title === 'string' && title.length >= 1 && title.length <= 64;
}

/**
 * Validates a logo or favicon URL (must be a non-empty string or null).
 * Checks that the URL points to a supported image format.
 */
export function isValidLogoUrl(url: unknown): boolean {
  if (url === null) return true;
  if (typeof url !== 'string' || url.length === 0) return false;
  // Check for supported image formats: SVG, PNG, JPEG
  const lower = url.toLowerCase();
  return (
    lower.endsWith('.svg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg')
  );
}

/**
 * Validates a favicon URL (must be ICO or PNG format, or null).
 */
export function isValidFaviconUrl(url: unknown): boolean {
  if (url === null) return true;
  if (typeof url !== 'string' || url.length === 0) return false;
  const lower = url.toLowerCase();
  return lower.endsWith('.ico') || lower.endsWith('.png');
}

/**
 * Partial branding input that may come from JSON config or window global.
 */
interface RawBrandingInput {
  logoUrl?: unknown;
  primaryColor?: unknown;
  secondaryColor?: unknown;
  title?: unknown;
  faviconUrl?: unknown;
}

/**
 * Loads branding configuration from available sources.
 * Priority: window.__BRANDING_CONFIG__ > environment variables > defaults.
 * Invalid fields fall back to Rackspace defaults with console warnings.
 */
export function loadBrandingConfig(): BrandingConfiguration {
  const raw = getRawConfig();

  if (!raw) {
    return RACKSPACE_DEFAULTS;
  }

  return validateAndMerge(raw);
}

/**
 * Attempts to retrieve raw branding config from window global or env vars.
 */
function getRawConfig(): RawBrandingInput | null {
  // Try window.__BRANDING_CONFIG__ (injected at build time or runtime)
  if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).__BRANDING_CONFIG__) {
    const config = (window as unknown as Record<string, unknown>).__BRANDING_CONFIG__;
    if (typeof config === 'object' && config !== null) {
      return config as RawBrandingInput;
    }
  }

  // Try environment variables (Vite exposes them via import.meta.env)
  try {
    const env = (import.meta as unknown as Record<string, Record<string, string>>).env;
    if (env) {
      const hasAnyEnvVar =
        env.VITE_BRAND_LOGO_URL ||
        env.VITE_BRAND_PRIMARY_COLOR ||
        env.VITE_BRAND_SECONDARY_COLOR ||
        env.VITE_BRAND_TITLE ||
        env.VITE_BRAND_FAVICON_URL;

      if (hasAnyEnvVar) {
        return {
          logoUrl: env.VITE_BRAND_LOGO_URL || null,
          primaryColor: env.VITE_BRAND_PRIMARY_COLOR || undefined,
          secondaryColor: env.VITE_BRAND_SECONDARY_COLOR || undefined,
          title: env.VITE_BRAND_TITLE || undefined,
          faviconUrl: env.VITE_BRAND_FAVICON_URL || null,
        };
      }
    }
  } catch {
    // Environment variables not available
  }

  return null;
}

/**
 * Validates each field of raw branding input and merges with defaults.
 * Logs console warnings for invalid fields.
 */
export function validateAndMerge(raw: RawBrandingInput): BrandingConfiguration {
  let logoUrl: string | null = RACKSPACE_DEFAULTS.logoUrl;
  let primaryColor: string = RACKSPACE_DEFAULTS.primaryColor;
  let secondaryColor: string = RACKSPACE_DEFAULTS.secondaryColor;
  let title: string = RACKSPACE_DEFAULTS.title;
  let faviconUrl: string | null = RACKSPACE_DEFAULTS.faviconUrl;

  // Validate logoUrl
  if (raw.logoUrl !== undefined) {
    if (isValidLogoUrl(raw.logoUrl)) {
      logoUrl = raw.logoUrl as string | null;
    } else {
      console.warn('[Branding] Invalid logo URL, using default. Supported formats: SVG, PNG, JPEG.');
    }
  }

  // Validate primaryColor
  if (raw.primaryColor !== undefined) {
    if (isValidHexColor(raw.primaryColor)) {
      primaryColor = raw.primaryColor as string;
    } else {
      console.warn('[Branding] Invalid primary color, using default. Expected 6-digit hex (e.g., #EB0000).');
    }
  }

  // Validate secondaryColor
  if (raw.secondaryColor !== undefined) {
    if (isValidHexColor(raw.secondaryColor)) {
      secondaryColor = raw.secondaryColor as string;
    } else {
      console.warn('[Branding] Invalid secondary color, using default. Expected 6-digit hex (e.g., #1A1A1A).');
    }
  }

  // Validate title
  if (raw.title !== undefined) {
    if (isValidTitle(raw.title)) {
      title = raw.title as string;
    } else {
      console.warn('[Branding] Invalid title (must be 1–64 characters), using default.');
    }
  }

  // Validate faviconUrl
  if (raw.faviconUrl !== undefined) {
    if (isValidFaviconUrl(raw.faviconUrl)) {
      faviconUrl = raw.faviconUrl as string | null;
    } else {
      console.warn('[Branding] Invalid favicon URL, using default. Supported formats: ICO, PNG.');
    }
  }

  return { logoUrl, primaryColor, secondaryColor, title, faviconUrl };
}
