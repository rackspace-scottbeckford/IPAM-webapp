# Requirements Document

## Introduction

A web application for IP Address Management (IPAM) designed for customers planning cloud migrations. The application provides visual subnet calculation, splitting, and joining capabilities — similar to the davidc.net Visual Subnet Calculator — but tailored for cloud infrastructure planning. Users select a target cloud (AWS, Azure, GCP, or Private Cloud) and then design, visualize, and manage IP address allocation using cloud-specific constructs such as transit gateways, inspection VPCs, VPN routing, and workload account allocations. Subnets are tagged with use-case metadata to document their purpose in the migration plan.

## Glossary

- **IPAM_App**: The cloud IPAM web application being specified
- **User**: A cloud migration customer or network engineer using the application
- **Subnet_Visualizer**: The component that renders the hierarchical visual representation of subnet divisions
- **Subnet_Calculator**: The component that performs IP address arithmetic (network address, broadcast, host range, mask conversions)
- **Network_Plan**: A saved arrangement of subnets, tags, and cloud metadata representing a user's IP allocation design
- **CIDR_Block**: A network address expressed in Classless Inter-Domain Routing notation (e.g., 10.0.0.0/16)
- **Target_Cloud**: The selected cloud platform (AWS, Azure, GCP, or Private Cloud) that determines available use-case tags and provider constraints
- **VPC**: Virtual Private Cloud — an isolated network within a cloud provider
- **Availability_Zone**: A physically separate data center zone within a cloud region
- **Use_Case_Tag**: A label classifying a subnet's purpose within the cloud architecture (e.g., transit-gateway, inspection, vpn-routing, workload)
- **Workload_Account**: A cloud account or subscription allocated for running application workloads
- **Split_Operation**: Dividing a subnet into two equal subnets of the next smaller prefix length
- **Join_Operation**: Merging two adjacent sibling subnets back into their parent subnet
- **Cloud_Provider_Profile**: A configuration defining reserved IP addresses, subnet limits, and available use-case tags for a specific Target_Cloud
- **Branding_Configuration**: A JSON configuration or environment variable set that defines the white-label appearance including logo, colors, title, and favicon
- **Cloud_Visual_Theme**: The set of accent colors, icons, and visual indicators associated with a specific Target_Cloud selection
- **CIDR_Suffix_Selector**: A dropdown control for selecting the prefix length (/8 to /28) that synchronizes bidirectionally with the CIDR text input
- **Reverse_CIDR_Calculator**: A function that determines the smallest prefix length (largest subnet) required to accommodate a given number of usable IP addresses after provider-reserved addresses are subtracted
- **Language_Toggle**: A UI control that switches the application interface between English (EN) and German (DE), with the title always remaining in English

## Requirements

### Requirement 1: Target Cloud Selection

**User Story:** As a User, I want to select a target cloud platform at the start of my planning session, so that the tool presents cloud-specific constructs, constraints, and use-case options relevant to my migration target.

#### Acceptance Criteria

1. THE IPAM_App SHALL provide a Target_Cloud selection with options: AWS, Azure, GCP, and Private Cloud, and SHALL require the User to select a Target_Cloud before any subnet operations can be performed
2. WHEN a Target_Cloud is selected, THE IPAM_App SHALL load the corresponding Cloud_Provider_Profile including reserved IP rules and available Use_Case_Tags within 1 second
3. WHEN AWS is selected as Target_Cloud, THE IPAM_App SHALL present Use_Case_Tags including: transit-gateway, inspection, vpn-routing, workload, shared-services, and egress
4. WHEN Azure is selected as Target_Cloud, THE IPAM_App SHALL present Use_Case_Tags including: hub-vnet, spoke-vnet, vpn-gateway, firewall, workload, and shared-services
5. WHEN GCP is selected as Target_Cloud, THE IPAM_App SHALL present Use_Case_Tags including: shared-vpc-host, shared-vpc-service, interconnect, workload, and shared-services
6. WHEN Private Cloud is selected as Target_Cloud, THE IPAM_App SHALL present a default set of Use_Case_Tags (core-network, dmz, workload, management) and allow the User to define up to 20 custom tags with names between 1 and 32 characters in length
7. WHEN the User changes the Target_Cloud after subnets have been tagged, THE IPAM_App SHALL identify tags not present in the newly selected Target_Cloud's Use_Case_Tag set as incompatible, warn the User that those incompatible tags will be cleared, preserve any tags that exist in both the old and new Target_Cloud profiles, and require confirmation before proceeding
8. IF the User declines the confirmation when changing Target_Cloud, THEN THE IPAM_App SHALL cancel the Target_Cloud change and retain the current Target_Cloud selection and all existing tags unchanged

