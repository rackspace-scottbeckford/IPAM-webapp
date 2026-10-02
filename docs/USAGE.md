# Usage Guide

## Getting Started

1. Open the app in your browser
2. Select your target cloud provider (AWS, Azure, GCP, or Private Cloud)
3. Enter your starting CIDR block (e.g., `10.0.0.0/16`) and press Enter or click Calculate

## Working with Subnets

### Splitting

Click the **✂ Split** button on any leaf subnet to divide it into two equal halves. Each child gets the parent's prefix length + 1.

Example: Splitting `10.0.0.0/16` produces:
- `10.0.0.0/17` (first half)
- `10.0.128.0/17` (second half)

Split is disabled at /30 (minimum 4 addresses per subnet).

### Joining

Click the **⊕ Join** button on any parent node whose two children are both leaves. This merges them back into the parent, discarding any tags or assignments on the children.

### Adding Comments

Click **+ Add comment** on any subnet to type a free-text label (max 64 characters). Labels are preserved when splitting — the parent keeps its comment and children start blank.

Click an existing comment to edit it. Press Enter to save or Escape to cancel.

## Creating a Workload

Click **+ Create Workload** in the toolbar when you know how much capacity you need but not the exact CIDR. Enter a workload name and the number of usable IP addresses required. The tool calculates the smallest subnet that fits (after provider-reserved addresses), finds free space in the tree, and allocates it — labelling the subnet with your workload name.

Use this when you are designing new capacity from scratch.

## Mapping Existing Subnets

Click **Map Existing** in the toolbar when you have *already* allocated address space elsewhere and want to track it here. This is the counterpart to Create Workload: instead of picking a free block for you, it places the exact CIDR you provide.

1. Click **Map Existing**.
2. Enter a workload name and the existing CIDR block (e.g., `10.23.5.0/24`).
3. Review the preview, then confirm.

The subnet is inserted at the correct position in the tree and labelled with your workload name. The tool validates your input and will refuse to map a CIDR that:

- is larger than (has a shorter prefix than) the root network,
- falls outside the root network's address range, or
- overlaps a subnet you have already allocated (tagged, labelled, or assigned to a workload account).

This lets you bring an existing allocation under tracking without re-deriving it split-by-split.

## Switching Cloud Provider

Click the cloud provider badge in the header to switch. You'll be asked whether to:
- **Keep address space** — preserves your subnet tree, recalculates reserved IPs for the new provider
- **Start over** — clears the plan entirely

## Saving and Loading

### URL Sharing

Your plan is automatically encoded in the URL hash. Copy the URL to share with colleagues — they'll see the exact same plan.

### JSON Export/Import

- **Export** — click the Export button to download your plan as a `.json` file
- **Import** — click Import and select a previously exported JSON file (max 5MB)

Importing a plan from a different cloud provider will switch to that provider automatically.

## Summary Panel

The right sidebar shows real-time stats:
- Total subnets (leaf count)
- Allocation percentage (how much of the root CIDR is allocated to leaves)
- Total usable IPs (accounting for provider-reserved addresses)
- Subnets by IaC tag
- Subnets by availability zone
- Workload account breakdown
- Provider subnet limit warnings

## Keyboard Navigation

- **Arrow Down/Up** — move between visible tree nodes
- **Arrow Right** — expand a collapsed node, or move to first child
- **Arrow Left** — collapse an expanded node, or move to parent
- **Home/End** — jump to first/last visible node
- **Enter/Space** — select the focused node

## Offline Use

The app works offline after the first load. All calculations run in your browser. No data is ever sent to any server.
