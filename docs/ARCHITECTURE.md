# Architecture

## Design Principles

1. **Zero network dependency post-load** — no API calls, no telemetry, no CDN fonts at runtime
2. **Immutable state transitions** — every split/join/tag operation produces a new state snapshot
3. **Separation of concerns** — calculator logic is pure functions independent of UI framework
4. **Configuration-driven theming** — brand and cloud themes are data, not code
5. **URL as persistence layer** — the full network plan is encodable in a shareable URL

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                           │
├──────────────┬──────────────┬──────────────┬────────────┤
│  UI Layer    │ State Mgmt   │  Core Logic  │ Persistence│
│  (React)     │ (Zustand)    │  (Pure Fns)  │ (Serialize)│
├──────────────┼──────────────┼──────────────┼────────────┤
│ Components   │ app-store.ts │ subnet-calc  │ JSON export│
│ CSS Modules  │              │ tree-ops     │ URL encode │
│ Hooks        │              │ validators   │ File I/O   │
│              │              │ summary-calc │            │
├──────────────┴──────────────┴──────────────┴────────────┤
│              Static Assets & Configuration               │
│         Cloud Profiles │ Branding Config │ Icons         │
└─────────────────────────────────────────────────────────┘
```

## Data Flow

1. User selects cloud provider → loads profile (reserved IPs, tags, limits)
2. User enters CIDR → validates, auto-adjusts host bits, creates root node
3. User splits/joins → immutable tree update → recompute summary → re-render
4. State changes → sync to URL hash automatically
5. Export → serialize full plan to JSON blob → trigger download

## Subnet Tree Model

The hierarchy is a binary tree. Each split produces exactly two children:

- Parent prefix P → children have prefix P+1
- First child inherits parent's network address
- Second child's network = parent's network + 2^(32-(P+1))
- Maximum depth: /8 root to /30 leaves (22 levels)

Tags, labels, workload accounts, and AZ assignments live only on leaf nodes.
Parent nodes retain their label after splitting (for context).

## State Management

Zustand store with computed derived state:

- **Core state**: targetCloud, providerProfile, networkPlan, customTags
- **Derived**: VPCSummary (recomputed on every tree change)
- **UI state**: expandedNodes, activeView

All tree-modifying operations require a cloud to be selected first (enforced at the store level).

## Serialization

Two formats:

- **JSON** — human-readable, includes full tree with `iacTags`, labels, workload accounts. Schema-validated on import with 5MB size limit.
- **URL hash** — compact encoding with bit-string tree structure + Base64 assignments. Synced automatically on every state change.