### Requirement 2: Network Address Input

**User Story:** As a User, I want to enter a starting network address and prefix length, so that I can begin planning my cloud IP allocation from a specific CIDR block.

#### Acceptance Criteria

1. THE IPAM_App SHALL provide an input field for entering a network address in CIDR notation (e.g., 10.0.0.0/16) accepting a maximum of 18 characters
2. WHEN the User submits a valid CIDR_Block, THE Subnet_Calculator SHALL compute and display the network address, broadcast address, subnet mask, and total number of host addresses
3. WHEN an invalid CIDR_Block is submitted, THE IPAM_App SHALL display an inline error message indicating the nature of the validation failure, including: malformed IP address format, octet values outside 0–255, missing or non-numeric prefix length, or prefix length outside the supported /8 to /30 range
4. THE IPAM_App SHALL support IPv4 addresses with prefix lengths from /8 to /30 and SHALL reject any prefix length outside this range with an error message indicating the supported range
5. WHEN a network address with host bits set is submitted, THE IPAM_App SHALL automatically adjust to the correct network address and display an inline notification informing the User of the adjustment made, showing both the entered and corrected addresses
6. WHEN the User submits a CIDR_Block, THE IPAM_App SHALL validate that the input matches the format of four decimal octets (each 0–255) separated by dots followed by a forward slash and a numeric prefix length before performing any calculation

### Requirement 3: Visual Subnet Splitting

**User Story:** As a User, I want to split subnets visually with a single click, so that I can quickly design my cloud network hierarchy without manual calculations.

#### Acceptance Criteria

1. WHEN the User clicks a split control on a leaf subnet, THE Subnet_Visualizer SHALL divide that subnet into two equal subnets of the next smaller prefix length
2. THE Subnet_Visualizer SHALL display each subnet with its CIDR notation, address range, subnet mask, and usable host count adjusted for the active Cloud_Provider_Profile reserved addresses
3. IF the subnet has a /30 prefix length, THEN THE IPAM_App SHALL disable the split control and display an indication that the maximum split depth has been reached
4. WHEN a Split_Operation is performed, THE Subnet_Visualizer SHALL render the new subnets as children in a hierarchical tree layout
5. THE Subnet_Visualizer SHALL update all displayed calculations within 100 milliseconds of a Split_Operation
6. THE Subnet_Visualizer SHALL display the split control only on leaf subnets that have not already been divided into children

### Requirement 4: Visual Subnet Joining

**User Story:** As a User, I want to join adjacent sibling subnets back together with a single click, so that I can undo splits and reorganize my network plan.

#### Acceptance Criteria

1. WHEN the User clicks a join control on a parent subnet whose two immediate child subnets are both leaf subnets, THE Subnet_Visualizer SHALL merge those children back into the parent subnet and discard any Use_Case_Tags, Workload_Account assignments, and Availability_Zone assignments previously applied to the children
2. THE IPAM_App SHALL only allow joining two subnets that are adjacent siblings from the same parent and that are both leaf subnets (have not been further subdivided)
3. IF a subnet targeted for joining contains child subnets with assigned Use_Case_Tags, Workload_Account identifiers, or text labels, THEN THE IPAM_App SHALL display a confirmation prompt indicating that these assignments will be lost, and SHALL cancel the Join_Operation if the User declines
4. WHEN a Join_Operation is performed, THE Subnet_Visualizer SHALL remove the child subnets and restore the parent subnet display within 100 milliseconds
5. IF the User clicks a join control on a subnet whose children do not meet the joining criteria, THEN THE IPAM_App SHALL keep the join control disabled and display a tooltip indicating why joining is not available

### Requirement 5: Cloud Provider Reserved IP Handling

**User Story:** As a User, I want provider-reserved IP addresses automatically subtracted from usable host counts, so that my capacity planning reflects real-world allocatable addresses.

