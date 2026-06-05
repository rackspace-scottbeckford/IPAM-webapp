# Implementation Plan: Cloud IPAM Web Application

## Overview

This plan implements a client-side, offline-capable IPAM web application using React 18+ with TypeScript, Zustand state management, Vite build tooling, and CSS Modules with Custom Properties for theming. The implementation proceeds from core pure-function logic (subnet calculator, tree operations) through state management and serialization, then UI components, and finally branding/theming and offline support.

## Tasks

- [x] 1. Project scaffolding and core type definitions
  - [x] 1.1 Initialize Vite + React + TypeScript project with dependencies
    - Initialize project with `npm create vite@latest` using react-ts template
    - Install dependencies: zustand, vite-plugin-pwa, fast-check (dev), vitest (dev)
    - Configure Vite with PWA plugin, path aliases, and CSS Modules
    - Set up vitest configuration with fast-check support
    - Create directory structure: `src/core/`, `src/components/`, `src/store/`, `src/config/`, `src/theme/`, `src/serialization/`
    - _Requirements: 9.1, 9.2_

  - [x] 1.2 Define core TypeScript interfaces and types
    - Create `src/core/types.ts` with all interfaces: IPv4Address, CIDRBlock, SubnetInfo, SubnetNode, UseCaseTag, CloudProviderProfile, TargetCloud, NetworkPlan, BrandingConfiguration, VPCSummary, AccountAllocation, LimitWarning, SerializationError, SplitError, JoinError
    - Ensure all types use `readonly` modifiers for immutability
    - _Requirements: 2.2, 3.1, 5.1, 6.1, 8.4, 10.1_

- [x] 2. SubnetCalculator — pure IP arithmetic module
  - [x] 2.1 Implement IPv4 address utilities
    - Create `src/core/subnet-calculator.ts`
    - Implement `ipToNumber(dotted: string): number` — convert dotted-decimal to 32-bit unsigned int
    - Implement `numberToIp(bits: number): string` — convert 32-bit unsigned int to dotted-decimal
    - Implement `prefixToMask(prefix: number): number` — generate subnet mask from prefix length
    - Implement `adjustToNetworkAddress(ip: number, prefix: number): CIDRBlock` — zero host bits
    - _Requirements: 2.2, 2.5_

  - [x] 2.2 Write property tests for IPv4 address utilities
    - **Property 5: Host-bit auto-adjustment**
    - **Validates: Requirements 2.5**

  - [x] 2.3 Implement subnet info computation
    - Implement `computeSubnetInfo(cidr: CIDRBlock, reservedCount: number): SubnetInfo`
    - Compute network address, broadcast address, subnet mask, total addresses, usable hosts
    - Handle edge case where total addresses ≤ reserved count (usable = 0)
    - _Requirements: 2.2, 5.1, 5.2, 5.3, 5.4, 5.6_

  - [x] 2.4 Write property tests for subnet arithmetic
    - **Property 4: Subnet arithmetic correctness**
    - **Validates: Requirements 2.2**

  - [x] 2.5 Write property tests for usable host calculation
    - **Property 10: Usable host calculation with provider reservations**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.6**

- [x] 3. Input validation module
  - [x] 3.1 Implement CIDR input validator
    - Create `src/core/input-validator.ts`
    - Implement `validateCIDR(input: string): ValidationResult` — check format, octet range, prefix range (8–30), classify error type
    - Return specific error messages for: malformed format, octet out of range, prefix out of range, missing prefix
    - _Requirements: 2.1, 2.3, 2.4, 2.6_

  - [x] 3.2 Write property tests for CIDR validation
    - **Property 3: CIDR input validation correctness**
    - **Validates: Requirements 2.3, 2.4, 2.6**

  - [x] 3.3 Implement text field and tag name validators
    - Implement `validateTagName(name: string): boolean` — 1–32 characters
    - Implement `validateTextField(value: string): boolean` — 1–64 characters (workload account, AZ, label)
    - Implement `validateCustomTagCount(current: number): boolean` — max 20
    - _Requirements: 1.6, 6.3, 6.4, 6.6, 6.7_

  - [x] 3.4 Write property tests for text field validation
    - **Property 12: Custom tag name validation**
    - **Property 13: Text field length validation**
    - **Validates: Requirements 1.6, 6.3, 6.4, 6.6, 6.7**

