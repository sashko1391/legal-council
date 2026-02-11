/**
 * Validator Agent (Contract Review)
 * Checks completeness and consistency of analysis
 * 
 * FIX (Feb 10, 2026): Transform flat LLM output to nested structure
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

export class ValidatorAgent extends BaseAgent<ValidatorOutput> {
  constructor() {
    const configs = createReviewAgentConfigs();
    const validatorConfig = configs.find((c) => c.role === 'validator')!;

    super(validatorConfig, '');
  }

  /**
   * Validate completeness of Expert and Provocateur analysis
   */
  async validate(
    request: ContractReviewRequest,
    expertOutput: ExpertOutput,
    provocateurOutput: ProvocateurOutput
  ): Promise<ValidatorOutput> {
    this.systemPrompt = await buildValidatorPrompt();

    const userPrompt = this.buildUserPrompt(request, expertOutput, provocateurOutput);

    const rawOutput = await this.call(userPrompt);

    // Transform flat to nested structure
    const output = this.transformOutput(rawOutput);

    this.validateOutput(output);

    return output;
  }

  /**
   * Build validation prompt with all inputs
   */
  private buildUserPrompt(
    request: ContractReviewRequest,
    expertOutput: ExpertOutput,
    provocateurOutput: ProvocateurOutput
  ): string {
    let prompt = '# ORIGINAL CONTRACT\n\n';
    prompt += '```\n';
    prompt += request.contractText;
    prompt += '\n```\n\n';

    // User's original request
    prompt += '# USER\'S QUERY\n\n';
    if (request.specificQuestions && request.specificQuestions.length > 0) {
      prompt += 'Specific questions asked:\n';
      request.specificQuestions.forEach((q, i) => {
        prompt += `${i + 1}. ${q}\n`;
      });
    }

    if (request.focusAreas && request.focusAreas.length > 0) {
      prompt += '\nFocus areas requested:\n';
      request.focusAreas.forEach((area) => {
        prompt += `- ${area}\n`;
      });
    }

    if (
      (!request.specificQuestions || request.specificQuestions.length === 0) &&
      (!request.focusAreas || request.focusAreas.length === 0)
    ) {
      prompt += 'General contract review requested (all aspects).\n';
    }

    // Expert's analysis
    prompt += '\n# EXPERT\'S ANALYSIS\n\n';
    prompt += '```json\n';
    prompt += JSON.stringify(expertOutput.analysis, null, 2);
    prompt += '\n```\n\n';

    // Provocateur's critique
    prompt += '# PROVOCATEUR\'S CRITIQUE\n\n';
    prompt += '```json\n';
    prompt += JSON.stringify(provocateurOutput.critique, null, 2);
    prompt += '\n```\n\n';

    // Validation task
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
   * Transform flat LLM output to nested structure
   */
  private transformOutput(rawOutput: any): ValidatorOutput {
    return {
      ...rawOutput,
      validation: {
        isComplete: rawOutput.isComplete,
        completenessScore: rawOutput.completenessScore,
        missingAspects: rawOutput.missingAspects,
        contradictions: rawOutput.contradictions,
        verdict: rawOutput.verdict,
        reason: rawOutput.reason,
      },
    } as ValidatorOutput;
  }

  /**
   * Validate output structure
   */
  private validateOutput(output: ValidatorOutput): void {
    const required = [
      'isComplete',
      'completenessScore',
      'missingAspects',
      'contradictions',
      'verdict',
    ];

    for (const field of required) {
      if (!(field in output.validation)) {
        throw new Error(`Validator output missing required field: validation.${field}`);
      }
    }

    // Validate score is in range
    if (
      output.validation.completenessScore < 0 ||
      output.validation.completenessScore > 100
    ) {
      console.warn(
        `⚠️ Validator completeness score out of range: ${output.validation.completenessScore}`
      );
    }

    // Validate verdict is valid
    const validVerdicts = ['COMPLETE', 'NEEDS_REVISION'];
    if (!validVerdicts.includes(output.validation.verdict)) {
      throw new Error(
        `Invalid verdict: ${output.validation.verdict}. Must be COMPLETE or NEEDS_REVISION`
      );
    }
  }

  /**
   * Check if validation passed (analysis is complete)
   */
  isPassed(output: ValidatorOutput): boolean {
    return output.validation.verdict === 'COMPLETE';
  }

  /**
   * Get critical missing aspects (if any)
   */
  getCriticalGaps(output: ValidatorOutput): string[] {
    if (output.validation.isComplete) {
      return [];
    }
    return output.validation.missingAspects;
  }

  /**
   * Get contradictions that need Synthesizer attention
   */
  getContradictions(output: ValidatorOutput): ValidatorOutput['validation']['contradictions'] {
    return output.validation.contradictions;
  }
}

/**
 * Quick way to validate analysis
 */
export async function validateAnalysis(
  request: ContractReviewRequest,
  expertOutput: ExpertOutput,
  provocateurOutput: ProvocateurOutput
): Promise<ValidatorOutput> {
  const validator = new ValidatorAgent();
  return validator.validate(request, expertOutput, provocateurOutput);
}
