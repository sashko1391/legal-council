/**
 * Generation Validator Agent
 * Checks legal compliance and ДСТУ standards of drafted document
 * 
 * FIX #10: Uses 'gen-validator' role (distinct from review 'validator')
 * FIX #23: Imports buildValidatorPrompt directly (removed wrapper buildGenerationValidatorPrompt)
 */

import { BaseAgent } from '../base-agent';
import { buildValidatorPrompt } from '../../config/generation-prompts';
import { createGenerationAgentConfigs } from '../../config/models';
import type {
  GenerationValidatorOutput,
  DrafterOutput,
  AnalyzerOutput,
} from '../../types/generation-types';

export class GenerationValidatorAgent extends BaseAgent<GenerationValidatorOutput> {
  constructor() {
    const configs = createGenerationAgentConfigs();
    // FIX #10: Now looks for 'gen-validator' role
    const validatorConfig = configs.find((c) => c.role === 'gen-validator')!;

    super(validatorConfig, '');
  }

  /**
   * Validate drafted document for legal compliance
   */
  async validate(
    analyzerOutput: AnalyzerOutput,
    drafterOutput: DrafterOutput
  ): Promise<GenerationValidatorOutput> {
    // FIX #23: Direct call instead of wrapper
    this.systemPrompt = await buildValidatorPrompt();

    const userPrompt = this.buildUserPrompt(analyzerOutput, drafterOutput);
    const output = await this.call(userPrompt);

    this.validateOutput(output);
    return output;
  }

  private buildUserPrompt(
    analyzerOutput: AnalyzerOutput,
    drafterOutput: DrafterOutput
  ): string {
    let prompt = '# ORIGINAL REQUIREMENTS\n\n';
    prompt += '```json\n';
    prompt += JSON.stringify(analyzerOutput.analysis.structuredRequirements, null, 2);
    prompt += '\n```\n\n';

    prompt += '# DRAFTED DOCUMENT\n\n';
    prompt += '```\n';
    prompt += drafterOutput.draft.documentText;
    prompt += '\n```\n\n';

    prompt += '# YOUR VALIDATION TASK\n\n';
    prompt += 'Check this document against:\n';
    prompt += '1. Ukrainian law requirements (ЦКУ ст. 638)\n';
    prompt += '2. ДСТУ 4163-2020 structure\n';
    prompt += '3. Completeness (all required clauses present)\n';
    prompt += '4. Legal risks (ambiguous terms, liability gaps)\n';
    prompt += '\nOutput strict JSON with compliance checks and risk flags.\n';

    return prompt;
  }

  private validateOutput(output: any): void {
    if (!output.validation || !output.validation.verdict) {
      throw new Error('Validator output missing verdict');
    }

    const validVerdicts = ['APPROVED', 'NEEDS_REVISION'];
    if (!validVerdicts.includes(output.validation.verdict)) {
      throw new Error(`Invalid verdict: ${output.validation.verdict}`);
    }
  }

  isPassed(output: GenerationValidatorOutput): boolean {
    return output.validation.verdict === 'APPROVED';
  }
}

export async function validateDocument(
  analyzerOutput: AnalyzerOutput,
  drafterOutput: DrafterOutput
): Promise<GenerationValidatorOutput> {
  const validator = new GenerationValidatorAgent();
  return validator.validate(analyzerOutput, drafterOutput);
}