- [x] 4. Tree operations module — split, join, traversal
  - [x] 4.1 Implement split and join operations
    - Create `src/core/tree-operations.ts`
    - Implement `split(node: SubnetNode): [SubnetNode, SubnetNode] | SplitError` — create two children with prefix+1
    - Implement `join(parent: SubnetNode): SubnetNode | JoinError` — merge leaf children back to parent
    - Implement `canSplit(node: SubnetNode): boolean` — leaf AND prefix < 30
    - Implement `canJoin(parent: SubnetNode): boolean` — has two leaf children
    - Generate unique IDs for new nodes
    - _Requirements: 3.1, 3.3, 3.6, 4.1, 4.2_

  - [x] 4.2 Write property tests for split operation
    - **Property 6: Split produces valid binary subdivision**
    - **Property 7: Split eligibility invariant**
    - **Validates: Requirements 3.1, 3.3, 3.4, 3.6**

  - [x] 4.3 Write property tests for join operation
    - **Property 8: Split-then-join round trip**
    - **Property 9: Join eligibility invariant**
    - **Validates: Requirements 4.1, 4.2**

  - [x] 4.4 Implement tree traversal and tag management
    - Implement `getLeaves(tree: SubnetNode): SubnetNode[]` — collect all leaf nodes
    - Implement `findNode(tree: SubnetNode, id: string): SubnetNode | null`
    - Implement `assignTag(tree: SubnetNode, nodeId: string, tag: UseCaseTag): SubnetNode | TagError` — enforce leaf-only, max 5 tags
    - Implement `removeTag(tree: SubnetNode, nodeId: string, tagId: string): SubnetNode`
    - Implement `setWorkloadAccount`, `setAvailabilityZone`, `setLabel` — with validation
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.7, 6.8, 6.9_

  - [x] 4.5 Write property tests for tag assignment
    - **Property 11: Tag assignment constraints on leaf subnets**
    - **Validates: Requirements 6.1, 6.9**

- [x] 5. Checkpoint — Core logic verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Cloud provider profiles and tag management
  - [x] 6.1 Create static cloud provider profile data
    - Create `src/config/cloud-profiles.ts`
    - Define AWS_PROFILE, AZURE_PROFILE, GCP_PROFILE, PRIVATE_PROFILE with all fields (reservedIPs, reservedReasons, subnetLimit, defaultTags, accentColor, iconPath)
    - Implement `getProfile(cloud: TargetCloud): CloudProviderProfile`
    - Implement `getAvailableTags(profile: CloudProviderProfile, customTags: UseCaseTag[]): UseCaseTag[]`
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 5.1, 5.2, 5.3, 5.4_

  - [x] 6.2 Write property tests for tag availability and color uniqueness
    - **Property 14: Tag color uniqueness**
    - **Property 15: Available tags equal profile defaults plus custom**
    - **Validates: Requirements 6.2, 6.5**

  - [x] 6.3 Implement cloud change logic with tag reconciliation
    - Implement `reconcileTags(tree: SubnetNode, oldProfile: CloudProviderProfile, newProfile: CloudProviderProfile, customTags: UseCaseTag[]): { tree: SubnetNode; removedTags: string[] }`
    - Compute intersection of old tags with new profile's available tags
    - Return list of incompatible tags for confirmation dialog
    - _Requirements: 1.7, 1.8_

  - [x] 6.4 Write property tests for cloud change tag reconciliation
    - **Property 2: Cloud change preserves tag intersection**
    - **Validates: Requirements 1.7**

