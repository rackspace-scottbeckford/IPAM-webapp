import type { TargetCloud } from '../../core/types';
import styles from './CloudIcons.module.css';

/**
 * Mapping of use-case tag names to their corresponding icon type.
 * Used to display cloud-provider-specific icons next to tags.
 * Requirement 12.3
 */
const TAG_ICON_MAP: Record<string, IconType> = {
  // AWS tags
  'transit-gateway': 'gateway',
  'inspection': 'shield',
  'vpn-routing': 'lock',
  'egress': 'arrow-up',
  // Azure tags
  'hub-vnet': 'network',
  'spoke-vnet': 'network',
  'vpn-gateway': 'lock',
  'firewall': 'shield',
  // GCP tags
  'shared-vpc-host': 'network',
  'shared-vpc-service': 'network',
  'interconnect': 'gateway',
  // Common tags
  'workload': 'server',
  'shared-services': 'share',
  'core-network': 'network',
  'dmz': 'shield',
  'management': 'settings',
};

type IconType = 'gateway' | 'shield' | 'lock' | 'network' | 'server' | 'share' | 'arrow-up' | 'settings' | 'cloud';

/**
 * Returns the icon type for a given tag name, or null if no icon is mapped.
 */
export function getTagIconType(tagName: string): IconType | null {
  return TAG_ICON_MAP[tagName] ?? null;
}

/**
 * Props for the TagIcon component.
 */
interface TagIconProps {
  /** The use-case tag name to display an icon for */
  tagName: string;
  /** Optional size in pixels (default 16) */
  size?: number;
  /** Optional color override (defaults to currentColor) */
  color?: string;
  /** Optional className */
  className?: string;
}

/**
 * Displays a cloud-provider-specific icon next to a use-case tag.
 * Returns null if no icon is mapped for the given tag name.
 *
 * Requirement 12.3: Display cloud-provider-specific icons next to Use_Case_Tags
 */
export function TagIcon({ tagName, size = 16, color, className }: TagIconProps) {
  const iconType = getTagIconType(tagName);
  if (!iconType) return null;

  return (
    <span className={`${styles.tagIcon} ${className ?? ''}`} aria-hidden="true">
      <IconSvg type={iconType} size={size} color={color} />
    </span>
  );
}

/**
 * Props for cloud provider icon components.
 */
interface CloudProviderIconProps {
  /** The cloud provider to display an icon for */
  cloud: TargetCloud;
  /** Optional size in pixels (default 24) */
  size?: number;
  /** Optional custom icon data URI for Private Cloud */
  customIcon?: string | null;
  /** Optional className */
  className?: string;
}

/**
 * Displays the cloud provider icon (inline SVG).
 * For Private Cloud, shows a generic cloud icon or a custom uploaded icon.
 *
 * Requirement 12.1, 12.7
 */
export function CloudProviderIcon({ cloud, size = 24, customIcon, className }: CloudProviderIconProps) {
  if (cloud === 'private' && customIcon) {
    return (
      <img
        src={customIcon}
        alt="Private Cloud"
        width={size}
        height={size}
        className={`${styles.providerIcon} ${className ?? ''}`}
      />
    );
  }

  return (
    <span className={`${styles.providerIcon} ${className ?? ''}`} aria-hidden="true">
      {cloud === 'aws' && <AwsIcon size={size} />}
      {cloud === 'azure' && <AzureIcon size={size} />}
      {cloud === 'gcp' && <GcpIcon size={size} />}
      {cloud === 'private' && <CloudIcon size={size} />}
    </span>
  );
}

// === Individual Icon SVGs ===

function IconSvg({ type, size = 16, color }: { type: IconType; size?: number; color?: string }) {
  const fill = color ?? 'currentColor';

  switch (type) {
    case 'gateway':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <path d="M2 8h4M10 8h4M8 2v4M8 10v4" stroke={fill} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="8" r="2.5" stroke={fill} strokeWidth="1.5" />
        </svg>
      );
    case 'shield':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <path
            d="M8 1.5L3 3.5v4c0 3.5 2.5 5.5 5 6.5 2.5-1 5-3 5-6.5v-4L8 1.5z"
            stroke={fill}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'lock':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <rect x="4" y="7" width="8" height="6" rx="1" stroke={fill} strokeWidth="1.5" />
          <path d="M6 7V5a2 2 0 014 0v2" stroke={fill} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'network':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="3" r="1.5" stroke={fill} strokeWidth="1.2" />
          <circle cx="4" cy="12" r="1.5" stroke={fill} strokeWidth="1.2" />
          <circle cx="12" cy="12" r="1.5" stroke={fill} strokeWidth="1.2" />
          <path d="M8 4.5v3M6.5 9l-1.5 2M9.5 9l1.5 2" stroke={fill} strokeWidth="1.2" />
          <circle cx="8" cy="8.5" r="1" fill={fill} />
        </svg>
      );
    case 'server':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <rect x="3" y="2" width="10" height="5" rx="1" stroke={fill} strokeWidth="1.3" />
          <rect x="3" y="9" width="10" height="5" rx="1" stroke={fill} strokeWidth="1.3" />
          <circle cx="5.5" cy="4.5" r="0.75" fill={fill} />
          <circle cx="5.5" cy="11.5" r="0.75" fill={fill} />
        </svg>
      );
    case 'share':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <circle cx="12" cy="3.5" r="2" stroke={fill} strokeWidth="1.2" />
          <circle cx="4" cy="8" r="2" stroke={fill} strokeWidth="1.2" />
          <circle cx="12" cy="12.5" r="2" stroke={fill} strokeWidth="1.2" />
          <path d="M5.8 7l4.4-2.5M5.8 9l4.4 2.5" stroke={fill} strokeWidth="1.2" />
        </svg>
      );
    case 'arrow-up':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <path d="M8 13V3M4 7l4-4 4 4" stroke={fill} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'settings':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="2" stroke={fill} strokeWidth="1.3" />
          <path
            d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"
            stroke={fill}
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'cloud':
      return <CloudIconSvg size={size} color={fill} />;
  }
}

