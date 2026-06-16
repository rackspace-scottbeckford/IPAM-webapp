/**
 * Translation strings for EN and DE.
 * The app title is always shown in English regardless of language selection.
 */

export type Language = 'en' | 'de';

export interface Translations {
  // General
  calculate: string;
  cancel: string;
  close: string;
  done: string;
  tryAgain: string;

  // Cloud selector
  selectCloudTitle: string;
  selectCloudDescription: string;
  aws: string;
  azure: string;
  gcp: string;
  stackit: string;
  privateCloud: string;

  // CIDR Input
  cidrPlaceholder: string;
  cidrLabel: string;
  prefixPlaceholder: string;
  prefixLabel: string;
  addressesUnit: string;

  // Subnet info
  networkAddress: string;
  broadcastAddress: string;
  subnetMask: string;
  usableHosts: string;

  // Tree operations
  split: string;
  join: string;
  maxDepthReached: string;
  joinNotAvailable: string;
  confirmJoinTitle: string;
  confirmJoinMessage: string;
  confirm: string;

  // Tags & workload
  assignTags: string;
  workloadAccount: string;
  availabilityZone: string;
  subnetLabel: string;
  onlyLeafSubnets: string;
  maxTagsReached: string;
  customTag: string;
  addCustomTag: string;

  // Create Workload
  createWorkload: string;
  createWorkloadTitle: string;
  createWorkloadDescription: string;
  workloadName: string;
  requiredUsableIPs: string;
  reservedPerSubnet: string;
  suggestedAllocation: string;
  suggestedPrefix: string;
  totalAddresses: string;
  usableAddresses: string;
  surplus: string;
  extraUsableIPs: string;
  allocateSubnet: string;
  cannotCreateWorkload: string;
  workloadCreated: string;
  allocatedSubnetFor: string;
  selectCloudFirst: string;

  // Summary panel
  summaryTitle: string;
  totalSubnets: string;
  subnetsByTag: string;
  subnetsByAZ: string;
  allocationPercentage: string;
  totalUsableIPs: string;
  perAccount: string;
  limitWarning: string;
  allocated: string;
  unallocated: string;

  // File controls
  exportJSON: string;
  importJSON: string;
  fileTooLarge: string;
  importFailed: string;
  importSuccess: string;

  // Views
  treeView: string;
  groupedView: string;
  collapseAll: string;
  expandAll: string;

  // Cloud change
  changeCloudTitle: string;
  selectNewCloud: string;
  keepAddressSpace: string;
  startOver: string;
  switchToCloud: string;

  // Warnings
  vpcSizeWarning: string;
  dockerConflictWarning: string;
  rfc1918Warning: string;
  adjustedNotification: string;

  // Language
  language: string;
}

