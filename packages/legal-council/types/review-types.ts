/**
 * Contract Review Types
 * Specific to the Review Tab workflow
 */

import { BaseAgentOutput } from '../../core/orchestrator/types';

// ==========================================
// INPUT TYPES
// ==========================================

export interface ContractReviewRequest {
  contractText: string;
  contractType?: ContractType;
  jurisdiction?: string;
  specificQuestions?: string[];
  focusAreas?: FocusArea[];
}

export type ContractType =
  | 'employment'
  | 'vendor'
  | 'saas'
  | 'nda'
  | 'consulting'
  | 'partnership'
  | 'custom';

export type FocusArea =
  | 'termination'
  | 'liability'
  | 'payment'
  | 'ip_rights'
  | 'confidentiality'
  | 'warranties'
  | 'dispute_resolution';

// ==========================================
// AGENT OUTPUTS (Review-specific)
// ==========================================

export interface ExpertOutput extends BaseAgentOutput {
  role: 'expert';
  analysis: {
    executiveSummary: string;
    keyIssues: Issue[];
    clauseAnalysis: ClauseAnalysis[];
    overallRiskScore: number; // 1-10
    recommendations: Recommendation[];
  };
}

export interface ProvocateurOutput extends BaseAgentOutput {
  role: 'provocateur';
  critique: {
    flaws: Flaw[];
    maxSeverity: number; // Highest flaw severity
    exploitationScenarios: string[];
  };
}

export interface ValidatorOutput extends BaseAgentOutput {
  role: 'validator';
  validation: {
    isComplete: boolean;
    completenessScore: number; // 0-100
    missingAspects: string[];
    contradictions: Contradiction[];
    verdict: 'COMPLETE' | 'NEEDS_REVISION';
  };
}

export interface SynthesizerOutput extends BaseAgentOutput {
  role: 'synthesizer';
  synthesis: {
    summary: string;
    criticalRisks: CriticalRisk[];
    recommendations: Recommendation[];
    confidence: number;
    keyDisagreements: string[];
  };
}

// ==========================================
// DOMAIN OBJECTS
// ==========================================

export interface Issue {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  clauseReference?: string;
  category: IssueCategory;
  legalBasis?: string;
}

export type Severity = 1 | 2 | 3 | 4 | 5; // 5 = critical

export type IssueCategory =
  | 'ambiguous_language'
  | 'missing_protection'
  | 'liability_gap'
  | 'unfavorable_terms'
  | 'compliance_risk'
  | 'termination_risk';

export interface ClauseAnalysis {
  sectionNumber: string;
  title: string;
  content: string;
  assessment: 'favorable' | 'neutral' | 'unfavorable' | 'critical';
  issues: string[];
  recommendations: string[];
}

export interface Flaw {
  id: string;
  severity: Severity;
  clauseReference: string;
  issue: string;
  exploitationScenario: string;
  suggestedFix: string;
}

export interface Contradiction {
  source1: string; // e.g., "Expert"
  source2: string; // e.g., "Provocateur"
  subject: string;
  description: string;
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  action: string;
  rationale: string;
  specificLanguage?: string; // Suggested clause text
}

export interface CriticalRisk {
  title: string;
  description: string;
  impact: string;
  mitigation: string;
}

// ==========================================
// FINAL OUTPUT
// ==========================================

export interface ContractReviewResponse {
  summary: string;
  overallRiskScore: number; // 1-10
  confidence: number; // 0-1
  
  criticalRisks: CriticalRisk[];
  recommendations: Recommendation[];
  
  detailedAnalysis: {
    expertAnalysis: ExpertOutput['analysis'];
    flawsFound: Flaw[];
    validationResults: ValidatorOutput['validation'];
  };
  
  metadata: {
    contractType: ContractType;
    jurisdiction?: string;
    analyzedAt: string;
    totalCost: number;
    processingTimeMs: number;
  };
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

export function getSeverityLabel(severity: Severity): string {
  const labels = {
    1: 'Minor',
    2: 'Low',
    3: 'Moderate',
    4: 'High',
    5: 'Critical',
  };
  return labels[severity];
}

export function getRiskColor(score: number): string {
  if (score >= 8) return 'red';
  if (score >= 6) return 'orange';
  if (score >= 4) return 'yellow';
  return 'green';
}