- [x] 7. VPC summary calculator
  - [x] 7.1 Implement summary computation
    - Create `src/core/summary-calculator.ts`
    - Implement `computeSummary(tree: SubnetNode, profile: CloudProviderProfile): VPCSummary`
    - Compute: totalSubnets (leaf count), subnetsByTag, subnetsByAZ, totalUsableIPs, allocationPercentage, accountBreakdown, limitWarning
    - Round allocation percentage to 1 decimal place
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 7.2 Write property tests for summary calculations
    - **Property 20: Summary subnet count correctness**
    - **Property 21: Summary usable IP total correctness**
    - **Property 22: Summary provider limit warning**
    - **Property 23: Summary workload account breakdown**
    - **Property 24: Allocation percentage correctness**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5**

- [x] 8. Serialization — URL and JSON persistence
  - [x] 8.1 Implement PlanSerializer for JSON export/import
    - Create `src/serialization/plan-serializer.ts`
    - Implement `toJSON(plan: NetworkPlan): string` — serialize full plan with version field
    - Implement `fromJSON(json: string): NetworkPlan | SerializationError` — validate schema, enforce 5MB limit, validate tree structure integrity
    - Validate imported target cloud and load corresponding profile
    - _Requirements: 8.4, 8.5, 8.6, 8.7, 8.8, 8.9_

  - [x] 8.2 Write property tests for JSON serialization
    - **Property 18: JSON serialization round trip**
    - **Property 19: Invalid serialized input produces error (JSON)**
    - **Validates: Requirements 8.4, 8.6, 8.9**

  - [x] 8.3 Implement PlanSerializer for URL encoding/decoding
    - Implement `toURL(plan: NetworkPlan): string` — encode tree as bit string, Base64 encode tags/assignments
    - Implement `fromURL(url: string): NetworkPlan | SerializationError` — decode and validate all URL parameters
    - Handle compact encoding: root CIDR, target cloud, tree structure bit string, tag/assignment tuples, custom tags
    - _Requirements: 8.1, 8.2, 8.3, 8.9_

  - [x] 8.4 Write property tests for URL serialization
    - **Property 17: URL serialization round trip**
    - **Property 19: Invalid serialized input produces error (URL)**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.9**

- [x] 9. Checkpoint — Serialization and data layer verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Zustand state management store
  - [x] 10.1 Implement the application Zustand store
    - Create `src/store/app-store.ts`
    - Define AppState interface with core state, derived state, UI state, and actions
    - Implement `selectCloud` — load profile, enforce selection before operations (Property 1)
    - Implement `setRootCIDR` — validate input, auto-adjust host bits, create root node
    - Implement `splitSubnet`, `joinSubnet` — delegate to TreeOperations, update tree immutably
    - Implement `assignTag`, `removeTag`, `setWorkloadAccount`, `setAvailabilityZone`, `setLabel`
    - Implement `exportJSON`, `importJSON` — delegate to PlanSerializer
    - Implement `syncToURL`, `loadFromURL` — URL state persistence
    - Recompute VPCSummary on every state change
    - _Requirements: 1.1, 1.7, 1.8, 2.1, 2.5, 3.1, 3.5, 4.1, 4.4, 6.1, 6.8, 8.1, 8.2, 8.4, 8.5, 9.1, 10.6_

  - [x] 10.2 Write property test for operations requiring cloud selection
    - **Property 1: Operations require cloud selection**
    - **Validates: Requirements 1.1**

