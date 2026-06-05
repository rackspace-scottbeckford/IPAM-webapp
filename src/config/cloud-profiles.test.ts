import { describe, it, expect } from 'vitest';
import {
  AWS_PROFILE,
  AZURE_PROFILE,
  GCP_PROFILE,
  PRIVATE_PROFILE,
  getProfile,
  getAvailableTags,
} from './cloud-profiles';
import type { UseCaseTag } from '../core/types';

describe('Cloud Provider Profiles', () => {
  describe('getProfile', () => {
    it('returns AWS profile for "aws"', () => {
      expect(getProfile('aws')).toBe(AWS_PROFILE);
    });

    it('returns Azure profile for "azure"', () => {
      expect(getProfile('azure')).toBe(AZURE_PROFILE);
    });

    it('returns GCP profile for "gcp"', () => {
      expect(getProfile('gcp')).toBe(GCP_PROFILE);
    });

    it('returns Private profile for "private"', () => {
      expect(getProfile('private')).toBe(PRIVATE_PROFILE);
    });
  });

  describe('reserved IPs per provider', () => {
    it('AWS reserves 5 IPs per subnet', () => {
      expect(AWS_PROFILE.reservedIPs).toBe(5);
    });

    it('Azure reserves 5 IPs per subnet', () => {
      expect(AZURE_PROFILE.reservedIPs).toBe(5);
    });

    it('GCP reserves 4 IPs per subnet', () => {
      expect(GCP_PROFILE.reservedIPs).toBe(4);
    });

    it('Private Cloud reserves 2 IPs per subnet by default', () => {
      expect(PRIVATE_PROFILE.reservedIPs).toBe(2);
    });
  });

  describe('reserved reasons match reserved IP count', () => {
    it('AWS has 5 reserved reasons', () => {
      expect(AWS_PROFILE.reservedReasons).toHaveLength(5);
    });

    it('Azure has 5 reserved reasons', () => {
      expect(AZURE_PROFILE.reservedReasons).toHaveLength(5);
    });

    it('GCP has 4 reserved reasons', () => {
      expect(GCP_PROFILE.reservedReasons).toHaveLength(4);
    });

    it('Private Cloud has 2 reserved reasons', () => {
      expect(PRIVATE_PROFILE.reservedReasons).toHaveLength(2);
    });
  });

  describe('getAvailableTags', () => {
    it('returns only default tags when no custom tags provided', () => {
      const tags = getAvailableTags(AWS_PROFILE, []);
      expect(tags).toEqual([...AWS_PROFILE.defaultTags]);
    });

    it('returns union of default and custom tags', () => {
      const customTags: UseCaseTag[] = [
        { id: 'custom-1', name: 'my-tag', isCustom: true, color: '#123456' },
        { id: 'custom-2', name: 'another-tag', isCustom: true, color: '#654321' },
      ];
      const tags = getAvailableTags(GCP_PROFILE, customTags);
      expect(tags).toHaveLength(GCP_PROFILE.defaultTags.length + 2);
      expect(tags).toEqual([...GCP_PROFILE.defaultTags, ...customTags]);
    });

    it('places custom tags after default tags', () => {
      const customTag: UseCaseTag = { id: 'custom-x', name: 'extra', isCustom: true, color: '#AABBCC' };
      const tags = getAvailableTags(PRIVATE_PROFILE, [customTag]);
      expect(tags[tags.length - 1]).toEqual(customTag);
    });
  });

  describe('profile data integrity', () => {
    it('AWS has 6 default tags', () => {
      expect(AWS_PROFILE.defaultTags).toHaveLength(6);
    });

    it('Azure has 6 default tags', () => {
      expect(AZURE_PROFILE.defaultTags).toHaveLength(6);
    });

    it('GCP has 5 default tags', () => {
      expect(GCP_PROFILE.defaultTags).toHaveLength(5);
    });

    it('Private Cloud has 4 default tags', () => {
      expect(PRIVATE_PROFILE.defaultTags).toHaveLength(4);
    });

    it('Private Cloud has no subnet limit (Infinity)', () => {
      expect(PRIVATE_PROFILE.subnetLimit).toBe(Infinity);
    });

    it('AWS subnet limit is 200', () => {
      expect(AWS_PROFILE.subnetLimit).toBe(200);
    });

    it('Azure subnet limit is 3000', () => {
      expect(AZURE_PROFILE.subnetLimit).toBe(3000);
    });

    it('GCP subnet limit is 300', () => {
      expect(GCP_PROFILE.subnetLimit).toBe(300);
    });
  });
});
