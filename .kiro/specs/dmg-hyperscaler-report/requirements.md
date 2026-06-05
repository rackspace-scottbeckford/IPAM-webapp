# Requirements Document

## Introduction

DMG Media is evaluating a move to public cloud as part of a Cloud Readiness Assessment (CRA) Phase 1 led by Rackspace. The goal is to produce a final hyperscaler recommendation report comparing AWS, Azure, and GCP across multiple decision dimensions — not just cost. The report must help DMG Media's CTO (Neil Finlayson) and leadership team decide which hyperscaler to adopt, supporting their North Star goal of growing Mail Online subscriptions from 250k to 1M by 2028.

This system provides the workflow, data structuring, scoring, and document generation tooling to produce:
1. A comprehensive Word document report (primary deliverable)
2. A PowerPoint executive summary

The system must handle DMG Media's complex environment (~3,067 servers, 39 apps, 88 databases, 100TB data, multiple data centres) and evaluate hyperscalers across economics, security/compliance, scalability, reliability, and business agility.

## Glossary

- **Report_Generator**: The system that produces the final Word document and PowerPoint executive summary
- **Scoring_Engine**: The component that calculates weighted scores across decision dimensions for each hyperscaler
- **Data_Collector**: The component that ingests and structures infrastructure discovery data, hyperscaler proposals, and analyst inputs
- **Dimension_Evaluator**: The component that manages evaluation criteria and evidence for each decision dimension
- **Workflow_Manager**: The component that orchestrates the end-to-end assessment workflow from data collection through report generation
- **Decision_Matrix**: The weighted comparison framework that scores each hyperscaler across all dimensions
- **Hyperscaler**: One of the three public cloud providers under evaluation (AWS, Azure, GCP)
- **Decision_Dimension**: A top-level evaluation category (Economics, Security/Compliance, Scalability, Reliability, Business Agility)
- **Sub_Factor**: A specific evaluation criterion within a Decision_Dimension (e.g., TCO, Migration Costs, SLAs)
- **Evidence**: Supporting data, notes, or references that justify a score for a given Sub_Factor
- **TCO**: Total Cost of Ownership — the full economic cost of running workloads on a hyperscaler over a defined period
- **CRA**: Cloud Readiness Assessment — the engagement Rackspace is delivering for DMG Media

## Requirements

### Requirement 1: Decision Dimension Framework

**User Story:** As a Lead Architect, I want a structured framework of decision dimensions and sub-factors, so that I can evaluate each hyperscaler consistently across all relevant criteria.

#### Acceptance Criteria

1. THE Workflow_Manager SHALL provide a predefined set of five Decision_Dimensions: Economics, Security_Risk_and_Compliance, Scalability, Reliability, and Business_Agility
2. THE Workflow_Manager SHALL define Sub_Factors for each Decision_Dimension as follows:
   - Economics: TCO, Infrastructure_Costs, Migration_Costs, Software_Licensing, Pricing_Flexibility
   - Security_Risk_and_Compliance: Certifications, Data_Privacy, Platform_Capability_Maturity
   - Scalability: Global_Reach, Elasticity, Control
   - Reliability: SLAs, Data_Durability, Backup_Recovery, Disaster_Recovery, Track_Record
   - Business_Agility: Business_Fit_and_Alignment, Effort_to_Achieve_Readiness, Time_to_Migrate, Training_and_Certification
3. WHEN a user requests the dimension framework, THE Workflow_Manager SHALL return all Decision_Dimensions with their associated Sub_Factors
4. THE Workflow_Manager SHALL allow the user to add, remove, or rename Sub_Factors within any Decision_Dimension

### Requirement 2: Dimension Weighting

**User Story:** As a Lead Architect, I want to assign weights to each decision dimension and sub-factor, so that the final recommendation reflects DMG Media's priorities.

#### Acceptance Criteria