- [x] 11. UI — App shell and cloud selection
  - [x] 11.1 Implement App shell, Header, and CloudSelector components
    - Create `src/components/Header/Header.tsx` — logo, title, cloud provider icon, cloud name
    - Create `src/components/CloudSelector/CloudSelector.tsx` — four cloud options, required selection gate
    - Create `src/App.tsx` — layout shell, conditional rendering based on cloud selection
    - Implement cloud change confirmation dialog when tags exist (list incompatible tags, confirm/cancel)
    - _Requirements: 1.1, 1.2, 1.7, 1.8, 12.1, 12.5_

  - [x] 11.2 Implement CIDRInput component
    - Create `src/components/CIDRInput/CIDRInput.tsx`
    - Input field accepting CIDR notation (max 18 chars)
    - Display inline validation errors with specific messages per error type
    - Display host-bit adjustment notification showing entered vs corrected address
    - Display computed subnet info (network, broadcast, mask, hosts) on valid input
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 12. UI — Subnet tree visualizer
  - [x] 12.1 Implement TreeVisualizer component
    - Create `src/components/TreeVisualizer/TreeVisualizer.tsx`
    - Render hierarchical tree with parent-child edges
    - Display each node: CIDR notation, address range, subnet mask, usable hosts (adjusted for provider)
    - Render proportional width bars relative to root (min 4px, with not-to-scale indicator)
    - Visually distinguish leaf vs intermediate nodes (fill style + border style)
    - Implement collapse/expand toggles for non-leaf subtrees (default expanded)
    - _Requirements: 3.2, 7.1, 7.2, 7.3, 7.4, 7.6_

  - [x] 12.2 Implement split and join controls
    - Add split button on leaf nodes (disabled at /30 with tooltip)
    - Add join button on parent nodes with two leaf children
    - Disable join when children have assignments, show confirmation dialog
    - Ensure operations complete within 100ms rendering update
    - _Requirements: 3.1, 3.3, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 12.3 Implement GroupedView component
    - Create `src/components/GroupedView/GroupedView.tsx`
    - Group subnets by assigned Use_Case_Tag
    - Render each group in a bounded region with tag name header
    - Toggle between tree view and grouped view
    - _Requirements: 7.5_

  - [x] 12.4 Write property test for grouped view correctness
    - **Property 16: Grouped view partitions tagged leaves correctly**
    - **Validates: Requirements 7.5**

- [x] 13. UI — Tagging, workload assignment, and summary panel
  - [x] 13.1 Implement tag assignment and metadata UI
    - Create `src/components/SubnetDetails/SubnetDetails.tsx`
    - Tag picker showing only tags valid for current Target_Cloud (max 5 per subnet)
    - Workload account input (1–64 chars), AZ input (up to 64 chars), label input (1–64 chars)
    - Remove tag/account/AZ/label controls
    - Prevent tag assignment on non-leaf nodes with message
    - Apply unique color per tag on subnet visualization
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_

  - [x] 13.2 Implement VPC Summary Panel
    - Create `src/components/SummaryPanel/SummaryPanel.tsx`
    - Display: total subnets, subnets per tag, subnets per AZ
    - Display: allocation percentage (1 decimal), total usable IPs
    - Display: workload account breakdown (subnet count, usable IPs, percentage per account)
    - Display provider limit warning when exceeded (current count vs max)
    - Display reserved address count and reasons
    - Display cloud provider icon in panel header
    - Update within 200ms of any operation
    - _Requirements: 5.5, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 12.5_

- [x] 14. Checkpoint — UI components verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Branding and theming engine
  - [x] 15.1 Implement BrandingConfig loader and ThemeEngine
    - Create `src/theme/branding-config.ts` — load from JSON config or env vars, validate fields, fallback to Rackspace defaults per invalid field
    - Create `src/theme/theme-engine.ts` — apply CSS custom properties for brand colors, cloud accent colors
    - Define Rackspace default branding (logo, colors, title, favicon)
    - Implement layered color application: brand primary/secondary → cloud accent as tertiary only on cloud-context elements
    - Apply primary color to header background, primary buttons, active nav
    - Apply secondary color to hover states, borders, accent highlights
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 12.6_

  - [x] 15.2 Write property tests for branding fallback and color layering
    - **Property 25: Branding fallback for invalid configuration**
    - **Property 26: Cloud accent colors do not override brand colors**
    - **Validates: Requirements 11.8, 12.6**

  - [x] 15.3 Implement cloud visual theming
    - Apply cloud-specific accent colors to subnet visualizations (AWS orange, Azure blue, GCP blue, Private gray)
    - Display cloud provider icons next to use-case tags (gateway, shield, lock icons)
    - Implement theme transition within 300ms on cloud change
    - Support custom icon upload for Private Cloud (SVG/PNG, 64x64, 100KB max)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.6, 12.7_

