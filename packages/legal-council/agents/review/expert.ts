/**
 * Expert Agent (Contract Review)
 * Comprehensive legal analysis of contracts
 * 
 * FIX (Feb 10, 2026): Validation expects flat structure from LLM
 */

import { BaseAgent } from '../base-agent';
import { buildExpertPrompt } from '../../config/review-prompts';
import { createReviewAgentConfigs } from '../../config/models';
import type { ExpertOutput, ContractReviewRequest } from '../../types/review-types';

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

    // Build user prompt with all context
    const userPrompt = this.buildUserPrompt(request);

    // Call LLM
    const rawOutput = await this.call(userPrompt);

    // Transform flat structure to nested structure
    const output = this.transformOutput(rawOutput);

    // Validate output structure
    this.validateOutput(output);

    return output;
  }

  /**
   * Build comprehensive user prompt
   */
  private buildUserPrompt(request: ContractReviewRequest): string {
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
      console.warn(
        `⚠️ Expert risk score out of range: ${output.analysis.overallRiskScore}`
      );
    }

    // Validate issues have severity
    for (const issue of output.analysis.keyIssues) {
      if (!issue.severity || issue.severity < 1 || issue.severity > 5) {
        console.warn(`⚠️ Issue ${issue.id} has invalid severity: ${issue.severity}`);
      }
    }

    // Validate we have exactly 7 issues (as per optimized prompt)
    const issueCount = output.analysis.keyIssues.length;
    if (issueCount !== 7) {
      console.warn(`⚠️ Expert returned ${issueCount} issues, expected 7 (as per prompt optimization)`);
    }

    // Validate we don't have too many recommendations
    const recCount = output.analysis.recommendations.length;
    if (recCount > 4) {
      console.warn(`⚠️ Expert returned ${recCount} recommendations, max should be 4`);
    }
  }
}

// ==========================================
// CONVENIENCE FUNCTION
// ==========================================

/**
 * Quick way to get expert analysis
 */
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
