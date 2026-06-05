// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { getTagIconType, validateCustomIcon } from './CloudIcons';

describe('CloudIcons', () => {
  describe('getTagIconType', () => {
    it('returns gateway icon for transit-gateway tag', () => {
      expect(getTagIconType('transit-gateway')).toBe('gateway');
    });

    it('returns shield icon for firewall tag', () => {
      expect(getTagIconType('firewall')).toBe('shield');
    });

    it('returns shield icon for inspection tag', () => {
      expect(getTagIconType('inspection')).toBe('shield');
    });

    it('returns lock icon for vpn-routing tag', () => {
      expect(getTagIconType('vpn-routing')).toBe('lock');
    });

    it('returns lock icon for vpn-gateway tag', () => {
      expect(getTagIconType('vpn-gateway')).toBe('lock');
    });

    it('returns network icon for hub-vnet tag', () => {
      expect(getTagIconType('hub-vnet')).toBe('network');
    });

    it('returns server icon for workload tag', () => {
      expect(getTagIconType('workload')).toBe('server');
    });

    it('returns null for unknown tag names', () => {
      expect(getTagIconType('unknown-tag')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(getTagIconType('')).toBeNull();
    });

    it('returns settings icon for management tag', () => {
      expect(getTagIconType('management')).toBe('settings');
    });

    it('returns shield icon for dmz tag', () => {
      expect(getTagIconType('dmz')).toBe('shield');
    });
  });

  describe('validateCustomIcon', () => {
    it('rejects unsupported file types', async () => {
      const file = new File(['content'], 'icon.gif', { type: 'image/gif' });
      const result = await validateCustomIcon(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported format');
    });

    it('rejects files exceeding 100KB', async () => {
      // Create a file larger than 100KB
      const largeContent = new Uint8Array(101 * 1024);
      const file = new File([largeContent], 'icon.png', { type: 'image/png' });
      const result = await validateCustomIcon(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('100KB');
    });

    it('accepts SVG files within size limit', async () => {
      const svgContent = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64"/></svg>';
      const file = new File([svgContent], 'icon.svg', { type: 'image/svg+xml' });
      const result = await validateCustomIcon(file);
      expect(result.valid).toBe(true);
      expect(result.dataUri).toBeDefined();
      expect(result.dataUri).toContain('data:');
    });

    it('rejects JPEG files', async () => {
      const file = new File(['content'], 'icon.jpg', { type: 'image/jpeg' });
      const result = await validateCustomIcon(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported format');
    });
  });
});