export const en: Translations = {
  calculate: 'Calculate',
  cancel: 'Cancel',
  close: 'Close',
  done: 'Done',
  tryAgain: 'Try Again',

  selectCloudTitle: 'Select Your Target Cloud',
  selectCloudDescription: 'Choose the cloud platform you are planning for. This determines available use-case tags, reserved IP rules, and subnet limits.',
  aws: 'Amazon Web Services',
  azure: 'Microsoft Azure',
  gcp: 'Google Cloud Platform',
  stackit: 'STACKIT Cloud',
  privateCloud: 'Private Cloud',

  cidrPlaceholder: 'e.g., 10.0.0.0/16',
  cidrLabel: 'Network address in CIDR notation',
  prefixPlaceholder: '/prefix',
  prefixLabel: 'CIDR prefix length selector',
  addressesUnit: 'addr',

  networkAddress: 'Network Address',
  broadcastAddress: 'Broadcast Address',
  subnetMask: 'Subnet Mask',
  usableHosts: 'Usable Hosts',

  split: 'Split',
  join: 'Join',
  maxDepthReached: 'Maximum split depth reached',
  joinNotAvailable: 'Children must both be leaf subnets to join',
  confirmJoinTitle: 'Confirm Join',
  confirmJoinMessage: 'Joining will discard all tags, workload accounts, and labels on the child subnets. Continue?',
  confirm: 'Confirm',

  assignTags: 'Assign Tags',
  workloadAccount: 'Workload Account',
  availabilityZone: 'Availability Zone',
  subnetLabel: 'Subnet Label',
  onlyLeafSubnets: 'Only leaf subnets can be tagged',
  maxTagsReached: 'Maximum 5 tags per subnet',
  customTag: 'Custom Tag',
  addCustomTag: 'Add Custom Tag',

  createWorkload: '+ Create Workload',
  createWorkloadTitle: 'Create Workload',
  createWorkloadDescription: 'Enter a workload name and how many usable IP addresses you need. The tool will suggest the smallest suitable subnet.',
  workloadName: 'Workload Name',
  requiredUsableIPs: 'Required Usable IPs',
  reservedPerSubnet: 'reserves {count} IPs per subnet',
  suggestedAllocation: 'Suggested Allocation',
  suggestedPrefix: 'Suggested Prefix',
  totalAddresses: 'Total Addresses',
  usableAddresses: 'Usable Addresses',
  surplus: 'Surplus',
  extraUsableIPs: 'extra usable IPs',
  allocateSubnet: 'Allocate Subnet',
  cannotCreateWorkload: 'Cannot Create Workload',
  workloadCreated: 'Workload Created',
  allocatedSubnetFor: 'Allocated a /{prefix} subnet for "{name}".',
  selectCloudFirst: 'Select a cloud and enter a CIDR block first',

  summaryTitle: 'VPC Planning Summary',
  totalSubnets: 'Total Subnets',
  subnetsByTag: 'Subnets by Tag',
  subnetsByAZ: 'Subnets by AZ',
  allocationPercentage: 'Allocation',
  totalUsableIPs: 'Total Usable IPs',
  perAccount: 'Per Account',
  limitWarning: 'Subnet limit exceeded: {current}/{max} ({provider})',
  allocated: 'Allocated',
  unallocated: 'Unallocated',

  exportJSON: 'Export JSON',
  importJSON: 'Import JSON',
  fileTooLarge: 'File exceeds 5 MB limit',
  importFailed: 'Import failed',
  importSuccess: 'Plan imported successfully',

  treeView: 'Tree',
  groupedView: 'Grouped',
  collapseAll: 'Collapse All',
  expandAll: 'Expand All',

  changeCloudTitle: 'Change Cloud Provider',
  selectNewCloud: 'Select a new cloud provider:',
  keepAddressSpace: 'Keep address space',
  startOver: 'Start over',
  switchToCloud: 'Switch to',

  vpcSizeWarning: 'Note: In {provider} the largest allowable IPv4 CIDR block size within a VPC is /{prefix}. This root CIDR block will need to be split across multiple VPCs.',
  dockerConflictWarning: 'Warning: The 172.17.0.0/16 range conflicts with the default Docker bridge network (docker0). AWS recommends avoiding this CIDR block to prevent routing issues with containerized workloads.',
  rfc1918Warning: 'Warning: This address is outside RFC 1918 private space (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16). Cloud VPCs typically use private addresses.',
  adjustedNotification: 'Adjusted to network address: {corrected} (entered: {entered})',

  language: 'Language',
};

