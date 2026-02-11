/**
 * Polisher Agent (Document Generation)
 * Finalizes document with professional quality
 */

import { BaseAgent } from '../base-agent';
import { buildPolisherPrompt } from '../../config/generation-prompts';
import { createGenerationAgentConfigs } from '../../config/models';
import type {
  PolisherOutput,
  DrafterOutput,
  GenerationValidatorOutput,
  DocumentGenerationResponse,
} from '../../types/generation-types';

export class PolisherAgent extends BaseAgent<PolisherOutput> {
  constructor() {
    const configs = createGenerationAgentConfigs();
    const polisherConfig = configs.find((c) => c.role === 'polisher')!;

    super(polisherConfig, '');
  }

  /**
   * Polish draft into final executive-ready document
   */
  async polish(
    drafterOutput: DrafterOutput,
    validatorOutput: GenerationValidatorOutput
  ): Promise<PolisherOutput> {
    this.systemPrompt = await buildPolisherPrompt();

    const userPrompt = this.buildUserPrompt(drafterOutput, validatorOutput);
    const output = await this.call(userPrompt);

    this.validateOutput(output);
    return output;
  }

  private buildUserPrompt(
    drafterOutput: DrafterOutput,
    validatorOutput: GenerationValidatorOutput
  ): string {
    let prompt = '# DRAFT DOCUMENT\n\n';
    prompt += '```\n';
    prompt += drafterOutput.draft.documentText;
    prompt += '\n```\n\n';

    prompt += '# VALIDATOR FEEDBACK\n\n';
    prompt += '```json\n';
    prompt += JSON.stringify(validatorOutput.validation, null, 2);
    prompt += '\n```\n\n';

    if (validatorOutput.validation.riskFlags.length > 0) {
      prompt += '# ISSUES TO ADDRESS\n\n';
      validatorOutput.validation.riskFlags.forEach((flag) => {
        prompt += `- ${flag.issue} (severity ${flag.severity}): ${flag.recommendation}\n`;
      });
      prompt += '\n';
    }

    prompt += '# YOUR POLISHING TASK\n\n';
    prompt += '1. Fix any issues identified by Validator\n';
    prompt += '2. Improve clarity and readability\n';
    prompt += '3. Ensure consistency throughout\n';
    prompt += '4. Add executive summary for client\n';
    prompt += '\nOutput strict JSON with polished document and improvements made.\n';

    return prompt;
  }

  private validateOutput(output: any): void {
    if (!output.polished || !output.polished.finalDocument) {
      throw new Error('Polisher output missing finalDocument');
    }

    if (!output.polished.executiveSummary) {
      console.warn('⚠️ Polisher missing executive summary');
    }
  }

  buildFinalResponse(
    polisherOutput: PolisherOutput,
    analyzerOutput: any,
    drafterOutput: DrafterOutput,
    validatorOutput: GenerationValidatorOutput,
    metadata: {
      documentType: string;
      totalCost: number;
      processingTimeMs: number;
    }
  ): DocumentGenerationResponse {
    return {
      finalDocument: polisherOutput.polished.finalDocument,
      format: 'markdown',

      metadata: {
        documentType: metadata.documentType as any,
        generatedAt: new Date().toISOString(),
        jurisdiction: 'Ukraine',
        confidence: polisherOutput.confidence,
        totalCost: metadata.totalCost,
        processingTimeMs: metadata.processingTimeMs,
      },

      summary: {
        executiveSummary: polisherOutput.polished.executiveSummary,
        keyTerms: polisherOutput.polished.keyTerms,
        includedClauses: drafterOutput.draft.includedClauses.map((c) => c.type),
      },

      qualityMetrics: {
        complianceScore: validatorOutput.validation.overallScore,
        legalSoundness: validatorOutput.validation.overallScore,
        clarity: 85, // Could be calculated from polisher improvements
        overall: validatorOutput.validation.overallScore,
      },

      recommendations: {
        beforeSigning: [
          'Перевірте всі реквізити сторін перед підписанням',
          'Переконайтеся, що всі суми та дати заповнені правильно',
          'Зверніть увагу на розділи про відповідальність та розірвання договору',
        ],
        customizations:
          polisherOutput.polished.improvements?.map((i) => i.rationale) || [],
        reviewAreas:
          validatorOutput.validation.riskFlags.map((f) => f.location) || [],
      },
    };
  }
}

export async function polishDocument(
  drafterOutput: DrafterOutput,
  validatorOutput: GenerationValidatorOutput
): Promise<PolisherOutput> {
  const polisher = new PolisherAgent();
  return polisher.polish(drafterOutput, validatorOutput);
}
