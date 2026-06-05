import type { NetworkPlan, SubnetNode, CIDRBlock, UseCaseTag, TargetCloud, SerializationError } from '../core/types';
import { numberToIp, ipToNumber } from '../core/subnet-calculator';
import { getProfile } from '../config/cloud-profiles';
import { getLeaves } from '../core/tree-operations';

/** Current schema version for serialized plans */
const CURRENT_VERSION = 1;

/** Maximum allowed JSON size in bytes (5 MB) */
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

/** Valid target cloud values */
const VALID_CLOUDS: readonly TargetCloud[] = ['aws', 'azure', 'gcp', 'private'];

// === Serialization Helpers ===

/**
 * Convert a CIDRBlock to a human-readable string (e.g., "10.0.0.0/16").
 */
function cidrToString(cidr: CIDRBlock): string {
  return `${numberToIp(cidr.networkAddress.bits)}/${cidr.prefixLength}`;
}

/**
 * Parse a CIDR string (e.g., "10.0.0.0/16") back into a CIDRBlock.
 * Returns null if the format is invalid.
 */
function stringToCIDR(str: string): CIDRBlock | null {
  if (typeof str !== 'string') return null;
  const match = str.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/);
  if (!match) return null;

  const [, ip, prefixStr] = match;
  const prefix = parseInt(prefixStr, 10);
  if (prefix < 8 || prefix > 30) return null;

  const octets = ip.split('.').map(Number);
  if (octets.some((o) => o < 0 || o > 255 || !Number.isInteger(o))) return null;

  const bits = ipToNumber(ip);
  return { networkAddress: { bits }, prefixLength: prefix };
}

/**
 * Serialize a SubnetNode tree to a plain JSON-friendly object.
 */
function serializeTree(node: SubnetNode): unknown {
  return {
    id: node.id,
    cidr: cidrToString(node.cidr),
    children: node.children
      ? [serializeTree(node.children[0]), serializeTree(node.children[1])]
      : null,
    iacTags: node.tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      isCustom: tag.isCustom,
      color: tag.color,
    })),
    label: node.label,
    workloadAccount: node.workloadAccount,
    availabilityZone: node.availabilityZone,
  };
}

/**
 * Deserialize a plain object back into a SubnetNode.
 * Returns null if the structure is invalid.
 */
function deserializeTree(obj: unknown): SubnetNode | null {
  if (typeof obj !== 'object' || obj === null) return null;

  const node = obj as Record<string, unknown>;

  // Validate required fields
  if (typeof node.id !== 'string' || node.id.length === 0) return null;
  if (typeof node.cidr !== 'string') return null;

  const cidr = stringToCIDR(node.cidr as string);
  if (cidr === null) return null;

  // Validate children: must be null or an array of exactly 2
  let children: readonly [SubnetNode, SubnetNode] | null = null;
  if (node.children !== null && node.children !== undefined) {
    if (!Array.isArray(node.children) || node.children.length !== 2) return null;
    const left = deserializeTree(node.children[0]);
    const right = deserializeTree(node.children[1]);
    if (left === null || right === null) return null;
    children = [left, right] as const;
  }

  // Parse iacTags (with backward compat for 'tags' field from older exports)
  let tags: UseCaseTag[] = [];
  const rawTags = Array.isArray(node.iacTags) ? node.iacTags : (Array.isArray(node.tags) ? node.tags : []);
  if (rawTags.length > 5) return null;
  for (const t of rawTags) {
    if (typeof t !== 'object' || t === null) return null;
    const tag = t as Record<string, unknown>;
    if (typeof tag.id !== 'string' || tag.id.length === 0) return null;
    if (typeof tag.name !== 'string' || tag.name.length < 1 || tag.name.length > 32) return null;
    if (typeof tag.isCustom !== 'boolean') return null;
    if (typeof tag.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(tag.color)) return null;
    tags.push({ id: tag.id, name: tag.name, isCustom: tag.isCustom, color: tag.color });
  }

  // Validate optional string fields
  const workloadAccount = typeof node.workloadAccount === 'string' ? node.workloadAccount : null;
  const availabilityZone = typeof node.availabilityZone === 'string' ? node.availabilityZone : null;
  const label = typeof node.label === 'string' ? node.label : null;

  // Validate field lengths
  if (workloadAccount !== null && (workloadAccount.length < 1 || workloadAccount.length > 64)) return null;
  if (availabilityZone !== null && availabilityZone.length > 64) return null;
  if (label !== null && (label.length < 1 || label.length > 64)) return null;

  return {
    id: node.id,
    cidr,
    children,
    tags,
    workloadAccount,
    availabilityZone,
    label,
  };
}

