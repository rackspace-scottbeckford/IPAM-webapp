import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  getProfile,
  getAvailableTags,
  AWS_PROFILE,
  AZURE_PROFILE,
  GCP_PROFILE,
  PRIVATE_PROFILE,
} from './cloud-profiles';
import type { UseCaseTag, TargetCloud } from '../core/types';

/**
 * Feature: cloud-ipam-webapp, Property 14: Tag color uniqueness
 *
 * For any cloud provider profile (including custom tags), all Use_Case_Tags in the
 * available set SHALL have distinct color values — no two tags share the same hex color.
 *
 * **Validates: Requirements 6.2, 6.5**
 */
describe('Property 14: Tag color uniqueness', () => {
  // --- Generators ---

  const targetCloudArb = fc.constantFrom<TargetCloud>('aws', 'azure', 'gcp', 'private');

  /**
   * Generator for custom tags with unique colors that do not collide with any
   * profile's default tag colors.
   */
  const allDefaultColors = new Set([
    ...AWS_PROFILE.defaultTags.map(t => t.color),
    ...AZURE_PROFILE.defaultTags.map(t => t.color),
    ...GCP_PROFILE.defaultTags.map(t => t.color),
    ...PRIVATE_PROFILE.defaultTags.map(t => t.color),
  ]);

  /** Generate a unique set of custom tags with colors that don't collide with defaults */
  const customTagsWithUniqueColorsArb = fc.array(
    fc.integer({ min: 1, max: 200 }),
    { minLength: 0, maxLength: 20 }
  ).map(indices => {
    const uniqueIndices = [...new Set(indices)];
    return uniqueIndices.map(i => ({
      id: `custom-${i}`,
      name: `custom-tag-${i}`,
      isCustom: true,
      // Generate colors in a range that won't collide with default profile colors
      color: `#${(0xBB0000 + i * 0x0101).toString(16).padStart(6, '0').slice(0, 6)}`,
    } as UseCaseTag));
  }).filter(tags => {
    // Ensure no color collisions within custom tags or with defaults
    const colors = tags.map(t => t.color);
    const uniqueColors = new Set(colors);
    if (uniqueColors.size !== colors.length) return false;
    return !colors.some(c => allDefaultColors.has(c));
  });

  // --- Property Tests ---

  it('all default tags within each profile have distinct colors', () => {
    fc.assert(
      fc.property(targetCloudArb, (cloud) => {
        const profile = getProfile(cloud);
        const colors = profile.defaultTags.map(t => t.color);
        const uniqueColors = new Set(colors);
        expect(uniqueColors.size).toBe(colors.length);
      }),
      { numRuns: 100 }
    );
  });

  it('when custom tags have unique colors not matching defaults, the combined set has all distinct colors', () => {
    fc.assert(
      fc.property(targetCloudArb, customTagsWithUniqueColorsArb, (cloud, customTags) => {
        const profile = getProfile(cloud);
        const availableTags = getAvailableTags(profile, customTags);
        const colors = availableTags.map(t => t.color);
        const uniqueColors = new Set(colors);
        expect(uniqueColors.size).toBe(colors.length);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: cloud-ipam-webapp, Property 15: Available tags equal profile defaults plus custom
 *
 * For any Target_Cloud selection, the set of available Use_Case_Tags SHALL equal the
 * union of the selected cloud profile's default tags and the user-defined custom tags.
 *
 * **Validates: Requirements 6.2, 6.5**
 */
describe('Property 15: Available tags equal profile defaults plus custom', () => {
  // --- Generators ---

  const targetCloudArb = fc.constantFrom<TargetCloud>('aws', 'azure', 'gcp', 'private');

  const customTagArb = fc.integer({ min: 1, max: 100 }).map(i => ({
    id: `custom-${i}`,
    name: `custom-tag-${i}`,
    isCustom: true,
    color: `#${(0xAA0000 + i * 0x111).toString(16).padStart(6, '0').slice(0, 6)}`,
  } as UseCaseTag));

  const customTagsArb = fc.array(customTagArb, { minLength: 0, maxLength: 20 });

  // --- Property Tests ---

  it('available tags contain all default tags from the selected profile', () => {
    fc.assert(
      fc.property(targetCloudArb, customTagsArb, (cloud, customTags) => {
        const profile = getProfile(cloud);
        const availableTags = getAvailableTags(profile, customTags);

        // Every default tag must be present in available tags
        for (const defaultTag of profile.defaultTags) {
          const found = availableTags.find(t => t.id === defaultTag.id);
          expect(found).toBeDefined();
          expect(found).toEqual(defaultTag);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('available tags contain all custom tags', () => {
    fc.assert(
      fc.property(targetCloudArb, customTagsArb, (cloud, customTags) => {
        const profile = getProfile(cloud);
        const availableTags = getAvailableTags(profile, customTags);

        // Every custom tag must be present in available tags
        for (const customTag of customTags) {
          const found = availableTags.find(t => t.id === customTag.id);
          expect(found).toBeDefined();
          expect(found).toEqual(customTag);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('available tags length equals default tags plus custom tags', () => {
    fc.assert(
      fc.property(targetCloudArb, customTagsArb, (cloud, customTags) => {
        const profile = getProfile(cloud);
        const availableTags = getAvailableTags(profile, customTags);

        expect(availableTags.length).toBe(profile.defaultTags.length + customTags.length);
      }),
      { numRuns: 100 }
    );
  });

  it('available tags equal exactly the union of profile defaults and custom tags', () => {
    fc.assert(
      fc.property(targetCloudArb, customTagsArb, (cloud, customTags) => {
        const profile = getProfile(cloud);
        const availableTags = getAvailableTags(profile, customTags);

        // Build expected set as union of defaults + custom
        const expectedIds = new Set([
          ...profile.defaultTags.map(t => t.id),
          ...customTags.map(t => t.id),
        ]);
        const actualIds = new Set(availableTags.map(t => t.id));

        expect(actualIds).toEqual(expectedIds);
      }),
      { numRuns: 100 }
    );
  });
});
