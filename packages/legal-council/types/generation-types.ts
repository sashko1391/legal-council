/**
 * Document Generation Types
 * Specific to the Generation Tab workflow
 */

import { BaseAgentOutput } from '../../core/orchestrator/types';

// ==========================================
// INPUT TYPES
// ==========================================

export interface DocumentGenerationRequest {
  documentType: DocumentType;
  requirements: string; // User's natural language requirements
  jurisdiction?: string;
  parties?: PartyInfo[];
  specificClauses?: ClauseRequest[];
  template?: 'standard' | 'pro-client' | 'balanced' | 'custom';
}

export type DocumentType =
  | 'nda'
  | 'employment_agreement'
  | 'consulting_agreement'
  | 'saas_agreement'
  | 'vendor_contract'
  | 'partnership_agreement'
  | 'amendment'
  | 'custom_clause';

export interface PartyInfo {
  role: 'party_a' | 'party_b' | 'employer' | 'employee' | 'vendor' | 'client';
  name?: string;
  jurisdiction?: string;
  entityType?: 'individual' | 'corporation' | 'llc' | 'partnership';
}

export interface ClauseRequest {
  type: ClauseType;
  requirements: string;
  priority: 'must-have' | 'nice-to-have';
}

export type ClauseType =
  | 'termination'
  | 'liability'
  | 'indemnification'
  | 'confidentiality'
  | 'ip_assignment'
  | 'payment_terms'
  | 'dispute_resolution'
  | 'force_majeure'
  | 'warranties'
  | 'custom';

// ==========================================
// AGENT OUTPUTS (Generation-specific)
// ==========================================

export interface AnalyzerOutput extends BaseAgentOutput {
  role: 'analyzer';
  analysis: {
    structuredRequirements: StructuredRequirements;
    suggestedClauses: SuggestedClause[];
    potentialIssues: string[];
    clarificationsNeeded: string[];
  };
}

export interface DrafterOutput extends BaseAgentOutput {
  role: 'drafter';
  draft: {
    documentText: string; // Full contract text
    structure: DocumentStructure;
    includedClauses: GeneratedClause[];
    notes: string[];
  };
}

export interface GenerationValidatorOutput extends BaseAgentOutput {
  role: 'validator';
  validation: {
    legalCompliance: ComplianceCheck[];
    missingElements: string[];
    riskFlags: RiskFlag[];
    overallScore: number; // 0-100
    verdict: 'APPROVED' | 'NEEDS_REVISION';
  };
}

export interface PolisherOutput extends BaseAgentOutput {
  role: 'polisher';
  polished: {
    finalDocument: string;
    improvements: Improvement[];
    executiveSummary: string;
    keyTerms: KeyTerm[];
  };
}

// ==========================================
// DOMAIN OBJECTS
// ==========================================

export interface StructuredRequirements {
  documentType: DocumentType;
  parties: PartyInfo[];
  keyTerms: {
    duration?: string;
    paymentAmount?: string;
    deliverables?: string[];
    effectiveDate?: string;
  };
  mustHaveClauses: ClauseType[];
  jurisdiction: string;
  specialProvisions: string[];
}

export interface SuggestedClause {
  type: ClauseType;
  rationale: string;
  priority: 'essential' | 'recommended' | 'optional';
  standardText?: string;
}

export interface GeneratedClause {
  type: ClauseType;
  sectionNumber: string;
  title: string;
  text: string;
  alternatives?: string[]; // Alternative phrasings
}

export interface DocumentStructure {
  title: string;
  preamble: string;
  definitions: { term: string; definition: string }[];
  mainClauses: { section: string; title: string; subsections: number }[];
  signatures: { party: string; signatureLine: string }[];
}

export interface ComplianceCheck {
  requirement: string; // e.g., "Must include governing law clause"
  status: 'met' | 'not_met' | 'partial';
  details: string;
}

export interface RiskFlag {
  severity: 1 | 2 | 3 | 4 | 5;
  issue: string;
  location: string; // Clause reference
  recommendation: string;
}

export interface Improvement {
  type: 'clarity' | 'legal_precision' | 'formatting' | 'tone';
  before: string;
  after: string;
  rationale: string;
}

export interface KeyTerm {
  term: string;
  definition: string;
  importance: 'high' | 'medium' | 'low';
}

// ==========================================
// FINAL OUTPUT
// ==========================================

export interface DocumentGenerationResponse {
  finalDocument: string;
  format: 'markdown' | 'docx' | 'pdf';
  
  metadata: {
    documentType: DocumentType;
    generatedAt: string;
    jurisdiction?: string;
    confidence: number;
    totalCost: number;
    processingTimeMs: number;
  };
  
  summary: {
    executiveSummary: string;
    keyTerms: KeyTerm[];
    includedClauses: string[]; // List of clause types included
  };
  
  qualityMetrics: {
    complianceScore: number; // 0-100
    legalSoundness: number; // 0-100
    clarity: number; // 0-100
    overall: number; // 0-100
  };
  
  recommendations: {
    beforeSigning: string[];
    customizations: string[];
    reviewAreas: string[];
  };
}

// ==========================================
// TEMPLATES
// ==========================================

export interface ClauseTemplate {
  type: ClauseType;
  jurisdiction: string;
  template: 'standard' | 'pro-client' | 'balanced';
  text: string;
  variables: string[]; // e.g., ["{PARTY_A}", "{AMOUNT}"]
}

// Common templates
export const COMMON_CLAUSES: Record<ClauseType, string> = {
  termination: `Either party may terminate this Agreement upon [NOTICE_PERIOD] written notice to the other party.`,
  
  liability: `IN NO EVENT SHALL EITHER PARTY BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR PUNITIVE DAMAGES.`,
  
  confidentiality: `The Receiving Party shall hold and maintain the Confidential Information in strictest confidence.`,
  
  // ... (more would be defined in production)
} as any;

// ==========================================
// HELPER FUNCTIONS
// ==========================================

export function getDocumentTypeLabel(type: DocumentType): string {
  const labels: Record<DocumentType, string> = {
    nda: 'Non-Disclosure Agreement',
    employment_agreement: 'Employment Agreement',
    consulting_agreement: 'Consulting Agreement',
    saas_agreement: 'SaaS Agreement',
    vendor_contract: 'Vendor Contract',
    partnership_agreement: 'Partnership Agreement',
    amendment: 'Contract Amendment',
    custom_clause: 'Custom Clause',
  };
  return labels[type];
}

export function formatDocumentForDownload(text: string, format: 'markdown' | 'docx' | 'pdf'): string {
  // In production, this would actually convert formats
  // For now, just return markdown
  return text;
}