/**
 * Validate the binary tree structure invariants:
 * - Every non-leaf node has exactly 2 children
 * - Children's prefix length = parent's prefix length + 1
 * - First child's network address = parent's network address
 * - Second child's network address = parent's network address + 2^(32 - child prefix)
 */
function validateTreeStructure(node: SubnetNode): boolean {
  if (node.children === null) {
    // Leaf node — valid
    return true;
  }

  const [left, right] = node.children;
  const expectedPrefix = node.cidr.prefixLength + 1;

  // Children must have prefix = parent prefix + 1
  if (left.cidr.prefixLength !== expectedPrefix) return false;
  if (right.cidr.prefixLength !== expectedPrefix) return false;

  // First child's network address must equal parent's
  if (left.cidr.networkAddress.bits !== node.cidr.networkAddress.bits) return false;

  // Second child's network address must equal parent's + offset
  const expectedSecondNetwork = (node.cidr.networkAddress.bits + Math.pow(2, 32 - expectedPrefix)) >>> 0;
  if (right.cidr.networkAddress.bits !== expectedSecondNetwork) return false;

  // Leaf nodes should not have children-only metadata issues
  // Tags should only be on leaf nodes
  if (node.tags.length > 0) return false;
  if (node.workloadAccount !== null) return false;
  if (node.availabilityZone !== null) return false;
  if (node.label !== null) return false;

  // Recursively validate children
  return validateTreeStructure(left) && validateTreeStructure(right);
}

// === Public API ===

/**
 * Serialize a NetworkPlan to a JSON string.
 * The output uses human-readable CIDR notation and includes a version field for forward compatibility.
 *
 * @param plan - The NetworkPlan to serialize
 * @returns A formatted JSON string
 */
export function toJSON(plan: NetworkPlan): string {
  const serializable = {
    version: CURRENT_VERSION,
    targetCloud: plan.targetCloud,
    rootCIDR: cidrToString(plan.rootCIDR),
    tree: serializeTree(plan.tree),
    customTags: plan.customTags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      isCustom: tag.isCustom,
      color: tag.color,
    })),
    ...(plan.privateCloudReservedCount !== undefined && { privateCloudReservedCount: plan.privateCloudReservedCount }),
    ...(plan.privateCloudIcon !== undefined && { privateCloudIcon: plan.privateCloudIcon }),
  };
  return JSON.stringify(serializable, null, 2);
}

/**
 * Deserialize a JSON string into a NetworkPlan.
 * Validates schema, enforces 5MB size limit, and checks tree structure integrity.
 *
 * @param json - The JSON string to parse
 * @returns A valid NetworkPlan, or a SerializationError describing the failure
 */