function CloudIconSvg({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path
        d="M4.5 12h7a3 3 0 001-5.83A4.5 4.5 0 004 7.5 2.5 2.5 0 004.5 12z"
        stroke={color}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// === Cloud Provider Icons (simplified inline SVGs) ===

function AwsIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M8.5 14.5c0 1.5 1.5 3 4 3s5-1.5 5-3" stroke="#FF9900" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6.5 12.5c0 1.5 2 3.5 5.5 3.5s6.5-2 6.5-3.5" stroke="#FF9900" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 8l2.5 6h1L12 10l1.5 4h1L17 8" stroke="#252F3E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AzureIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 18l5-14h2l-3 8h6l-10 6z" fill="#0078D4" />
    </svg>
  );
}

function GcpIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M14.5 6h-5L7 10.5l2.5 4.5h5l2.5-4.5L14.5 6z" stroke="#4285F4" strokeWidth="1.5" />
      <circle cx="12" cy="5" r="1.5" fill="#EA4335" />
      <circle cx="7.5" cy="13" r="1.5" fill="#34A853" />
      <circle cx="16.5" cy="13" r="1.5" fill="#FBBC04" />
    </svg>
  );
}

function CloudIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M6 18h12a4 4 0 001.5-7.71A6 6 0 006.2 11 3.5 3.5 0 006 18z"
        stroke="#6B7280"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// === Custom Icon Upload ===

/**
 * Maximum file size for custom Private Cloud icon (100KB).
 */
const MAX_ICON_SIZE_BYTES = 100 * 1024;

/**
 * Maximum dimensions for custom icon (64x64 pixels).
 */
const MAX_ICON_DIMENSION = 64;

/**
 * Accepted MIME types for custom icon upload.
 */
const ACCEPTED_TYPES = ['image/svg+xml', 'image/png'];

/**
 * Result of custom icon validation.
 */
export interface IconValidationResult {
  valid: boolean;
  dataUri?: string;
  error?: string;
}

/**
 * Validates and processes a custom icon file for Private Cloud.
 * Checks: file type (SVG/PNG), file size (≤100KB), dimensions (64x64 max).
 *
 * Requirement 12.7: Allow custom icon upload (SVG or PNG, max 64x64, max 100KB)
 */
export async function validateCustomIcon(file: File): Promise<IconValidationResult> {
  // Check file type
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return { valid: false, error: 'Unsupported format. Please upload an SVG or PNG file.' };
  }

  // Check file size
  if (file.size > MAX_ICON_SIZE_BYTES) {
    return { valid: false, error: `File exceeds 100KB limit (${Math.round(file.size / 1024)}KB).` };
  }

  // Read file as data URI
  const dataUri = await readFileAsDataUri(file);

  // For PNG, validate dimensions
  if (file.type === 'image/png') {
    const dimensions = await getImageDimensions(dataUri);
    if (dimensions.width > MAX_ICON_DIMENSION || dimensions.height > MAX_ICON_DIMENSION) {
      return {
        valid: false,
        error: `Image dimensions (${dimensions.width}×${dimensions.height}) exceed 64×64 maximum.`,
      };
    }
  }

  return { valid: true, dataUri };
}

/**
 * Reads a File as a data URI string.
 */
function readFileAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Gets the dimensions of an image from its data URI.
 */
function getImageDimensions(dataUri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUri;
  });
}

/**
 * Props for the CustomIconUpload component.
 */
interface CustomIconUploadProps {
  /** Current custom icon data URI (if any) */
  currentIcon?: string | null;
  /** Callback when a valid icon is uploaded */
  onIconChange: (dataUri: string | null) => void;
}

/**
 * File input component for uploading a custom Private Cloud icon.
 * Validates file type (SVG/PNG), size (≤100KB), and dimensions (64×64 max).
 *
 * Requirement 12.7
 */
export function CustomIconUpload({ currentIcon, onIconChange }: CustomIconUploadProps) {
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await validateCustomIcon(file);
    if (result.valid && result.dataUri) {
      onIconChange(result.dataUri);
    } else {
      // Reset the input
      e.target.value = '';
      alert(result.error ?? 'Invalid file');
    }
  };

  const handleRemove = () => {
    onIconChange(null);
  };

  return (
    <div className={styles.customIconUpload}>
      <label className={styles.uploadLabel}>
        Custom Icon
        <span className={styles.uploadHint}>(SVG/PNG, 64×64 max, 100KB max)</span>
      </label>
      <div className={styles.uploadRow}>
        {currentIcon && (
          <img
            src={currentIcon}
            alt="Custom cloud icon"
            className={styles.iconPreview}
            width={32}
            height={32}
          />
        )}
        <input
          type="file"
          accept=".svg,.png,image/svg+xml,image/png"
          onChange={handleFileChange}
          className={styles.fileInput}
          aria-label="Upload custom Private Cloud icon"
        />
        {currentIcon && (
          <button
            type="button"
            onClick={handleRemove}
            className={styles.removeButton}
            aria-label="Remove custom icon"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