#### Acceptance Criteria

1. WHEN the AWS Cloud_Provider_Profile is active, THE Subnet_Calculator SHALL reserve 5 IP addresses per subnet (network, broadcast, router, DNS, future use) and compute usable hosts as (2^(32 - prefix) - 5)
2. WHEN the Azure Cloud_Provider_Profile is active, THE Subnet_Calculator SHALL reserve 5 IP addresses per subnet (network, broadcast, and 3 Azure-reserved) and compute usable hosts as (2^(32 - prefix) - 5)
3. WHEN the GCP Cloud_Provider_Profile is active, THE Subnet_Calculator SHALL reserve 4 IP addresses per subnet (network, broadcast, gateway, and reserved) and compute usable hosts as (2^(32 - prefix) - 4)
4. WHEN the Private Cloud profile is active, THE Subnet_Calculator SHALL reserve 2 IP addresses per subnet (network and broadcast) by default, and SHALL allow the User to configure a custom reservation count between 2 and 10
5. THE IPAM_App SHALL display the number of reserved addresses and the reason for each reservation alongside the usable host count
6. IF the total address space of a subnet is less than or equal to the number of reserved addresses for the active Cloud_Provider_Profile, THEN THE IPAM_App SHALL display the usable host count as 0 and show a warning that the subnet is too small for the selected provider

### Requirement 6: Use-Case Tagging and Workload Allocation

**User Story:** As a User, I want to tag subnets with use-case classifications and allocate them to workload accounts, so that I can document the architectural purpose of each subnet in my cloud migration plan.

#### Acceptance Criteria

1. THE IPAM_App SHALL allow the User to assign between 1 and 5 Use_Case_Tags to each leaf subnet
2. THE IPAM_App SHALL present only Use_Case_Tags valid for the currently selected Target_Cloud
3. THE IPAM_App SHALL allow the User to assign a Workload_Account identifier (free-text, 1 to 64 characters) to each tagged subnet
4. THE IPAM_App SHALL allow the User to assign an Availability_Zone identifier (free-text, up to 64 characters) to each subnet
5. WHEN a Use_Case_Tag is assigned, THE Subnet_Visualizer SHALL apply a unique color to that subnet for each distinct tag, such that no two different tags share the same color
6. THE IPAM_App SHALL allow the User to define up to 20 custom Use_Case_Tags (each tag name 1 to 32 characters) in addition to the cloud-specific defaults
7. THE IPAM_App SHALL allow the User to assign a text label (1 to 64 characters) to each subnet for descriptive naming
8. THE IPAM_App SHALL allow the User to remove any previously assigned Use_Case_Tag, Workload_Account, Availability_Zone, or text label from a subnet
9. IF the User attempts to assign a Use_Case_Tag to a non-leaf subnet, THEN THE IPAM_App SHALL prevent the assignment and display a message indicating that only leaf subnets can be tagged

### Requirement 7: Hierarchical Visualization

**User Story:** As a User, I want to see my subnet divisions in a hierarchical tree layout, so that I can understand the parent-child relationships between network segments.

#### Acceptance Criteria

1. THE Subnet_Visualizer SHALL render subnets in a hierarchical tree structure showing parent-child relationships, where each node displays the subnet CIDR notation and each edge connects a parent subnet to its direct children
2. THE Subnet_Visualizer SHALL display the full address range as a proportional width bar for each subnet relative to the root network, with a minimum rendered width of 4 pixels for any visible subnet regardless of its proportional size
3. WHEN the Network_Plan contains more than 20 visible subnets, THE Subnet_Visualizer SHALL provide a collapse/expand toggle for each non-leaf subtree, with all subtrees expanded by default when the tree is first rendered
4. THE Subnet_Visualizer SHALL visually distinguish between leaf subnets (allocated) and intermediate subnets (further divided) using at least two distinct visual properties (such as fill style, border style, or iconography) so that the two types are identifiable without relying on color alone
5. WHEN the User activates the grouping view, THE Subnet_Visualizer SHALL group subnets by their assigned Use_Case_Tag and render each group in a visually distinct bounded region with the tag name displayed as a group header
6. IF a subnet's proportional width bar would be narrower than the minimum rendered width, THEN THE Subnet_Visualizer SHALL render it at the minimum width and display a visual indicator that the bar is not to scale

