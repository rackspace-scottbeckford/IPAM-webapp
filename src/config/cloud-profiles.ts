import type { CloudProviderProfile, TargetCloud, UseCaseTag } from '../core/types';

export const AWS_PROFILE: CloudProviderProfile = {
  cloudId: 'aws',
  displayName: 'Amazon Web Services',
  reservedIPs: 5,
  reservedReasons: ['Network address', 'VPC router', 'DNS server', 'Future use', 'Broadcast'],
  subnetLimit: 200,
  minSubnetPrefix: 28,
  maxVpcPrefix: 16,
  defaultTags: [
    { id: 'aws-tgw', name: 'transit-gateway', isCustom: false, color: '#FF9900' },
    { id: 'aws-insp', name: 'inspection', isCustom: false, color: '#D13212' },
    { id: 'aws-vpn', name: 'vpn-routing', isCustom: false, color: '#1B660F' },
    { id: 'aws-wl', name: 'workload', isCustom: false, color: '#2E73B8' },
    { id: 'aws-ss', name: 'shared-services', isCustom: false, color: '#8C4FFF' },
    { id: 'aws-eg', name: 'egress', isCustom: false, color: '#E07941' },
  ],
  accentColor: '#FF9900',
  iconPath: 'icons/aws logo.png',
};

export const AZURE_PROFILE: CloudProviderProfile = {
  cloudId: 'azure',
  displayName: 'Microsoft Azure',
  reservedIPs: 5,
  reservedReasons: ['Network address', 'Default gateway', 'Azure DNS (primary)', 'Azure DNS (secondary)', 'Broadcast'],
  subnetLimit: 3000,
  minSubnetPrefix: 29,
  maxVpcPrefix: 8,
  defaultTags: [
    { id: 'az-hub', name: 'hub-vnet', isCustom: false, color: '#0078D4' },
    { id: 'az-spoke', name: 'spoke-vnet', isCustom: false, color: '#50E6FF' },
    { id: 'az-vpn', name: 'vpn-gateway', isCustom: false, color: '#773ADC' },
    { id: 'az-fw', name: 'firewall', isCustom: false, color: '#E3008C' },
    { id: 'az-wl', name: 'workload', isCustom: false, color: '#00B7C3' },
    { id: 'az-ss', name: 'shared-services', isCustom: false, color: '#FFB900' },
  ],
  accentColor: '#0078D4',
  iconPath: 'icons/azure logo.jpeg',
};

export const GCP_PROFILE: CloudProviderProfile = {
  cloudId: 'gcp',
  displayName: 'Google Cloud Platform',
  reservedIPs: 4,
  reservedReasons: ['Network address', 'Default gateway', 'Reserved (second-to-last)', 'Broadcast'],
  subnetLimit: 300,
  minSubnetPrefix: 29,
  maxVpcPrefix: 8,
  defaultTags: [
    { id: 'gcp-host', name: 'shared-vpc-host', isCustom: false, color: '#4285F4' },
    { id: 'gcp-svc', name: 'shared-vpc-service', isCustom: false, color: '#34A853' },
    { id: 'gcp-ic', name: 'interconnect', isCustom: false, color: '#FBBC04' },
    { id: 'gcp-wl', name: 'workload', isCustom: false, color: '#EA4335' },
    { id: 'gcp-ss', name: 'shared-services', isCustom: false, color: '#A142F4' },
  ],
  accentColor: '#4285F4',
  iconPath: 'icons/GCP logo.png',
};

export const PRIVATE_PROFILE: CloudProviderProfile = {
  cloudId: 'private',
  displayName: 'Private Cloud',
  reservedIPs: 2,
  reservedReasons: ['Network address', 'Broadcast'],
  subnetLimit: Infinity,
  minSubnetPrefix: 30,
  maxVpcPrefix: 8,
  defaultTags: [
    { id: 'priv-core', name: 'core-network', isCustom: false, color: '#6B7280' },
    { id: 'priv-dmz', name: 'dmz', isCustom: false, color: '#EF4444' },
    { id: 'priv-wl', name: 'workload', isCustom: false, color: '#3B82F6' },
    { id: 'priv-mgmt', name: 'management', isCustom: false, color: '#10B981' },
  ],
  accentColor: '#6B7280',
  iconPath: 'icons/private-cloud.svg',
};

export const STACKIT_PROFILE: CloudProviderProfile = {
  cloudId: 'stackit',
  displayName: 'STACKIT Cloud',
  reservedIPs: 4,
  reservedReasons: ['Network address', 'Gateway', 'DHCP agent', 'Broadcast'],
  subnetLimit: 500,
  minSubnetPrefix: 29,
  maxVpcPrefix: 8,
  defaultTags: [
    { id: 'stackit-wl', name: 'workload', isCustom: false, color: '#1A5C5C' },
    { id: 'stackit-mgmt', name: 'management', isCustom: false, color: '#2D8A8A' },
    { id: 'stackit-db', name: 'database', isCustom: false, color: '#14B8A6' },
    { id: 'stackit-k8s', name: 'kubernetes', isCustom: false, color: '#326CE5' },
    { id: 'stackit-ss', name: 'shared-services', isCustom: false, color: '#7C3AED' },
    { id: 'stackit-lb', name: 'load-balancer', isCustom: false, color: '#F59E0B' },
  ],
  accentColor: '#1A5C5C',
  iconPath: 'icons/stackit-logo.svg',
};

/**
 * Returns the CloudProviderProfile for the given target cloud.
 */
export function getProfile(cloud: TargetCloud): CloudProviderProfile {
  switch (cloud) {
    case 'aws':
      return AWS_PROFILE;
    case 'azure':
      return AZURE_PROFILE;
    case 'gcp':
      return GCP_PROFILE;
    case 'stackit':
      return STACKIT_PROFILE;
    case 'private':
      return PRIVATE_PROFILE;
  }
}

/**
 * Returns the full set of available tags for a profile: the profile's default tags
 * combined with any user-defined custom tags.
 */
export function getAvailableTags(profile: CloudProviderProfile, customTags: UseCaseTag[]): UseCaseTag[] {
  return [...profile.defaultTags, ...customTags];
}
