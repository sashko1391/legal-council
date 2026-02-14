/**
 * Expert Agent (Contract Review)
 * Comprehensive legal analysis of contracts
 * 
 * FIX (Feb 10, 2026): Validation expects flat structure from LLM
 * UPDATE (Feb 14, 2026): RAG integration — semantic search for relevant law articles
 * FIX C2 (Feb 14, 2026): Added Ukrainian contract type mapping (оренда→lease, etc.)
 * FIX M2 (Feb 14, 2026): Replaced console.log/warn with structured logger
 */

import { BaseAgent } from '../base-agent';
import { buildExpertPrompt } from '../../config/review-prompts';
import { createReviewAgentConfigs } from '../../config/models';
import { getLawContext } from '../../services/law-rag-service';
import { createAgentLogger } from '../../utils/logger';
import type { ExpertOutput, ContractReviewRequest } from '../../types/review-types';

const log = createAgentLogger('expert');

export class ExpertAgent extends BaseAgent<ExpertOutput> {
  constructor() {
    const configs = createReviewAgentConfigs();
    const expertConfig = configs.find((c: any) => c.role === 'expert')!;

    // System prompt will be set dynamically based on contract type
    super(expertConfig, ''); // Empty for now, set in analyze()
  }

  /**
   * Analyze contract and return comprehensive expert opinion
   */
  async analyze(request: ContractReviewRequest): Promise<ExpertOutput> {
    // Build context-aware system prompt
    this.systemPrompt = await buildExpertPrompt(
      request.contractType,
      request.jurisdiction
    );

    // RAG: Find relevant law articles based on actual contract text
    const lawContext = await this.findRelevantLaws(
      request.contractText,
      request.contractType
    );

    // Build user prompt with all context + RAG results
    const userPrompt = this.buildUserPrompt(request, lawContext);

    // Call LLM
    const rawOutput = await this.call(userPrompt);

    // Transform flat structure to nested structure
    const output = this.transformOutput(rawOutput);

    // Validate output structure
    this.validateOutput(output);

    return output;
  }

  /**
   * RAG: Search Pinecone for relevant Ukrainian law articles
   * Falls back gracefully if Pinecone is unavailable
   * 
   * FIX C2: Maps both English AND Ukrainian contract type names to RAG categories
   */
  private async findRelevantLaws(
    contractText: string,
    contractType?: string
  ): Promise<string> {
    try {
      // FIX C2: Map contract types to RAG categories
      // Supports both English keys (from API) and Ukrainian keys (from UI)
      const typeMap: Record<string, string> = {
        // English
        'vendor': 'sale',
        'sale': 'sale',
        'lease': 'lease',
        'rental': 'lease',
        'service': 'service',
        'employment': 'employment',
        'work': 'work',
        'loan': 'loan',
        'nda': 'general',
        // Ukrainian (from UI select options)
        'оренда': 'lease',
        'поставка': 'sale',
        'послуги': 'service',
        'трудовий': 'employment',
        'підряд': 'work',
        'купівля-продаж': 'sale',
        'інше': 'general',
      };
      
      const ragType = typeMap[(contractType || '').toLowerCase()] || 'general';
      
      const lawContext = await getLawContext(contractText, ragType);
      log.info(`RAG: found relevant articles for type="${ragType}" (input="${contractType}")`);
      return lawContext;
    } catch (error) {
      log.warn('RAG unavailable, proceeding without law context:', error);
      return '<relevant_law_articles>\nRAG система тимчасово недоступна. Використовуйте загальні знання українського законодавства.\n</relevant_law_articles>';
    }
  }