export function fromJSON(json: string): NetworkPlan | SerializationError {
  // Check size limit
  if (new TextEncoder().encode(json).length > MAX_SIZE_BYTES) {
    return { type: 'size_exceeded', message: 'File exceeds 5 MB size limit' };
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { type: 'invalid_format', message: 'Invalid JSON format' };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { type: 'invalid_format', message: 'JSON root must be an object' };
  }

  const data = parsed as Record<string, unknown>;

  // Validate version
  if (data.version !== CURRENT_VERSION) {
    return { type: 'invalid_data', message: `Unsupported version: ${data.version}. Expected ${CURRENT_VERSION}` };
  }

  // Validate targetCloud
  if (!VALID_CLOUDS.includes(data.targetCloud as TargetCloud)) {
    return { type: 'invalid_data', message: `Invalid targetCloud: "${data.targetCloud}". Must be one of: ${VALID_CLOUDS.join(', ')}` };
  }
  const targetCloud = data.targetCloud as TargetCloud;

  // Validate and load the corresponding cloud profile (ensures it's a known cloud)
  getProfile(targetCloud);

  // Validate rootCIDR
  if (typeof data.rootCIDR !== 'string') {
    return { type: 'invalid_data', message: 'rootCIDR must be a CIDR string (e.g., "10.0.0.0/16")' };
  }
  const rootCIDR = stringToCIDR(data.rootCIDR);
  if (rootCIDR === null) {
    return { type: 'invalid_data', message: `Invalid rootCIDR: "${data.rootCIDR}"` };
  }

  // Validate tree
  if (data.tree === undefined || data.tree === null) {
    return { type: 'invalid_data', message: 'Missing tree field' };
  }
  const tree = deserializeTree(data.tree);
  if (tree === null) {
    return { type: 'invalid_data', message: 'Invalid tree structure' };
  }

  // Validate tree structural integrity (binary tree invariants)
  if (!validateTreeStructure(tree)) {
    return { type: 'invalid_data', message: 'Tree structure violates binary subdivision invariants' };
  }

  // Validate tree root matches rootCIDR
  if (tree.cidr.networkAddress.bits !== rootCIDR.networkAddress.bits ||
      tree.cidr.prefixLength !== rootCIDR.prefixLength) {
    return { type: 'invalid_data', message: 'Tree root CIDR does not match rootCIDR' };
  }

  // Validate customTags
  let customTags: UseCaseTag[] = [];
  if (data.customTags !== undefined) {
    if (!Array.isArray(data.customTags)) {
      return { type: 'invalid_data', message: 'customTags must be an array' };
    }
    if (data.customTags.length > 20) {
      return { type: 'invalid_data', message: 'Maximum 20 custom tags allowed' };
    }
    for (const t of data.customTags) {
      if (typeof t !== 'object' || t === null) {
        return { type: 'invalid_data', message: 'Each custom tag must be an object' };
      }
      const tag = t as Record<string, unknown>;
      if (typeof tag.id !== 'string' || tag.id.length === 0) {
        return { type: 'invalid_data', message: 'Custom tag must have a non-empty id' };
      }
      if (typeof tag.name !== 'string' || tag.name.length < 1 || tag.name.length > 32) {
        return { type: 'invalid_data', message: 'Custom tag name must be 1–32 characters' };
      }
      if (typeof tag.isCustom !== 'boolean') {
        return { type: 'invalid_data', message: 'Custom tag must have a boolean isCustom field' };
      }
      if (typeof tag.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(tag.color)) {
        return { type: 'invalid_data', message: 'Custom tag must have a valid hex color (e.g., "#FF9900")' };
      }
      customTags.push({ id: tag.id, name: tag.name, isCustom: tag.isCustom, color: tag.color });
    }
  }

  // Validate privateCloudReservedCount (optional, only for private cloud)
  let privateCloudReservedCount: number | undefined;
  if (data.privateCloudReservedCount !== undefined) {
    if (typeof data.privateCloudReservedCount !== 'number' ||
        !Number.isInteger(data.privateCloudReservedCount) ||
        data.privateCloudReservedCount < 2 ||
        data.privateCloudReservedCount > 10) {
      return { type: 'invalid_data', message: 'privateCloudReservedCount must be an integer between 2 and 10' };
    }
    privateCloudReservedCount = data.privateCloudReservedCount;
  }

  // Validate privateCloudIcon (optional)
  let privateCloudIcon: string | undefined;
  if (data.privateCloudIcon !== undefined) {
    if (typeof data.privateCloudIcon !== 'string') {
      return { type: 'invalid_data', message: 'privateCloudIcon must be a string' };
    }
    privateCloudIcon = data.privateCloudIcon;
  }

  return {
    version: CURRENT_VERSION,
    targetCloud,
    rootCIDR,
    tree,
    customTags,
    ...(privateCloudReservedCount !== undefined && { privateCloudReservedCount }),
    ...(privateCloudIcon !== undefined && { privateCloudIcon }),
  };
}