1. THE Scoring_Engine SHALL accept a numeric weight (0 to 100) for each Decision_Dimension
2. THE Scoring_Engine SHALL accept a numeric weight (0 to 100) for each Sub_Factor within a Decision_Dimension
3. THE Scoring_Engine SHALL validate that Decision_Dimension weights sum to 100
4. THE Scoring_Engine SHALL validate that Sub_Factor weights within each Decision_Dimension sum to 100
5. IF a weight value is outside the range 0 to 100, THEN THE Scoring_Engine SHALL reject the input and return a descriptive error message
6. THE Scoring_Engine SHALL provide default weights that reflect the key differentiators identified for DMG Media (higher weight on Economics and Business_Agility, lower weight on Security_Risk_and_Compliance, Scalability, and Reliability)

### Requirement 3: Hyperscaler Scoring

**User Story:** As a Lead Architect, I want to score each hyperscaler against every sub-factor, so that I can produce a quantitative comparison.

#### Acceptance Criteria

1. THE Scoring_Engine SHALL accept a score from 1 to 5 for each Hyperscaler against each Sub_Factor
2. WHEN a score is entered, THE Scoring_Engine SHALL require the user to provide at least one piece of Evidence justifying the score
3. THE Scoring_Engine SHALL calculate a weighted Sub_Factor score for each Hyperscaler by multiplying the raw score by the Sub_Factor weight
4. THE Scoring_Engine SHALL calculate a weighted Decision_Dimension score for each Hyperscaler by aggregating the weighted Sub_Factor scores within that dimension
5. THE Scoring_Engine SHALL calculate an overall weighted score for each Hyperscaler by aggregating the weighted Decision_Dimension scores
6. IF a Hyperscaler has unscored Sub_Factors, THEN THE Scoring_Engine SHALL flag the incomplete Sub_Factors and exclude them from the weighted calculation with a warning

### Requirement 4: Infrastructure Data Ingestion

**User Story:** As a Lead Architect, I want to import infrastructure discovery data, so that the report accurately reflects DMG Media's environment.

#### Acceptance Criteria

1. THE Data_Collector SHALL accept infrastructure data in CSV or JSON format
2. WHEN infrastructure data is imported, THE Data_Collector SHALL parse and store server count, application count, database count, total data volume, and data centre locations
3. WHEN infrastructure data is imported, THE Data_Collector SHALL validate that required fields (server name, data centre, operating system) are present and return a list of validation errors for any incomplete records
4. THE Data_Collector SHALL aggregate infrastructure data into summary statistics: total servers, total applications, total databases, total data volume, and servers per data centre
5. IF a data file cannot be parsed, THEN THE Data_Collector SHALL return a descriptive error identifying the file and the parsing failure reason

### Requirement 5: Hyperscaler Proposal Ingestion

**User Story:** As a Lead Architect, I want to capture key data points from each hyperscaler's proposal or engagement notes, so that I have structured evidence for scoring.

#### Acceptance Criteria

1. THE Data_Collector SHALL accept structured input for each Hyperscaler containing: provider name, proposed pricing, proposed migration approach, partnership model, training offerings, and key differentiators
2. WHEN hyperscaler proposal data is entered, THE Data_Collector SHALL store the data associated with the correct Hyperscaler (AWS, Azure, or GCP)
3. THE Data_Collector SHALL allow free-text notes to be attached to any Hyperscaler proposal record
4. WHEN hyperscaler proposal data is stored, THE Data_Collector SHALL make the data available as selectable Evidence when scoring Sub_Factors

### Requirement 6: Evidence Management

**User Story:** As a Lead Architect, I want to attach evidence (notes, data references, meeting notes) to each sub-factor score, so that the report is well-supported and auditable.

#### Acceptance Criteria