### Requirement 8: Save and Load Network Plans

**User Story:** As a User, I want to save and load my network plans, so that I can return to my work later or share plans with colleagues.

#### Acceptance Criteria

1. THE IPAM_App SHALL encode the current Network_Plan state into URL parameters for bookmark-based saving
2. WHEN a URL containing Network_Plan parameters is loaded, THE IPAM_App SHALL restore the Network_Plan including the root CIDR_Block, all subnet splits, Use_Case_Tags, Workload_Account assignments, Availability_Zone assignments, text labels, and Target_Cloud selection
3. IF a URL containing Network_Plan parameters cannot be parsed or contains invalid data, THEN THE IPAM_App SHALL display an error message indicating the nature of the failure and present an empty default state
4. THE IPAM_App SHALL provide an export function that saves the Network_Plan as a JSON file
5. THE IPAM_App SHALL provide an import function that loads a Network_Plan from a JSON file up to 5 MB in size
6. IF an imported JSON file contains invalid or corrupt data, THEN THE IPAM_App SHALL display an error message indicating the nature of the validation failure and retain the current Network_Plan unchanged
7. IF an imported JSON file exceeds 5 MB, THEN THE IPAM_App SHALL reject the file and display an error message indicating the size limit
8. WHEN an imported Network_Plan specifies a different Target_Cloud than the currently active selection, THE IPAM_App SHALL apply the imported Target_Cloud and load its corresponding Cloud_Provider_Profile
9. THE IPAM_App SHALL include the Target_Cloud selection, all Use_Case_Tags (including custom tags), Workload_Account assignments, Availability_Zone assignments, and text labels in the saved Network_Plan state

### Requirement 9: Client-Side Calculation

**User Story:** As a User, I want all subnet calculations to run in my browser without server calls, so that the tool is fast, works offline, and my network plans remain private.

#### Acceptance Criteria

1. THE Subnet_Calculator SHALL perform all IP address arithmetic entirely in the browser without server-side requests
2. WHILE the IPAM_App has no internet connection after initial page load, THE IPAM_App SHALL support all subnet calculation, splitting, joining, tagging, and local save/load operations without degradation
3. THE IPAM_App SHALL not initiate any outbound network requests that transmit Network_Plan data, CIDR_Block inputs, or Use_Case_Tag assignments to any external server
4. THE Subnet_Calculator SHALL complete any single calculation operation (network address, broadcast address, host range, or subnet mask derivation) within 200 milliseconds for Network_Plans containing up to 500 leaf subnets

### Requirement 10: VPC Planning Summary

**User Story:** As a User, I want to see a summary of my planned VPC allocation, so that I can verify my design meets cloud provider limits and best practices.

#### Acceptance Criteria

1. THE IPAM_App SHALL display a summary panel showing total subnets, subnets per Use_Case_Tag, and subnets per Availability_Zone
2. WHEN the number of subnets exceeds the Cloud_Provider_Profile subnet limit (AWS: 200 subnets per VPC, Azure: 3000 subnets per VNet, GCP: 300 subnets per VPC network), THE IPAM_App SHALL display a warning indicating the specific limit exceeded and the current count versus the maximum allowed
3. THE IPAM_App SHALL display the percentage of the root CIDR_Block address space that has been allocated to leaf subnets versus remaining unallocated, rounded to one decimal place
4. THE IPAM_App SHALL display the total usable IP addresses across all leaf subnets, accounting for the active Cloud_Provider_Profile reserved address deductions
5. THE IPAM_App SHALL display a breakdown of address allocation per Workload_Account showing subnet count, total usable IP addresses, and percentage of overall allocated space for each account
6. WHEN a Split_Operation, Join_Operation, or tag assignment is performed, THE IPAM_App SHALL update all summary panel values within 200 milliseconds

### Requirement 11: White Labelling and Branding

**User Story:** As a platform owner, I want to white-label the application with my organization's branding, so that the tool appears as a native part of my service offering to customers.

#### Acceptance Criteria

