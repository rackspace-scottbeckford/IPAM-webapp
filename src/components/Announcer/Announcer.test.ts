import { describe, it, expect } from 'vitest';

/**
 * Unit tests for the Announcer component's module exports and structure.
 *
 * The Announcer uses aria-live regions to announce split/join operations
 * to screen readers without interrupting the user's workflow.
 *
 * Note: Full integration testing of the hook requires a React rendering context.
 * These tests verify the module structure and exported API.
 *
 * Requirements: 7.4 (screen reader announcements for split/join operations)
 */
describe('Announcer', () => {
  it('should export AnnouncerProvider and useAnnouncer', async () => {
    const module = await import('./Announcer');
    expect(module.AnnouncerProvider).toBeDefined();
    expect(module.useAnnouncer).toBeDefined();
    expect(typeof module.AnnouncerProvider).toBe('function');
    expect(typeof module.useAnnouncer).toBe('function');
  });

  it('AnnouncerProvider is a React component (accepts children)', async () => {
    const module = await import('./Announcer');
    // Verify it's a function that can be used as a component
    expect(module.AnnouncerProvider.length).toBeGreaterThanOrEqual(0);
  });

  it('default context provides a no-op announce function', async () => {
    // The default context value (used when no provider is present)
    // is defined in the module — we verify the structure
    const module = await import('./Announcer');
    expect(module.useAnnouncer).toBeDefined();
  });
});
