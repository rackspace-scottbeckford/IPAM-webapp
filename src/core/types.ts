// === IP Arithmetic ===

/**
 * Represents an IPv4 address as a 32-bit unsigned integer.
 */
export interface IPv4Address {
  /** 32-bit unsigned integer representation */
  readonly bits: number;
}

/**
 * Represents a CIDR block with a network address and prefix length.
 */
export interface CIDRBlock {
  readonly networkAddress: IPv4Address;
  /** Prefix length, valid range: 8–30 */
  readonly prefixLength: number;
}

/**
 * Computed subnet information including address details and host counts.
 */
export interface SubnetInfo {
  readonly cidr: CIDRBlock;
  /** Network address in dotted-decimal notation */
  readonly networkAddress: string;
  /** Broadcast address in dotted-decimal notation */
  readonly broadcastAddress: string;
  /** Subnet mask in dotted-decimal notation */
  readonly subnetMask: string;
  /** Total number of addresses in the subnet (2^(32-prefix)) */
  readonly totalAddresses: number;
  /** Usable hosts after provider reservations */
  readonly usableHosts: number;
  /** Number of reserved addresses for the active provider */
  readonly reservedCount: number;
}

// === Subnet Tree ===

/**
 * A node in the subnet binary tree hierarchy.
 */
export interface SubnetNode {
  /** Unique identifier for this node */
  readonly id: string;
  readonly cidr: CIDRBlock;
  /** Two children if split, null if leaf */
  readonly children: readonly [SubnetNode, SubnetNode] | null;
  /** 0–5 tags, leaf only */
  readonly tags: readonly UseCaseTag[];
  /** Workload account identifier (1–64 chars), leaf only */
  readonly workloadAccount: string | null;
  /** Availability zone identifier (up to 64 chars), leaf only */
  readonly availabilityZone: string | null;
  /** Descriptive label (1–64 chars), leaf only */
  readonly label: string | null;
}

/**
 * A use-case tag classifying a subnet's purpose.
 */
export type UseCaseTag = {
  readonly id: string;
  /** Tag name, 1–32 characters */
  readonly name: string;
  /** Whether this is a user-defined custom tag */
  readonly isCustom: boolean;
  /** Hex color code (e.g., '#FF9900') */
  readonly color: string;
};

// === Cloud Provider Profile ===

/**
 * Supported target cloud platforms.
 */
export type TargetCloud = 'aws' | 'azure' | 'gcp' | 'private';

/**
 * Configuration defining reserved IPs, subnet limits, and available tags for a cloud provider.
 */
export interface CloudProviderProfile {
  readonly cloudId: TargetCloud;
  readonly displayName: string;
  /** Number of reserved IP addresses per subnet */
  readonly reservedIPs: number;
  /** Reasons for each reserved IP address */
  readonly reservedReasons: readonly string[];
  /** Maximum subnets per VPC/VNet */
  readonly subnetLimit: number;
  /** Minimum subnet prefix (max split depth) — e.g., 28 means can't split smaller than /28 */
  readonly minSubnetPrefix: number;
  /** Maximum VPC/VNet prefix — larger blocks show a warning (e.g., 16 for AWS) */
  readonly maxVpcPrefix: number;
  /** Default use-case tags for this provider */
  readonly defaultTags: readonly UseCaseTag[];
  /** Cloud-specific accent color (hex) */
  readonly accentColor: string;
  /** Path to the cloud provider icon */
  readonly iconPath: string;
}

// === Network Plan (Serializable State) ===

/**
 * A saved arrangement of subnets, tags, and cloud metadata representing a user's IP allocation design.
 */
export interface NetworkPlan {
  /** Schema version for forward compatibility */
  readonly version: number;
  readonly targetCloud: TargetCloud;
  readonly rootCIDR: CIDRBlock;
  readonly tree: SubnetNode;
  /** User-defined custom tags */
  readonly customTags: readonly UseCaseTag[];
  /** Custom reservation count for private cloud (2–10) */
  readonly privateCloudReservedCount?: number;
  /** Custom icon for private cloud (data URI) */
  readonly privateCloudIcon?: string;
}

// === Branding ===

/**
 * White-label branding configuration for the application.
 */
export interface BrandingConfiguration {
  /** Logo image URL (SVG, PNG, or JPEG, max 500KB) */
  readonly logoUrl: string | null;
  /** Primary brand color (hex) */
  readonly primaryColor: string;
  /** Secondary brand color (hex) */
  readonly secondaryColor: string;
  /** Application title (up to 64 chars) */
  readonly title: string;
  /** Favicon URL (ICO or PNG, 16x16 or 32x32) */
  readonly faviconUrl: string | null;
}

// === Summary ===

/**
 * VPC planning summary with subnet counts, IP totals, and provider limit checks.
 */
export interface VPCSummary {
  readonly totalSubnets: number;
  readonly subnetsByTag: ReadonlyMap<string, number>;
  readonly subnetsByAZ: ReadonlyMap<string, number>;
  readonly totalUsableIPs: number;
  /** Percentage of root CIDR allocated to leaf subnets (0–100, 1 decimal) */
  readonly allocationPercentage: number;
  readonly accountBreakdown: readonly AccountAllocation[];
  readonly limitWarning: LimitWarning | null;
}

/**
 * Address allocation breakdown per workload account.
 */
export interface AccountAllocation {
  readonly account: string;
  readonly subnetCount: number;
  readonly usableIPs: number;
  readonly percentageOfTotal: number;
}

/**
 * Warning when subnet count exceeds provider limit.
 */
export interface LimitWarning {
  readonly currentCount: number;
  readonly maxAllowed: number;
  readonly providerName: string;
}

// === Errors ===

/**
 * Error returned when serialization/deserialization fails.
 */
export interface SerializationError {
  readonly type: 'invalid_format' | 'invalid_data' | 'size_exceeded';
  readonly message: string;
  readonly details?: string;
}

/**
 * Error returned when a split operation cannot be performed.
 */
export type SplitError = {
  readonly type: 'max_depth';
  readonly message: string;
};

/**
 * Error returned when a join operation cannot be performed.
 */
export type JoinError = {
  readonly type: 'not_leaf_children' | 'has_assignments';
  readonly message: string;
};

/**
 * Error returned when a tag assignment fails.
 */
export type TagError = {
  readonly type: 'not_leaf' | 'max_tags';
  readonly message: string;
};

// === Validation ===

/**
 * Result of CIDR input validation.
 */
export type ValidationResult =
  | { readonly valid: true; readonly cidr: CIDRBlock }
  | { readonly valid: false; readonly error: ValidationError };

/**
 * Specific validation error classification for CIDR input.
 */
export type ValidationError = {
  readonly type: 'malformed_format' | 'octet_out_of_range' | 'prefix_out_of_range' | 'missing_prefix';
  readonly message: string;
};