1. THE IPAM_App SHALL support a configurable logo placement in the application header, accepting image files in SVG, PNG, or JPEG format with a maximum file size of 500 KB and rendered at a maximum height of 48 pixels
2. THE IPAM_App SHALL load branding configuration from a JSON configuration file or environment variables that specify: logo URL, primary brand color (hex), secondary brand color (hex), and application title text (up to 64 characters)
3. WHEN no custom branding configuration is provided, THE IPAM_App SHALL default to Rackspace branding including the Rackspace logo and Rackspace brand colors
4. THE IPAM_App SHALL apply the configured primary brand color to the application header background, primary action buttons, and active navigation elements
5. THE IPAM_App SHALL apply the configured secondary brand color to secondary UI elements including hover states, borders, and accent highlights
6. THE IPAM_App SHALL display the configured application title in the browser tab title and the application header adjacent to the logo
7. THE IPAM_App SHALL support a configurable favicon in ICO or PNG format (16x16 or 32x32 pixels) that replaces the default favicon when provided
8. IF a branding configuration value is invalid (unsupported image format, malformed hex color, or title exceeding 64 characters), THEN THE IPAM_App SHALL fall back to the default Rackspace branding for that specific value and log a console warning indicating the invalid configuration

### Requirement 12: Cloud-Specific Visual Theming

**User Story:** As a User, I want the application to display visual elements specific to my selected target cloud, so that the interface reinforces which cloud platform I am planning for and provides familiar iconography.

#### Acceptance Criteria

