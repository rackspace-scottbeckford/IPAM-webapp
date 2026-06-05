// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadBrandingConfig,
  validateAndMerge,
  isValidHexColor,
  isValidTitle,
  isValidLogoUrl,
  isValidFaviconUrl,
  RACKSPACE_DEFAULTS,
} from './branding-config';

describe('branding-config', () => {
  beforeEach(() => {
    // Clean up window.__BRANDING_CONFIG__ between tests
    delete (window as unknown as Record<string, unknown>).__BRANDING_CONFIG__;
  });

  describe('RACKSPACE_DEFAULTS', () => {
    it('has correct default values', () => {
      expect(RACKSPACE_DEFAULTS.logoUrl).toBeNull();
      expect(RACKSPACE_DEFAULTS.primaryColor).toBe('#EB0000');
      expect(RACKSPACE_DEFAULTS.secondaryColor).toBe('#1A1A1A');
      expect(RACKSPACE_DEFAULTS.title).toBe('Cloud IPAM Planner');
      expect(RACKSPACE_DEFAULTS.faviconUrl).toBeNull();
    });
  });

  describe('isValidHexColor', () => {
    it('accepts valid 6-digit hex colors', () => {
      expect(isValidHexColor('#EB0000')).toBe(true);
      expect(isValidHexColor('#000000')).toBe(true);
      expect(isValidHexColor('#FFFFFF')).toBe(true);
      expect(isValidHexColor('#ff9900')).toBe(true);
      expect(isValidHexColor('#aAbBcC')).toBe(true);
    });

    it('rejects invalid hex colors', () => {
      expect(isValidHexColor('#FFF')).toBe(false); // 3-digit
      expect(isValidHexColor('C40022')).toBe(false); // missing #
      expect(isValidHexColor('#GGGGGG')).toBe(false); // invalid chars
      expect(isValidHexColor('#12345')).toBe(false); // 5 digits
      expect(isValidHexColor('#1234567')).toBe(false); // 7 digits
      expect(isValidHexColor('')).toBe(false);
      expect(isValidHexColor(null)).toBe(false);
      expect(isValidHexColor(undefined)).toBe(false);
      expect(isValidHexColor(123)).toBe(false);
    });
  });

  describe('isValidTitle', () => {
    it('accepts valid titles (1–64 characters)', () => {
      expect(isValidTitle('A')).toBe(true);
      expect(isValidTitle('Cloud IPAM Planner')).toBe(true);
      expect(isValidTitle('x'.repeat(64))).toBe(true);
    });

    it('rejects invalid titles', () => {
      expect(isValidTitle('')).toBe(false); // empty
      expect(isValidTitle('x'.repeat(65))).toBe(false); // too long
      expect(isValidTitle(null)).toBe(false);
      expect(isValidTitle(undefined)).toBe(false);
      expect(isValidTitle(123)).toBe(false);
    });
  });

  describe('isValidLogoUrl', () => {
    it('accepts null (no logo)', () => {
      expect(isValidLogoUrl(null)).toBe(true);
    });

    it('accepts supported image formats', () => {
      expect(isValidLogoUrl('/assets/logo.svg')).toBe(true);
      expect(isValidLogoUrl('/assets/logo.png')).toBe(true);
      expect(isValidLogoUrl('/assets/logo.jpg')).toBe(true);
      expect(isValidLogoUrl('/assets/logo.jpeg')).toBe(true);
      expect(isValidLogoUrl('https://example.com/logo.SVG')).toBe(true);
    });

    it('rejects unsupported formats', () => {
      expect(isValidLogoUrl('/assets/logo.gif')).toBe(false);
      expect(isValidLogoUrl('/assets/logo.bmp')).toBe(false);
      expect(isValidLogoUrl('/assets/logo.webp')).toBe(false);
      expect(isValidLogoUrl('')).toBe(false);
    });
  });

  describe('isValidFaviconUrl', () => {
    it('accepts null (no favicon)', () => {
      expect(isValidFaviconUrl(null)).toBe(true);
    });

    it('accepts ICO and PNG formats', () => {
      expect(isValidFaviconUrl('/favicon.ico')).toBe(true);
      expect(isValidFaviconUrl('/favicon.png')).toBe(true);
    });

    it('rejects unsupported formats', () => {
      expect(isValidFaviconUrl('/favicon.svg')).toBe(false);
      expect(isValidFaviconUrl('/favicon.jpg')).toBe(false);
      expect(isValidFaviconUrl('')).toBe(false);
    });
  });

  describe('loadBrandingConfig', () => {
    it('returns Rackspace defaults when no config is provided', () => {
      const config = loadBrandingConfig();
      expect(config).toEqual(RACKSPACE_DEFAULTS);
    });

    it('loads config from window.__BRANDING_CONFIG__', () => {
      (window as unknown as Record<string, unknown>).__BRANDING_CONFIG__ = {
        logoUrl: '/custom-logo.svg',
        primaryColor: '#336699',
        secondaryColor: '#445566',
        title: 'Custom IPAM',
        faviconUrl: '/custom-favicon.ico',
      };

      const config = loadBrandingConfig();
      expect(config.logoUrl).toBe('/custom-logo.svg');
      expect(config.primaryColor).toBe('#336699');
      expect(config.secondaryColor).toBe('#445566');
      expect(config.title).toBe('Custom IPAM');
      expect(config.faviconUrl).toBe('/custom-favicon.ico');
    });
  });

  describe('validateAndMerge', () => {
    it('returns defaults for empty input', () => {
      const result = validateAndMerge({});
      expect(result).toEqual(RACKSPACE_DEFAULTS);
    });

    it('applies valid fields and keeps defaults for missing fields', () => {
      const result = validateAndMerge({
        primaryColor: '#112233',
      });
      expect(result.primaryColor).toBe('#112233');
      expect(result.secondaryColor).toBe(RACKSPACE_DEFAULTS.secondaryColor);
      expect(result.title).toBe(RACKSPACE_DEFAULTS.title);
    });

    it('falls back to default for invalid primaryColor', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = validateAndMerge({ primaryColor: 'not-a-color' });
      expect(result.primaryColor).toBe(RACKSPACE_DEFAULTS.primaryColor);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid primary color')
      );
      warnSpy.mockRestore();
    });

    it('falls back to default for invalid secondaryColor', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = validateAndMerge({ secondaryColor: '#GGG' });
      expect(result.secondaryColor).toBe(RACKSPACE_DEFAULTS.secondaryColor);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('falls back to default for title exceeding 64 characters', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = validateAndMerge({ title: 'x'.repeat(65) });
      expect(result.title).toBe(RACKSPACE_DEFAULTS.title);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid title')
      );
      warnSpy.mockRestore();
    });

    it('falls back to default for empty title', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = validateAndMerge({ title: '' });
      expect(result.title).toBe(RACKSPACE_DEFAULTS.title);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('falls back to default for invalid logoUrl format', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = validateAndMerge({ logoUrl: '/logo.gif' });
      expect(result.logoUrl).toBe(RACKSPACE_DEFAULTS.logoUrl);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid logo URL')
      );
      warnSpy.mockRestore();
    });

    it('falls back to default for invalid faviconUrl format', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = validateAndMerge({ faviconUrl: '/favicon.svg' });
      expect(result.faviconUrl).toBe(RACKSPACE_DEFAULTS.faviconUrl);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid favicon URL')
      );
      warnSpy.mockRestore();
    });

    it('handles multiple invalid fields independently', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = validateAndMerge({
        primaryColor: 'bad',
        secondaryColor: '#AABBCC',
        title: 'x'.repeat(100),
        logoUrl: '/logo.png',
      });
      // primaryColor invalid → default
      expect(result.primaryColor).toBe(RACKSPACE_DEFAULTS.primaryColor);
      // secondaryColor valid → applied
      expect(result.secondaryColor).toBe('#AABBCC');
      // title invalid → default
      expect(result.title).toBe(RACKSPACE_DEFAULTS.title);
      // logoUrl valid → applied
      expect(result.logoUrl).toBe('/logo.png');
      warnSpy.mockRestore();
    });
  });
});