// === URL Encoding Helpers ===

/**
 * Encode the tree structure as a bit string using depth-first traversal.
 * '1' = split (has children), '0' = leaf.
 */
function encodeTreeStructure(node: SubnetNode): string {
  if (node.children === null) {
    return '0';
  }
  return '1' + encodeTreeStructure(node.children[0]) + encodeTreeStructure(node.children[1]);
}

/**
 * Decode a bit string back into a tree structure.
 * Returns the reconstructed tree and the remaining unconsumed bit string.
 */
function decodeTreeStructure(
  bits: string,
  networkAddress: number,
  prefixLength: number,
  index: number
): { node: SubnetNode; nextIndex: number } | null {
  if (index >= bits.length) return null;

  const bit = bits[index];
  if (bit === '0') {
    // Leaf node
    const node: SubnetNode = {
      id: `url-node-${index}`,
      cidr: { networkAddress: { bits: networkAddress }, prefixLength },
      children: null,
      tags: [],
      workloadAccount: null,
      availabilityZone: null,
      label: null,
    };
    return { node, nextIndex: index + 1 };
  } else if (bit === '1') {
    // Split node — recurse into left and right children
    const childPrefix = prefixLength + 1;
    const leftNetwork = networkAddress;
    const secondOffset = Math.pow(2, 32 - childPrefix);
    const rightNetwork = (networkAddress + secondOffset) >>> 0;

    const leftResult = decodeTreeStructure(bits, leftNetwork, childPrefix, index + 1);
    if (leftResult === null) return null;

    const rightResult = decodeTreeStructure(bits, rightNetwork, childPrefix, leftResult.nextIndex);
    if (rightResult === null) return null;

    const node: SubnetNode = {
      id: `url-node-${index}`,
      cidr: { networkAddress: { bits: networkAddress }, prefixLength },
      children: [leftResult.node, rightResult.node],
      tags: [],
      workloadAccount: null,
      availabilityZone: null,
      label: null,
    };
    return { node, nextIndex: rightResult.nextIndex };
  }

  return null; // Invalid bit character
}

/**
 * Convert a bit string to a Base64-encoded string.
 * Packs bits into bytes, padding the last byte with zeros.
 */
function bitStringToBase64(bits: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    const chunk = bits.slice(i, i + 8).padEnd(8, '0');
    bytes.push(parseInt(chunk, 2));
  }
  // Prepend the bit length as a single byte so we know how many bits are valid
  const result = String.fromCharCode(bits.length, ...bytes);
  return btoa(result);
}

/**
 * Decode a Base64-encoded bit string back to the original bit string.
 */
function base64ToBitString(encoded: string): string | null {
  try {
    const decoded = atob(encoded);
    if (decoded.length < 1) return null;
    const bitLength = decoded.charCodeAt(0);
    let bits = '';
    for (let i = 1; i < decoded.length; i++) {
      bits += decoded.charCodeAt(i).toString(2).padStart(8, '0');
    }
    return bits.slice(0, bitLength);
  } catch {
    return null;
  }
}

/**
 * Encode a string value for use in URL assignment tuples.
 * Escapes delimiter characters (: , | \) with backslash.
 */
function escapeDelimiters(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/,/g, '\\,').replace(/\|/g, '\\|');
}

/**
 * Decode a string value that was escaped with escapeDelimiters.
 */
function unescapeDelimiters(value: string): string {
  let result = '';
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '\\' && i + 1 < value.length) {
      result += value[i + 1];
      i++;
    } else {
      result += value[i];
    }
  }
  return result;
}

