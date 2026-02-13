/**
 * Validator Agent (Contract Review)
 * Checks completeness and consistency of analysis
 * 
 * FIX (Feb 10, 2026): Transform flat LLM output to nested structure
 * FIX (Feb 13, 2026): Resilient transformOutput — handles various LLM output formats
 *   - Nested (validation.verdict) or flat (verdict) structures
 *   - Alternative field names (overall_completeness → verdict mapping)
 *   - Never throws on missing fields — uses sensible defaults
 */

import { BaseAgent } from '../base-agent';
import { buildValidatorPrompt } from '../../config/review-prompts';
import { createReviewAgentConfigs } from '../../config/models';
import type {
  ValidatorOutput,
  ExpertOutput,
  ProvocateurOutput,
  ContractReviewRequest,
} from '../../types/review-types';
import { logger } from '../../utils/logger';

export class ValidatorAgent extends BaseAgent<ValidatorOutput> {
  constructor() {
    const configs = createReviewAgentConfigs();
    const validatorConfig = configs.find((c) => c.role === 'validator')!;
    super(validatorConfig, '');
  }

  async validate(
    request: ContractReviewRequest,
    expertOutput: ExpertOutput,
    provocateurOutput: ProvocateurOutput
  ): Promise<ValidatorOutput> {
    this.systemPrompt = await buildValidatorPrompt();
    const userPrompt = this.buildUserPrompt(request, expertOutput, provocateurOutput);
    const rawOutput = await this.call(userPrompt);

    // Transform and normalize whatever structure LLM returned
    const output = this.transformOutput(rawOutput);
    this.validateOutput(output);
    return output;
  }

  private buildUserPrompt(
    request: ContractReviewRequest,
    expertOutput: ExpertOutput,
    provocateurOutput: ProvocateurOutput
  ): string {
    let prompt = '# ORIGINAL CONTRACT\n\n';
    prompt += '```\n';
    prompt += request.contractText;
    prompt += '\n```\n\n';

    prompt += '# USER\'S QUERY\n\n';
    if (request.specificQuestions && request.specificQuestions.length > 0) {
      prompt += 'Specific questions asked:\n';
      request.specificQuestions.forEach((q, i) => { prompt += `${i + 1}. ${q}\n`; });
    }
    if (request.focusAreas && request.focusAreas.length > 0) {
      prompt += '\nFocus areas requested:\n';
      request.focusAreas.forEach((area) => { prompt += `- ${area}\n`; });
    }
    if (
      (!request.specificQuestions || request.specificQuestions.length === 0) &&
      (!request.focusAreas || request.focusAreas.length === 0)
    ) {
      prompt += 'General contract review requested (all aspects).\n';
    }

    prompt += '\n# EXPERT\'S ANALYSIS\n\n';
    prompt += '```json\n';
    prompt += JSON.stringify(expertOutput.analysis, null, 2);
    prompt += '\n```\n\n';

    prompt += '# PROVOCATEUR\'S CRITIQUE\n\n';
    prompt += '```json\n';
    prompt += JSON.stringify(provocateurOutput.critique, null, 2);
    prompt += '\n```\n\n';

    prompt += '# YOUR VALIDATION TASK\n\n';
    prompt += 'Check if Expert and Provocateur properly addressed ALL aspects:\n';
    prompt += '1. Did they cover everything the user asked about?\n';
    prompt += '2. Are there contradictions between Expert and Provocateur?\n';
    prompt += '3. Are standard clauses for this contract type reviewed?\n';
    prompt += '4. Are recommendations actionable?\n';
    prompt += '\nOutput strict JSON format as specified in system prompt.\n';

    return prompt;
  }

  /**
   * RESILIENT transform: handles nested, flat, and alternative field names.
   * 
   * LLMs may return:
   * A) Flat:    { verdict: "COMPLETE", completenessScore: 85, ... }
   * B) Nested:  { validation: { verdict: "COMPLETE", ... } }
   * C) Alt keys: { validation: { overall_completeness: "partial", ... } }
   * D) Mixed:   { isComplete: true, critique: { ... }, ... }
   */
  private transformOutput(rawOutput: any): ValidatorOutput {
    // Step 1: Find the "source" object — could be root or nested
    const src = rawOutput.validation || rawOutput;

    // Step 2: Extract verdict with fallback mapping
    const verdict = this.extractVerdict(src, rawOutput);

    // Step 3: Extract completeness score
    const completenessScore = this.extractCompletenessScore(src, rawOutput);

    // Step 4: Extract boolean isComplete
    const isComplete = verdict === 'COMPLETE';

    // Step 5: Extract arrays with fallbacks
    const missingAspects = this.extractArray(src, [
      'missingAspects', 'missing_aspects', 'missingAreas', 'missing_areas', 'gaps',
    ]);

    const contradictions = this.extractArray(src, [
      'contradictions', 'conflicts', 'disagreements',
    ]);

    // Step 6: Extract reason/overallAssessment
    const reason = src.reason || src.overall_assessment || src.overallAssessment ||
      src.summary || rawOutput.reason || rawOutput.overall_assessment ||
      (verdict === 'COMPLETE' ? 'Analysis is complete' : 'Analysis needs revision');

    logger.debug(`Validator transform: verdict=${verdict}, score=${completenessScore}, missing=${missingAspects.length}, contradictions=${contradictions.length}`);

    return {
      ...rawOutput,
      validation: {
        isComplete,
        completenessScore,
        missingAspects,
        contradictions,
        verdict,
        reason,
        overallAssessment: reason,
      },
    } as ValidatorOutput;
  }