1. THE Dimension_Evaluator SHALL allow the user to create Evidence entries containing a title, description, source reference, and associated Hyperscaler
2. THE Dimension_Evaluator SHALL allow one or more Evidence entries to be linked to any Sub_Factor score
3. WHEN an Evidence entry is linked to a Sub_Factor score, THE Dimension_Evaluator SHALL include that Evidence in the corresponding section of the generated report
4. THE Dimension_Evaluator SHALL allow the user to edit or remove Evidence entries at any time before report generation

### Requirement 7: Decision Matrix Generation

**User Story:** As a Lead Architect, I want to generate a decision matrix that shows the weighted comparison across all dimensions, so that stakeholders can see the quantitative basis for the recommendation.

#### Acceptance Criteria

1. WHEN all Sub_Factors for all Hyperscalers have been scored, THE Scoring_Engine SHALL generate a Decision_Matrix showing raw scores, weighted scores, and rankings per Sub_Factor, per Decision_Dimension, and overall
2. THE Scoring_Engine SHALL rank the three Hyperscalers (1st, 2nd, 3rd) for each Decision_Dimension and overall
3. THE Scoring_Engine SHALL highlight the leading Hyperscaler for each Decision_Dimension
4. IF two or more Hyperscalers have the same weighted score for a Decision_Dimension, THEN THE Scoring_Engine SHALL flag the tie and rank them equally

### Requirement 8: Word Document Report Generation

**User Story:** As a Lead Architect, I want to generate a professional Word document report, so that I can deliver the primary CRA Phase 1 deliverable to DMG Media.

#### Acceptance Criteria

1. WHEN the user requests report generation, THE Report_Generator SHALL produce a Word document (.docx) containing the following sections: Executive Summary, Introduction, Methodology, Infrastructure Overview, Hyperscaler Evaluations (one section per Hyperscaler per Decision_Dimension), Decision Matrix, Recommendation, and Appendices
2. THE Report_Generator SHALL populate the Infrastructure Overview section using aggregated data from the Data_Collector
3. THE Report_Generator SHALL populate each Hyperscaler evaluation section with the scores, evidence, and commentary from the Dimension_Evaluator
4. THE Report_Generator SHALL include the Decision_Matrix as a formatted table in the report
5. THE Report_Generator SHALL include a Recommendation section that identifies the highest-scoring Hyperscaler and summarises the rationale based on the top-weighted Decision_Dimensions
6. IF any Sub_Factors remain unscored at the time of report generation, THEN THE Report_Generator SHALL include a completeness warning listing the unscored Sub_Factors

### Requirement 9: PowerPoint Executive Summary Generation

**User Story:** As a Lead Architect, I want to generate a PowerPoint executive summary, so that I can present the recommendation to DMG Media's leadership team.

#### Acceptance Criteria

1. WHEN the user requests executive summary generation, THE Report_Generator SHALL produce a PowerPoint file (.pptx) containing slides for: Title, Executive Summary, Key Findings per Decision_Dimension, Decision Matrix, and Recommendation
2. THE Report_Generator SHALL include a visual chart (bar or radar) comparing the three Hyperscalers' overall weighted scores
3. THE Report_Generator SHALL limit the executive summary to no more than 12 slides
4. THE Report_Generator SHALL use the same scores and rankings as the Word document report

### Requirement 10: Workflow Progress Tracking

**User Story:** As a Lead Architect, I want to track my progress through the assessment workflow, so that I know which sections are complete and which still need work.

#### Acceptance Criteria

1. THE Workflow_Manager SHALL track completion status for each step: Infrastructure Data Imported, Hyperscaler Proposals Captured, Dimension Weights Set, All Sub_Factors Scored, Report Generated, Executive Summary Generated
2. WHEN the user requests workflow status, THE Workflow_Manager SHALL return the completion status of each step and an overall completion percentage
3. THE Workflow_Manager SHALL calculate overall completion percentage as the number of completed steps divided by the total number of steps, expressed as a percentage
4. IF the user attempts to generate a report before all Sub_Factors are scored, THEN THE Workflow_Manager SHALL warn the user and require explicit confirmation to proceed