- [x] 16. Save/Load and offline support
  - [x] 16.1 Implement JSON file export/import UI
    - Create `src/components/FileControls/FileControls.tsx`
    - Export button: generate JSON blob, trigger download
    - Import button: file picker, validate size (≤5MB), parse and validate, show error modals on failure
    - Handle imported plan with different Target_Cloud (apply imported cloud)
    - _Requirements: 8.4, 8.5, 8.6, 8.7, 8.8_

  - [x] 16.2 Implement URL state synchronization
    - Sync NetworkPlan to URL hash on every state change
    - Load from URL on app initialization
    - Display error toast on invalid URL parameters, fall back to empty state
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 16.3 Configure Service Worker for offline support
    - Configure vite-plugin-pwa with cache-first strategy
    - Cache all static assets (HTML, JS, CSS, icons, SVGs)
    - Ensure all operations work without network after initial load
    - Verify no outbound network requests transmit plan data
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 17. Accessibility and performance
  - [x] 17.1 Implement accessibility features
    - Add ARIA labels to all interactive elements (split/join buttons, tag pickers, inputs)
    - Implement keyboard navigation through tree nodes
    - Add screen reader announcements for split/join operations
    - Ensure color contrast meets WCAG AA for all theme combinations
    - Add focus management after state changes
    - Visually distinguish leaf vs intermediate nodes without relying on color alone
    - _Requirements: 7.4_

  - [x] 17.2 Performance optimization
    - Ensure split/join render updates complete within 100ms
    - Ensure summary recalculation completes within 200ms for 500-leaf trees
    - Ensure single calculation operations complete within 200ms
    - Ensure cloud profile loads within 1 second
    - Ensure theme transitions complete within 300ms
    - _Requirements: 1.2, 3.5, 4.4, 9.4, 10.6, 12.4_

- [x] 18. Final checkpoint — Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (26 properties total)
- Unit tests validate specific examples and edge cases
- All code is TypeScript targeting React 18+ with Vite build tooling
- The SubnetCalculator and TreeOperations modules are pure functions with no UI dependency, enabling thorough property-based testing
- Cloud provider profiles are static data — no API calls required

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "3.1", "3.3"] },
    { "id": 3, "tasks": ["2.2", "2.3", "3.2", "3.4"] },
    { "id": 4, "tasks": ["2.4", "2.5", "4.1"] },
    { "id": 5, "tasks": ["4.2", "4.3", "4.4", "6.1"] },
    { "id": 6, "tasks": ["4.5", "6.2", "6.3"] },
    { "id": 7, "tasks": ["6.4", "7.1"] },
    { "id": 8, "tasks": ["7.2", "8.1"] },
    { "id": 9, "tasks": ["8.2", "8.3"] },
    { "id": 10, "tasks": ["8.4", "10.1"] },
    { "id": 11, "tasks": ["10.2", "11.1", "11.2"] },
    { "id": 12, "tasks": ["12.1", "12.2", "12.3"] },
    { "id": 13, "tasks": ["12.4", "13.1", "13.2"] },
    { "id": 14, "tasks": ["15.1"] },
    { "id": 15, "tasks": ["15.2", "15.3"] },
    { "id": 16, "tasks": ["16.1", "16.2", "16.3"] },
    { "id": 17, "tasks": ["17.1", "17.2"] }
  ]
}
```