export const de: Translations = {
  calculate: 'Berechnen',
  cancel: 'Abbrechen',
  close: 'Schließen',
  done: 'Fertig',
  tryAgain: 'Erneut versuchen',

  selectCloudTitle: 'Ziel-Cloud auswählen',
  selectCloudDescription: 'Wählen Sie die Cloud-Plattform, für die Sie planen. Dies bestimmt verfügbare Use-Case-Tags, reservierte IP-Regeln und Subnetz-Limits.',
  aws: 'Amazon Web Services',
  azure: 'Microsoft Azure',
  gcp: 'Google Cloud Platform',
  stackit: 'STACKIT Cloud',
  privateCloud: 'Private Cloud',

  cidrPlaceholder: 'z.B. 10.0.0.0/16',
  cidrLabel: 'Netzwerkadresse in CIDR-Notation',
  prefixPlaceholder: '/Präfix',
  prefixLabel: 'CIDR-Präfixlängen-Auswahl',
  addressesUnit: 'Adr.',

  networkAddress: 'Netzwerkadresse',
  broadcastAddress: 'Broadcast-Adresse',
  subnetMask: 'Subnetzmaske',
  usableHosts: 'Nutzbare Hosts',

  split: 'Teilen',
  join: 'Zusammenführen',
  maxDepthReached: 'Maximale Teilungstiefe erreicht',
  joinNotAvailable: 'Beide Kinder müssen Blatt-Subnetze sein',
  confirmJoinTitle: 'Zusammenführung bestätigen',
  confirmJoinMessage: 'Beim Zusammenführen werden alle Tags, Workload-Konten und Labels der Kind-Subnetze verworfen. Fortfahren?',
  confirm: 'Bestätigen',

  assignTags: 'Tags zuweisen',
  workloadAccount: 'Workload-Konto',
  availabilityZone: 'Verfügbarkeitszone',
  subnetLabel: 'Subnetz-Label',
  onlyLeafSubnets: 'Nur Blatt-Subnetze können getaggt werden',
  maxTagsReached: 'Maximal 5 Tags pro Subnetz',
  customTag: 'Benutzerdefinierter Tag',
  addCustomTag: 'Benutzerdefinierten Tag hinzufügen',

  createWorkload: '+ Workload erstellen',
  createWorkloadTitle: 'Workload erstellen',
  createWorkloadDescription: 'Geben Sie einen Workload-Namen und die Anzahl benötigter nutzbarer IP-Adressen ein. Das Tool schlägt das kleinste geeignete Subnetz vor.',
  workloadName: 'Workload-Name',
  requiredUsableIPs: 'Benötigte nutzbare IPs',
  reservedPerSubnet: 'reserviert {count} IPs pro Subnetz',
  suggestedAllocation: 'Vorgeschlagene Zuweisung',
  suggestedPrefix: 'Vorgeschlagenes Präfix',
  totalAddresses: 'Gesamtadressen',
  usableAddresses: 'Nutzbare Adressen',
  surplus: 'Überschuss',
  extraUsableIPs: 'zusätzliche nutzbare IPs',
  allocateSubnet: 'Subnetz zuweisen',
  cannotCreateWorkload: 'Workload kann nicht erstellt werden',
  workloadCreated: 'Workload erstellt',
  allocatedSubnetFor: 'Ein /{prefix} Subnetz für „{name}" zugewiesen.',
  selectCloudFirst: 'Wählen Sie zuerst eine Cloud und geben Sie einen CIDR-Block ein',

  summaryTitle: 'VPC-Planungsübersicht',
  totalSubnets: 'Subnetze gesamt',
  subnetsByTag: 'Subnetze nach Tag',
  subnetsByAZ: 'Subnetze nach AZ',
  allocationPercentage: 'Zuweisung',
  totalUsableIPs: 'Nutzbare IPs gesamt',
  perAccount: 'Pro Konto',
  limitWarning: 'Subnetz-Limit überschritten: {current}/{max} ({provider})',
  allocated: 'Zugewiesen',
  unallocated: 'Nicht zugewiesen',

  exportJSON: 'JSON exportieren',
  importJSON: 'JSON importieren',
  fileTooLarge: 'Datei überschreitet 5 MB Grenze',
  importFailed: 'Import fehlgeschlagen',
  importSuccess: 'Plan erfolgreich importiert',

  treeView: 'Baum',
  groupedView: 'Gruppiert',
  collapseAll: 'Alle einklappen',
  expandAll: 'Alle ausklappen',

  changeCloudTitle: 'Cloud-Anbieter wechseln',
  selectNewCloud: 'Neuen Cloud-Anbieter auswählen:',
  keepAddressSpace: 'Adressraum beibehalten',
  startOver: 'Neu beginnen',
  switchToCloud: 'Wechseln zu',

  vpcSizeWarning: 'Hinweis: In {provider} ist die größte zulässige IPv4-CIDR-Blockgröße innerhalb eines VPCs /{prefix}. Dieser Root-CIDR-Block muss auf mehrere VPCs aufgeteilt werden.',
  dockerConflictWarning: 'Warnung: Der Bereich 172.17.0.0/16 steht in Konflikt mit dem Standard-Docker-Bridge-Netzwerk (docker0). AWS empfiehlt, diesen CIDR-Block zu vermeiden, um Routing-Probleme mit containerisierten Workloads zu verhindern.',
  rfc1918Warning: 'Warnung: Diese Adresse liegt außerhalb des RFC 1918 privaten Adressraums (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16). Cloud-VPCs verwenden typischerweise private Adressen.',
  adjustedNotification: 'Auf Netzwerkadresse angepasst: {corrected} (eingegeben: {entered})',

  language: 'Sprache',
};

const translations: Record<Language, Translations> = { en, de };

export function getTranslations(lang: Language): Translations {
  return translations[lang];
}