/**
 * Split a string by a delimiter, respecting backslash escapes.
 */
function splitEscaped(str: string, delimiter: string): string[] {
  const parts: string[] = [];
  let current = '';
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '\\' && i + 1 < str.length) {
      current += str[i] + str[i + 1];
      i++;
    } else if (str[i] === delimiter) {
      parts.push(current);
      current = '';
    } else {
      current += str[i];
    }
  }
  parts.push(current);
  return parts;
}

/**
 * Safely encode a string to Base64, handling Unicode characters.
 * Uses TextEncoder to convert to UTF-8 bytes first.
 */
function safeBase64Encode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Safely decode a Base64 string back to a Unicode string.
 * Uses TextDecoder to convert from UTF-8 bytes.
 */
function safeBase64Decode(encoded: string): string {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Encode leaf assignments (tags, workload account, AZ, label) as a comma-separated string.
 * Format: nodeIndex:tagIds:account:az:label
 * tagIds are pipe-separated within the tuple.
 * All values are escaped to handle delimiter characters in content.
 */
function encodeAssignments(leaves: SubnetNode[]): string {
  const tuples: string[] = [];
  for (let i = 0; i < leaves.length; i++) {
    const leaf = leaves[i];
    const hasTags = leaf.tags.length > 0;
    const hasAccount = leaf.workloadAccount !== null;
    const hasAZ = leaf.availabilityZone !== null;
    const hasLabel = leaf.label !== null;

    if (hasTags || hasAccount || hasAZ || hasLabel) {
      const tagIds = leaf.tags.map((t) => escapeDelimiters(t.id)).join('|');
      const account = escapeDelimiters(leaf.workloadAccount ?? '');
      const az = escapeDelimiters(leaf.availabilityZone ?? '');
      const label = escapeDelimiters(leaf.label ?? '');
      tuples.push(`${i}:${tagIds}:${account}:${az}:${label}`);
    }
  }
  return tuples.join(',');
}

/**
 * Apply decoded assignments to the leaf nodes of a tree.
 * Returns a new tree with tags, accounts, AZs, and labels applied.
 */
function applyAssignments(
  tree: SubnetNode,
  assignments: Map<number, { tagIds: string[]; account: string; az: string; label: string }>,
  availableTags: UseCaseTag[]
): SubnetNode {
  const leaves = getLeaves(tree);

  // Build a map from leaf id to assignment
  const leafAssignments = new Map<string, { tagIds: string[]; account: string; az: string; label: string }>();
  for (const [index, assignment] of assignments) {
    if (index < leaves.length) {
      leafAssignments.set(leaves[index].id, assignment);
    }
  }

  // Build a tag lookup map
  const tagMap = new Map<string, UseCaseTag>();
  for (const tag of availableTags) {
    tagMap.set(tag.id, tag);
  }

  return applyAssignmentsToNode(tree, leafAssignments, tagMap);
}

function applyAssignmentsToNode(
  node: SubnetNode,
  leafAssignments: Map<string, { tagIds: string[]; account: string; az: string; label: string }>,
  tagMap: Map<string, UseCaseTag>
): SubnetNode {
  if (node.children === null) {
    // Leaf node — apply assignment if present
    const assignment = leafAssignments.get(node.id);
    if (!assignment) return node;

    const tags: UseCaseTag[] = [];
    for (const tagId of assignment.tagIds) {
      if (tagId && tagMap.has(tagId)) {
        tags.push(tagMap.get(tagId)!);
      }
    }

    return {
      ...node,
      tags,
      workloadAccount: assignment.account || null,
      availabilityZone: assignment.az || null,
      label: assignment.label || null,
    };
  }

  // Non-leaf — recurse
  return {
    ...node,
    children: [
      applyAssignmentsToNode(node.children[0], leafAssignments, tagMap),
      applyAssignmentsToNode(node.children[1], leafAssignments, tagMap),
    ],
  };
}

// === URL Public API ===

/**
 * Encode a NetworkPlan into a URL hash string.
 * Format: #c=<ip>/<prefix>&t=<cloud>&s=<base64_tree>&d=<base64_assignments>&ct=<base64_custom_tags>&r=<count>
 *
 * @param plan - The NetworkPlan to encode
 * @returns A URL hash string (starting with '#')
 */
export function toURL(plan: NetworkPlan): string {
  const params: string[] = [];

  // Root CIDR
  params.push(`c=${numberToIp(plan.rootCIDR.networkAddress.bits)}/${plan.rootCIDR.prefixLength}`);

  // Target cloud
  params.push(`t=${plan.targetCloud}`);

  // Tree structure as bit string, Base64-encoded
  const bitString = encodeTreeStructure(plan.tree);
  params.push(`s=${bitStringToBase64(bitString)}`);

  // Tags and assignments for leaves
  const leaves = getLeaves(plan.tree);
  const assignments = encodeAssignments(leaves);
  if (assignments) {
    params.push(`d=${safeBase64Encode(assignments)}`);
  }

  // Custom tags
  if (plan.customTags.length > 0) {
    const ctStr = plan.customTags.map((t) => `${escapeDelimiters(t.id)}:${escapeDelimiters(t.name)}:${escapeDelimiters(t.color)}`).join(',');
    params.push(`ct=${safeBase64Encode(ctStr)}`);
  }

  // Private cloud reserved count
  if (plan.privateCloudReservedCount !== undefined) {
    params.push(`r=${plan.privateCloudReservedCount}`);
  }

  return '#' + params.join('&');
}

/**
 * Decode a URL hash string back into a NetworkPlan.
 * Validates all parameters and returns a SerializationError on failure.
 *
 * @param url - The URL hash string (with or without leading '#')
 * @returns A valid NetworkPlan, or a SerializationError describing the failure
 */
export function fromURL(url: string): NetworkPlan | SerializationError {
  // Strip leading '#' if present
  const hash = url.startsWith('#') ? url.slice(1) : url;

  if (!hash || hash.trim().length === 0) {
    return { type: 'invalid_format', message: 'Empty URL parameters' };
  }

  // Parse key=value pairs
  const paramMap = new Map<string, string>();
  const parts = hash.split('&');
  for (const part of parts) {
    const eqIndex = part.indexOf('=');
    if (eqIndex === -1) {
      return { type: 'invalid_format', message: `Invalid URL parameter: "${part}"` };
    }
    const key = part.slice(0, eqIndex);
    const value = part.slice(eqIndex + 1);
    paramMap.set(key, value);
  }

  // Validate required parameters
  const cidrStr = paramMap.get('c');
  if (!cidrStr) {
    return { type: 'invalid_format', message: 'Missing required parameter: c (root CIDR)' };
  }

  const cloudStr = paramMap.get('t');
  if (!cloudStr) {
    return { type: 'invalid_format', message: 'Missing required parameter: t (target cloud)' };
  }

  const structureStr = paramMap.get('s');
  if (!structureStr) {
    return { type: 'invalid_format', message: 'Missing required parameter: s (tree structure)' };
  }

  // Parse root CIDR
  const rootCIDR = stringToCIDR(cidrStr);
  if (rootCIDR === null) {
    return { type: 'invalid_data', message: `Invalid root CIDR: "${cidrStr}"` };
  }

  // Parse target cloud
  if (!VALID_CLOUDS.includes(cloudStr as TargetCloud)) {
    return { type: 'invalid_data', message: `Invalid target cloud: "${cloudStr}". Must be one of: ${VALID_CLOUDS.join(', ')}` };
  }
  const targetCloud = cloudStr as TargetCloud;

  // Parse private cloud reserved count
  let privateCloudReservedCount: number | undefined;
  const reservedStr = paramMap.get('r');
  if (reservedStr !== undefined) {
    const count = parseInt(reservedStr, 10);
    if (isNaN(count) || count < 2 || count > 10) {
      return { type: 'invalid_data', message: 'privateCloudReservedCount must be between 2 and 10' };
    }
    privateCloudReservedCount = count;
  }

  // Parse custom tags
  let customTags: UseCaseTag[] = [];
  const ctStr = paramMap.get('ct');
  if (ctStr) {
    try {
      const decoded = safeBase64Decode(ctStr);
      const tagEntries = splitEscaped(decoded, ',');
      for (const entry of tagEntries) {
        const parts = splitEscaped(entry, ':');
        if (parts.length < 3) {
          return { type: 'invalid_data', message: `Invalid custom tag entry: "${entry}"` };
        }
        const id = unescapeDelimiters(parts[0]);
        const name = unescapeDelimiters(parts[1]);
        const color = unescapeDelimiters(parts[2]);
        if (!id || !name || !color) {
          return { type: 'invalid_data', message: `Invalid custom tag entry: "${entry}"` };
        }
        if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
          return { type: 'invalid_data', message: `Invalid custom tag color: "${color}"` };
        }
        customTags.push({ id, name, isCustom: true, color });
      }
    } catch {
      return { type: 'invalid_format', message: 'Invalid Base64 encoding for custom tags' };
    }
  }

  // Decode tree structure
  const bitString = base64ToBitString(structureStr);
  if (bitString === null) {
    return { type: 'invalid_format', message: 'Invalid Base64 encoding for tree structure' };
  }

  const treeResult = decodeTreeStructure(
    bitString,
    rootCIDR.networkAddress.bits,
    rootCIDR.prefixLength,
    0
  );
  if (treeResult === null) {
    return { type: 'invalid_data', message: 'Invalid tree structure bit string' };
  }

  // Verify all bits were consumed
  if (treeResult.nextIndex !== bitString.length) {
    return { type: 'invalid_data', message: 'Tree structure bit string has trailing data' };
  }

  let tree = treeResult.node;

  // Parse and apply assignments
  const dataStr = paramMap.get('d');
  if (dataStr) {
    try {
      const decoded = safeBase64Decode(dataStr);
      const assignments = new Map<number, { tagIds: string[]; account: string; az: string; label: string }>();

      if (decoded.length > 0) {
        const tuples = splitEscaped(decoded, ',');
        for (const tuple of tuples) {
          const parts = splitEscaped(tuple, ':');
          if (parts.length < 5) {
            return { type: 'invalid_data', message: `Invalid assignment tuple: "${tuple}"` };
          }
          const indexStr = unescapeDelimiters(parts[0]);
          const index = parseInt(indexStr, 10);
          if (isNaN(index) || index < 0) {
            return { type: 'invalid_data', message: `Invalid node index in assignment: "${indexStr}"` };
          }
          // parts[0]=index, parts[1]=tagIds (pipe-separated), parts[2]=account, parts[3]=az, parts[4]=label
          const tagIdsPart = parts[1];
          const tagIds = tagIdsPart ? splitEscaped(tagIdsPart, '|').map(unescapeDelimiters) : [];
          const acct = unescapeDelimiters(parts[2] || '');
          const azVal = unescapeDelimiters(parts[3] || '');
          const labelVal = unescapeDelimiters(parts[4] || '');

          assignments.set(index, { tagIds, account: acct, az: azVal, label: labelVal });
        }
      }

      // Get available tags for this cloud + custom tags
      const profile = getProfile(targetCloud);
      const availableTags = [...profile.defaultTags, ...customTags];

      tree = applyAssignments(tree, assignments, availableTags);
    } catch {
      return { type: 'invalid_format', message: 'Invalid Base64 encoding for assignments' };
    }
  }

  return {
    version: CURRENT_VERSION,
    targetCloud,
    rootCIDR,
    tree,
    customTags,
    ...(privateCloudReservedCount !== undefined && { privateCloudReservedCount }),
  };
}