  /**
   * Extract verdict from various possible field names and values
   */
  private extractVerdict(src: any, root: any): 'COMPLETE' | 'NEEDS_REVISION' {
    // Direct verdict field
    const directVerdict = src.verdict || root.verdict;
    if (directVerdict) {
      const upper = String(directVerdict).toUpperCase().trim();
      if (upper === 'COMPLETE' || upper === 'APPROVED' || upper === 'PASS' || upper === 'PASSED') {
        return 'COMPLETE';
      }
      if (upper === 'NEEDS_REVISION' || upper === 'NEEDS REVISION' || upper === 'FAIL' || upper === 'FAILED' || upper === 'INCOMPLETE') {
        return 'NEEDS_REVISION';
      }
    }

    // Alternative: overall_completeness
    const completeness = src.overall_completeness || src.overallCompleteness || root.overall_completeness;
    if (completeness) {
      const lower = String(completeness).toLowerCase().trim();
      if (lower === 'complete' || lower === 'full' || lower === 'yes') return 'COMPLETE';
      if (lower === 'partial' || lower === 'incomplete' || lower === 'no') return 'NEEDS_REVISION';
    }

    // Alternative: isComplete boolean
    const isComplete = src.isComplete ?? src.is_complete ?? root.isComplete;
    if (typeof isComplete === 'boolean') {
      return isComplete ? 'COMPLETE' : 'NEEDS_REVISION';
    }

    // Alternative: completeness score
    const score = this.extractCompletenessScore(src, root);
    if (score >= 80) return 'COMPLETE';

    // Default: if we have any data at all, assume needs revision
    logger.warn('Could not determine verdict from LLM output, defaulting to NEEDS_REVISION');
    return 'NEEDS_REVISION';
  }

  /**
   * Extract completeness score from various possible field names
   */
  private extractCompletenessScore(src: any, root: any): number {
    const candidates = [
      src.completenessScore, src.completeness_score, src.score, src.overallScore,
      src.overall_score, root.completenessScore, root.completeness_score, root.score,
    ];

    for (const val of candidates) {
      if (typeof val === 'number' && val >= 0 && val <= 100) return val;
      if (typeof val === 'string') {
        const parsed = parseFloat(val);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) return parsed;
      }
    }

    // Infer from verdict if possible
    const verdict = src.verdict || root.verdict || src.overall_completeness;
    if (verdict) {
      const v = String(verdict).toLowerCase();
      if (v === 'complete' || v === 'full' || v === 'approved') return 90;
      if (v === 'partial') return 60;
      if (v === 'incomplete') return 30;
    }

    return 70; // Safe default
  }

  /**
   * Extract an array from multiple possible field names
   */
  private extractArray(src: any, fieldNames: string[]): any[] {
    for (const name of fieldNames) {
      if (Array.isArray(src[name])) return src[name];
    }
    return [];
  }

  /**
   * Validate output — now lenient, only warns instead of throwing
   */
  private validateOutput(output: ValidatorOutput): void {
    if (!output.validation) {
      logger.warn('Validator output has no validation object — using defaults');
      return;
    }

    const { verdict, completenessScore } = output.validation;

    if (!['COMPLETE', 'NEEDS_REVISION'].includes(verdict)) {
      logger.warn(`Unexpected verdict value: ${verdict}`);
    }

    if (completenessScore < 0 || completenessScore > 100) {
      logger.warn(`Completeness score out of range: ${completenessScore}`);
    }
  }

  isPassed(output: ValidatorOutput): boolean {
    return output.validation.verdict === 'COMPLETE';
  }

  getCriticalGaps(output: ValidatorOutput): string[] {
    if (output.validation.isComplete) return [];
    return output.validation.missingAspects || [];
  }

  getContradictions(output: ValidatorOutput): ValidatorOutput['validation']['contradictions'] {
    return output.validation.contradictions || [];
  }
}

export async function validateAnalysis(
  request: ContractReviewRequest,
  expertOutput: ExpertOutput,
  provocateurOutput: ProvocateurOutput
): Promise<ValidatorOutput> {
  const validator = new ValidatorAgent();
  return validator.validate(request, expertOutput, provocateurOutput);
}