  /**
   * Build comprehensive user prompt
   */
  private buildUserPrompt(
    request: ContractReviewRequest,
    lawContext: string
  ): string {
    let prompt = '# CONTRACT TO ANALYZE\n\n';
    prompt += '```\n';
    prompt += request.contractText;
    prompt += '\n```\n\n';

    // Add contract metadata
    prompt += '# CONTEXT\n\n';
    if (request.contractType) {
      prompt += `Contract Type: ${request.contractType}\n`;
    }
    if (request.jurisdiction) {
      prompt += `Jurisdiction: ${request.jurisdiction}\n`;
    }

    // Add RAG results — relevant law articles
    prompt += '\n# RELEVANT UKRAINIAN LAW ARTICLES\n\n';
    prompt += lawContext;
    prompt += '\n\n';
    prompt += 'ВАЖЛИВО: Цитуйте конкретні статті з наведеного списку у вашому аналізі. ';
    prompt += 'Якщо стаття має позначку "critical" — обов\'язково згадайте її у відповідних issues.\n';

    // Add specific questions if provided
    if (request.specificQuestions && request.specificQuestions.length > 0) {
      prompt += '\n# SPECIFIC QUESTIONS FROM CLIENT\n\n';
      request.specificQuestions.forEach((q: string, i: number) => {
        prompt += `${i + 1}. ${q}\n`;
      });
    }

    // Add focus areas if provided
    if (request.focusAreas && request.focusAreas.length > 0) {
      prompt += '\n# PRIORITY FOCUS AREAS\n\n';
      prompt += 'Pay special attention to:\n';
      request.focusAreas.forEach((area: any) => {
        prompt += `- ${area}\n`;
      });
    }

    prompt += '\n# YOUR TASK\n\n';
    prompt += 'Provide comprehensive analysis following the JSON structure specified in your system prompt.\n';
    prompt += 'Be thorough, specific, and reference exact clause numbers.\n';
    prompt += 'ОБОВ\'ЯЗКОВО посилайтесь на конкретні статті ЦКУ/КЗпП з розділу RELEVANT UKRAINIAN LAW ARTICLES.\n';

    return prompt;
  }

  /**
   * Transform flat LLM output to nested ExpertOutput structure
   */
  private transformOutput(rawOutput: any): ExpertOutput {
    // LLM returns flat structure: { executiveSummary, keyIssues, ... }
    // We need nested: { analysis: { executiveSummary, keyIssues, ... } }
    
    return {
      ...rawOutput,
      analysis: {
        executiveSummary: rawOutput.executiveSummary,
        keyIssues: rawOutput.keyIssues,
        clauseAnalysis: rawOutput.clauseAnalysis,
        overallRiskScore: rawOutput.overallRiskScore,
        recommendations: rawOutput.recommendations,
      },
    } as ExpertOutput;
  }

  /**
   * Validate that output has required structure
   */
  private validateOutput(output: ExpertOutput): void {
    if (!output.analysis) {
      throw new Error('Expert output missing analysis object');
    }

    const required = [
      'executiveSummary',
      'keyIssues',
      'clauseAnalysis',
      'overallRiskScore',
      'recommendations',
    ];

    for (const field of required) {
      if (!(field in output.analysis)) {
        throw new Error(`Expert output missing required field: analysis.${field}`);
      }
    }

    // Validate risk score is in range
    if (
      output.analysis.overallRiskScore < 1 ||
      output.analysis.overallRiskScore > 10
    ) {
      log.warn(`Risk score out of range: ${output.analysis.overallRiskScore}`);
    }

    // Validate issues have severity
    for (const issue of output.analysis.keyIssues) {
      if (!issue.severity || issue.severity < 1 || issue.severity > 5) {
        log.warn(`Issue ${issue.id} has invalid severity: ${issue.severity}`);
      }
    }

    // Validate we have exactly 7 issues (as per optimized prompt)
    const issueCount = output.analysis.keyIssues.length;
    if (issueCount !== 7) {
      log.warn(`Returned ${issueCount} issues, expected 7 (prompt optimization)`);
    }

    // Validate we don't have too many recommendations
    const recCount = output.analysis.recommendations.length;
    if (recCount > 4) {
      log.warn(`Returned ${recCount} recommendations, max should be 4`);
    }
  }
}

// ==========================================
// CONVENIENCE FUNCTION
// ==========================================

export async function getExpertAnalysis(
  contractText: string,
  options?: {
    contractType?: ContractReviewRequest['contractType'];
    jurisdiction?: string;
    questions?: string[];
    focusAreas?: ContractReviewRequest['focusAreas'];
  }
): Promise<ExpertOutput> {
  const expert = new ExpertAgent();

  const request: ContractReviewRequest = {
    contractText,
    contractType: options?.contractType,
    jurisdiction: options?.jurisdiction || 'Ukraine',
    specificQuestions: options?.questions,
    focusAreas: options?.focusAreas,
  };

  return expert.analyze(request);
}