1. WHEN a Target_Cloud is selected, THE IPAM_App SHALL display the corresponding cloud provider icon (AWS, Azure, GCP, or a generic cloud icon for Private Cloud) in the application header alongside the Target_Cloud name
2. WHEN a Target_Cloud is selected, THE IPAM_App SHALL apply a cloud-specific accent color palette to subnet visualizations: AWS (orange #FF9900), Azure (blue #0078D4), GCP (multi-color with primary blue #4285F4), Private Cloud (neutral gray #6B7280)
3. THE Subnet_Visualizer SHALL display cloud-provider-specific icons next to Use_Case_Tags that correspond to known cloud services (e.g., a gateway icon for transit-gateway, a shield icon for firewall, a lock icon for vpn-routing)
4. WHEN the Target_Cloud is changed, THE IPAM_App SHALL transition the visual theme to the newly selected cloud's accent colors and icons within 300 milliseconds
5. THE IPAM_App SHALL display the cloud provider icon in the VPC Planning Summary panel header to reinforce the active Target_Cloud context
6. THE IPAM_App SHALL ensure that cloud-specific accent colors do not override the white-label primary and secondary brand colors configured in Requirement 11, but instead complement them as tertiary visual accents applied only to cloud-context elements (provider icon backgrounds, tag color coding, and subnet visualization borders)
7. IF the Target_Cloud is Private Cloud, THEN THE IPAM_App SHALL display a generic cloud icon and allow the User to optionally upload a custom icon (SVG or PNG, maximum 64x64 pixels, maximum 100 KB) to represent their private cloud environment

### Requirement 13: CIDR Suffix Dropdown Selector

**User Story:** As a User, I want a dropdown selector for the CIDR prefix length alongside the text input, so that I can quickly choose common prefix lengths without typing, while still having the option to type the full CIDR manually.

#### Acceptance Criteria

1. THE IPAM_App SHALL display a CIDR_Suffix_Selector dropdown adjacent to the network address input field, offering prefix length options from /8 to /28
2. THE CIDR_Suffix_Selector SHALL display each option with its prefix length and the corresponding total address count (e.g., "/16 — 65,536 addresses")
3. WHEN the User selects a prefix length from the CIDR_Suffix_Selector dropdown, THE IPAM_App SHALL update the CIDR text input field to reflect the selected prefix length appended to the current network address
4. WHEN the User manually types or modifies the CIDR text input and the input contains a valid prefix length (e.g., 10.0.0.1/16), THE CIDR_Suffix_Selector SHALL automatically update to show the matching prefix length without requiring additional user action
5. THE IPAM_App SHALL keep the CIDR_Suffix_Selector and the text input field synchronized bidirectionally at all times — changes in either control are immediately reflected in the other
6. WHEN the CIDR text input does not contain a valid prefix length, THE CIDR_Suffix_Selector SHALL display no selection (blank/placeholder state) until a valid prefix is entered or selected
7. THE IPAM_App SHALL continue to accept manually typed CIDR notation in the text input field regardless of whether the dropdown is used, preserving full backward compatibility with Requirement 2

### Requirement 14: Workload Capacity Planning with Reverse CIDR Calculation

**User Story:** As a User, I want to create a workload by specifying how many usable IP addresses I need, so that the tool suggests the appropriate subnet size and I can plan capacity without manually calculating CIDR prefixes.

#### Acceptance Criteria

1. THE IPAM_App SHALL provide a "Create Workload" button that initiates a workload capacity planning flow
2. WHEN the User clicks the "Create Workload" button, THE IPAM_App SHALL display a dialog prompting the User to enter: a workload name (1 to 64 characters) and the number of required usable IP addresses (positive integer, minimum 1, maximum 16,777,214)
3. WHEN the User submits the required IP count, THE Reverse_CIDR_Calculator SHALL determine the smallest prefix length (largest subnet) that provides at least the requested number of usable IP addresses after subtracting the active Cloud_Provider_Profile's reserved address count
4. THE IPAM_App SHALL display the suggested prefix length, the total addresses in that subnet, the usable addresses after provider reservations, and the surplus (usable minus requested) to the User before confirming the allocation
5. IF the requested number of usable IPs exceeds the capacity of the root CIDR_Block after reserved address deductions, THEN THE IPAM_App SHALL display an error indicating that the current root network is too small to accommodate the requested workload and SHALL not create the workload
6. WHEN the User confirms the suggested allocation, THE IPAM_App SHALL automatically find the first available (untagged, unsplit) leaf subnet of the suggested prefix length within the tree, or perform the necessary split operations to create one, assign the workload name as the subnet text label, and assign the workload name as the Workload_Account identifier
7. IF no contiguous address space of the suggested prefix length is available in the current tree, THEN THE IPAM_App SHALL inform the User that there is insufficient contiguous space and suggest the User reorganize the plan or use a larger root CIDR_Block
8. THE Reverse_CIDR_Calculator SHALL account for the active Cloud_Provider_Profile reserved IPs when computing the suggested prefix, ensuring that the formula used is: find smallest P (8 ≤ P ≤ 30) where (2^(32-P) - reservedCount) ≥ requestedUsableIPs

### Requirement 15: Language Toggle (EN/DE)

**User Story:** As a User, I want to switch the application interface between English and German, so that I can use the tool in my preferred language.

#### Acceptance Criteria

1. THE IPAM_App SHALL display a language toggle control with options EN and DE, positioned in the application header directly below the Rackspace logo
2. WHEN the User selects DE, THE IPAM_App SHALL translate all UI labels, button text, error messages, tooltips, dialog content, and descriptions into German
3. THE IPAM_App SHALL always display the application title in English regardless of the selected language
4. WHEN the User switches language, THE IPAM_App SHALL update all visible text immediately without requiring a page reload
5. THE IPAM_App SHALL default to English (EN) on initial load
6. THE IPAM_App SHALL visually indicate the currently active language in the toggle control using a distinct active state (e.g., highlighted background)
7. THE language toggle SHALL be keyboard accessible and include appropriate ARIA attributes (aria-pressed or aria-selected) indicating the active language

---

## Future Features (Backlog)

The following features are planned for future iterations and are not in scope for the initial release:

### Architecture Diagram Generation

- Ability to generate visual architecture diagrams from the Network_Plan
- Diagrams showing VPC topology, subnet placement, routing paths, and connectivity
- Export diagrams in standard formats (SVG, PNG, PDF)

### Infrastructure as Code Export

- Export Network_Plan as Terraform configuration (.tf files with resource definitions)
- Export Network_Plan as AWS CDK constructs (TypeScript or Python)
- Export Network_Plan as Azure Bicep templates
- Export Network_Plan as GCP Deployment Manager or Pulumi configurations
- Generated code passes the respective tool's validation without modification
- Include subnet CIDR, tags, account allocation, and availability zone in all exports

### SAML/AAA Authentication

- Support SAML 2.0 single sign-on for enterprise identity provider integration
- Role-based access control (RBAC) with configurable roles (viewer, editor, admin)
- AAA (Authentication, Authorization, Accounting) framework for audit logging of plan changes
- Session management with configurable timeout and token refresh
- Integration with common identity providers (Okta, Azure AD, AWS IAM Identity Center)
