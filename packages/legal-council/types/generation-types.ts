/**
 * Document Generation Types
 * 
 * FIX #10: gen-validator role
 * FIX #11: Partial<Record> for COMMON_CLAUSES (no `as any`)
 * FIX #18 (Feb 13, 2026): All ClauseType templates filled in (Ukrainian)
 */

import { BaseAgentOutput } from '../../core/orchestrator/types';

// ==========================================
// INPUT TYPES
// ==========================================

export interface DocumentGenerationRequest {
  documentType: DocumentType;
  requirements: string;
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
    documentText: string;
    structure: DocumentStructure;
    includedClauses: GeneratedClause[];
    notes: string[];
  };
}

export interface GenerationValidatorOutput extends BaseAgentOutput {
  role: 'gen-validator';
  validation: {
    legalCompliance: ComplianceCheck[];
    missingElements: string[];
    riskFlags: RiskFlag[];
    overallScore: number;
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
  alternatives?: string[];
}

export interface DocumentStructure {
  title: string;
  preamble: string;
  definitions: { term: string; definition: string }[];
  mainClauses: { section: string; title: string; subsections: number }[];
  signatures: { party: string; signatureLine: string }[];
}

export interface ComplianceCheck {
  requirement: string;
  status: 'met' | 'not_met' | 'partial';
  details: string;
}

export interface RiskFlag {
  severity: 1 | 2 | 3 | 4 | 5;
  issue: string;
  location: string;
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
    includedClauses: string[];
  };
  
  qualityMetrics: {
    complianceScore: number;
    legalSoundness: number;
    clarity: number;
    overall: number;
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
  variables: string[];
}

/**
 * FIX #18: Complete set of clause templates (Ukrainian legal language).
 * Now a full Record — all ClauseType values present, no `as any` needed.
 */
export const COMMON_CLAUSES: Record<ClauseType, string> = {
  termination: `Кожна із Сторін має право розірвати цей Договір, попередивши іншу Сторону за [NOTICE_PERIOD] до передбачуваної дати розірвання шляхом направлення письмового повідомлення. У разі істотного порушення умов Договору однією із Сторін, інша Сторона має право розірвати Договір в односторонньому порядку відповідно до ст. 651 ЦКУ.`,

  liability: `Сторони несуть відповідальність за невиконання або неналежне виконання своїх зобов'язань за цим Договором відповідно до чинного законодавства України. У жодному випадку жодна із Сторін не несе відповідальності за непрямі, побічні або штрафні збитки.`,

  indemnification: `[PARTY_A] зобов'язується відшкодувати [PARTY_B] будь-які збитки, витрати та вимоги третіх осіб, що виникли внаслідок порушення [PARTY_A] умов цього Договору або чинного законодавства України.`,

  confidentiality: `Сторони зобов'язуються не розголошувати конфіденційну інформацію, отриману в процесі виконання цього Договору, протягом строку дії Договору та [CONFIDENTIALITY_PERIOD] після його припинення. Зобов'язання щодо конфіденційності не поширюються на інформацію, що стала загальнодоступною не з вини Сторони, яка її отримала.`,

  ip_assignment: `Усі права інтелектуальної власності на результати робіт, створені на виконання цього Договору, переходять до [PARTY_B] з моменту їх створення та повної оплати відповідно до ст. 430 ЦКУ. [PARTY_A] гарантує, що результати робіт є оригінальними та не порушують прав третіх осіб.`,

  payment_terms: `[PARTY_B] зобов'язується сплатити [PARTY_A] суму у розмірі [AMOUNT] грн (у тому числі ПДВ) протягом [PAYMENT_PERIOD] з моменту [PAYMENT_TRIGGER]. Оплата здійснюється безготівковим розрахунком на банківський рахунок [PARTY_A]. У разі прострочення оплати нараховується пеня у розмірі [PENALTY_RATE]% від суми заборгованості за кожен день прострочення.`,

  dispute_resolution: `Спори, що виникають з цього Договору, вирішуються шляхом переговорів. У разі неможливості вирішення спору шляхом переговорів протягом [NEGOTIATION_PERIOD], спір передається на розгляд до господарського суду за місцезнаходженням відповідача відповідно до ГПК України.`,

  force_majeure: `Сторони звільняються від відповідальності за часткове або повне невиконання зобов'язань за цим Договором, якщо це невиконання стало наслідком обставин непереборної сили (форс-мажор), а саме: стихійних лих, воєнних дій, ембарго, дій органів влади, епідемій тощо. Сторона, для якої склались форс-мажорні обставини, зобов'язана повідомити іншу Сторону протягом [FORCE_MAJEURE_NOTICE] з підтвердженням ТПП України.`,

  warranties: `[PARTY_A] гарантує, що: (а) має всі необхідні дозволи та ліцензії для виконання цього Договору; (б) виконання Договору не порушує права третіх осіб; (в) результати робіт відповідатимуть вимогам, зазначеним у Додатку №1 до цього Договору.`,

  custom: `[CUSTOM_CLAUSE_TEXT]`,
};

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

/**
 * FIX #20: Document download formatting
 * Currently only markdown is fully supported.
 * DOCX and PDF require additional libraries (docx, pdfkit).
 */
export function formatDocumentForDownload(
  text: string,
  format: 'markdown' | 'docx' | 'pdf'
): string {
  switch (format) {
    case 'markdown':
      return text;
    case 'docx':
      // TODO: Integrate 'docx' library for proper Word export
      console.warn('⚠️ DOCX export not yet implemented — returning markdown');
      return text;
    case 'pdf':
      // TODO: Integrate 'pdfkit' or 'puppeteer' for PDF export
      console.warn('⚠️ PDF export not yet implemented — returning markdown');
      return text;
    default:
      return text;
  }
}
