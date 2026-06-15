# Cloud IP Address Management Tool

**Live demo:** https://rackspace-scottbeckford.github.io/IPAM-webapp/

A browser-based subnet planning tool for cloud migrations. Design, visualize, and document IP address allocation for AWS, Azure, GCP, or Private Cloud environments — entirely client-side with no server dependencies.

Built by [Rackspace Technology](https://www.rackspace.com) as an internal tool for cloud migration engagements.

## Why

Network planning for cloud migrations is tedious. Engineers typically work in spreadsheets or use disconnected tools that don't account for provider-specific constraints. This tool solves that by:

- **Visual subnet splitting** — see your CIDR hierarchy as a tree, split with one click
- **Provider-aware math** — automatically deducts reserved IPs per cloud provider (AWS: 5, Azure: 5, GCP: 4, Private: 2)
- **CIDR suffix dropdown** — quick-select prefix length (/8–/28) from a dropdown, synced bidirectionally with the text input
- **Workload capacity planning** — specify how many IPs you need, the tool calculates and allocates the right subnet size
- **Subnet limit warnings** — alerts when you exceed provider VPC/VNet limits
- **Portable plans** — export/import as JSON, share via URL
- **Offline-first** — runs entirely in your browser after initial load, no data leaves your machine
- **White-label ready** — configurable branding for customer deployments
- **Multi-language** — EN/DE language toggle with instant switching (title always English)

## What

### Features

- Select target cloud (AWS, Azure, GCP, Private Cloud)
- Enter a root CIDR block (/8 to /30)
- **CIDR suffix dropdown** — select prefix from a compact dropdown showing just the mask; expanded list shows address counts
- Split subnets visually into binary subdivisions
- Join subnets back together
- **Create Workload** — specify required usable IPs, the tool suggests the smallest suitable prefix and auto-allocates a subnet
- Add free-text labels (comments) to any subnet
- Assign IaC tags for infrastructure-as-code exports
- Set workload accounts and availability zones
- View VPC planning summary (subnet counts, usable IPs, allocation percentage)
- Export/import plans as JSON files
- Share plans via URL (state encoded in hash)
- **Language toggle (EN/DE)** — switch between English and German; title stays English, all other UI text translates instantly
- Works offline as a PWA (Progressive Web App)
- Keyboard accessible with screen reader support

### Cloud Provider Profiles

| Provider | Reserved IPs | Subnet Limit | Default IaC Tags |
|----------|-------------|--------------|-------------------|
| AWS | 5 per subnet | 200 per VPC | transit-gateway, inspection, vpn-routing, workload, shared-services, egress |
| Azure | 5 per subnet | 3000 per VNet | hub-vnet, spoke-vnet, vpn-gateway, firewall, workload, shared-services |
| GCP | 4 per subnet | 300 per VPC | shared-vpc-host, shared-vpc-service, interconnect, workload, shared-services |
| Private | 2 per subnet (configurable) | No limit | core-network, dmz, workload, management |

## How

### Prerequisites

- Node.js 18+ 
- npm 9+

### Development

```bash
# Install dependencies
npm install

# Start dev server (hot reload)
npm run dev

# Run tests (494 tests including property-based tests)
npm run test

# Build for production
npm run build

# Preview production build
npm run preview
```

### Project Structure

```
src/
├── core/                    # Pure-function modules (no UI dependency)
│   ├── types.ts             # TypeScript interfaces and type definitions
│   ├── subnet-calculator.ts # IPv4 arithmetic, subnet info computation
│   ├── reverse-cidr-calculator.ts # Reverse CIDR: required IPs → suggested prefix
│   ├── tree-operations.ts   # Split, join, tree traversal, tag management
│   ├── input-validator.ts   # CIDR validation, text field validation
│   └── summary-calculator.ts # VPC planning summary computation
├── config/                  # Static configuration
│   ├── cloud-profiles.ts    # AWS, Azure, GCP, Private Cloud profiles
│   └── cloud-change.ts      # Tag reconciliation on provider switch
├── serialization/           # State persistence
│   └── plan-serializer.ts   # JSON export/import, URL encoding/decoding
├── store/                   # State management
│   └── app-store.ts         # Zustand store with all actions
├── i18n/                    # Internationalization
│   ├── translations.ts      # EN and DE translation dictionaries
│   ├── i18n-store.ts        # Zustand-based language store
│   └── index.ts             # Public exports
├── theme/                   # Branding and theming
│   ├── branding-config.ts   # White-label config loader with fallbacks
│   ├── theme-engine.ts      # CSS custom property management
│   └── useCloudTheme.ts     # Cloud accent color hook
├── hooks/                   # React hooks
│   ├── useURLSync.ts        # URL state synchronization
│   └── useTreeKeyboardNav.ts # Keyboard navigation for tree
├── components/              # React UI components
│   ├── Header/              # App header with branding + language toggle
│   ├── CloudSelector/       # Cloud provider selection screen
│   ├── CIDRInput/           # Network address input with prefix dropdown
│   ├── CreateWorkload/      # Workload capacity planning dialog
│   ├── TreeVisualizer/      # Hierarchical subnet tree with split/join
│   ├── GroupedView/         # Subnets grouped by tag
│   ├── SubnetDetails/       # Tag and metadata editing panel
│   ├── SummaryPanel/        # VPC planning summary
│   ├── FileControls/        # JSON export/import buttons
│   ├── CloudIcons/          # Provider icon components
│   ├── Toast/               # Notification system
│   └── Announcer/           # Screen reader announcements
├── App.tsx                  # Main application layout
└── main.tsx                 # Entry point
```

### Technology Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| UI | React 18 + TypeScript | Component-based, type-safe |
| State | Zustand | Lightweight, no boilerplate |
| Styling | CSS Modules + Custom Properties | Scoped styles with runtime theming |
| Build | Vite | Fast HMR, tree-shaking, PWA plugin |
| Offline | vite-plugin-pwa | Service worker with cache-first strategy |
| Testing | Vitest + fast-check | Unit tests + property-based testing |

### Testing

The project uses a dual testing strategy:

- **Property-based tests** (fast-check) — 26 formal correctness properties covering IP arithmetic, tree invariants, serialization round-trips, and UI behavior
- **Unit tests** — specific examples and edge cases for all modules

```bash
# Run all 494 tests
npm run test

# Watch mode
npm run test:watch
```

### Branding / White-labelling

The tool supports custom branding via `window.__BRANDING_CONFIG__` or Vite environment variables:

```javascript
// Set before app loads (e.g., in index.html)
window.__BRANDING_CONFIG__ = {
  logoUrl: '/path/to/customer-logo.png',  // SVG, PNG, or JPEG
  primaryColor: '#EB0000',                 // Header background
  secondaryColor: '#1A1A1A',              // Hover states, borders
  title: 'Cloud IP Address Management Tool',
  faviconUrl: '/path/to/favicon.ico'      // ICO or PNG
};
```

Invalid values fall back to Rackspace defaults per field.

### Offline / Privacy

- All computation runs in the browser — no server calls
- No telemetry, analytics, or outbound data transmission
- Plans are stored in the URL hash or exported as local JSON files
- Works fully offline after initial page load (PWA with service worker)

### Language / i18n

The tool supports English (EN) and German (DE). A toggle in the header (below the Rackspace logo) switches instantly — no reload needed.

- The application **title always stays in English** regardless of language
- All other UI text (labels, buttons, messages, errors, dialogs) translates
- Default language: English
- Translations live in `src/i18n/translations.ts` — add new languages by extending the `translations` map

## Deployment

```bash
# Build production bundle
npm run build

# Output is in dist/ — serve with any static file server
npx serve dist
```

The `dist/` folder contains everything needed: HTML, JS, CSS, service worker, and manifest. Deploy to any static hosting (GitHub Pages, S3, Azure Blob, Nginx, etc.).

## Future Roadmap

- Architecture diagram generation (SVG/PNG/PDF export)
- Infrastructure as Code export (Terraform, CDK, Bicep, Pulumi)
- SAML/AAA authentication for enterprise deployments

## License

Internal Rackspace Technology tool. Not for public distribution.
