/**
 * Polisher Agent (Document Generation)
 * Finalizes document with professional quality
 * 
 * FIX #14 (Feb 13, 2026): Calculate real clarity & quality metrics
 * FIX #11: Removed `as any` for documentType — use proper DocumentType type
 */

import { BaseAgent } from '../base-agent';
import { buildPolisherPrompt } from '../../config/generation-prompts';
import { createGenerationAgentConfigs } from '../../config/models';
import type {
  PolisherOutput,
  DrafterOutput,
  GenerationValidatorOutput,
  DocumentGenerationResponse,
  DocumentType,
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

  /**
   * FIX #14: Calculate real quality metrics instead of hardcoded values.
   * - complianceScore: from validator
   * - legalSoundness: average of validator score and polisher confidence
   * - clarity: calculated from improvements count and risk resolution
   * - overall: weighted average of all three
   */
  private calculateQualityMetrics(
    polisherOutput: PolisherOutput,
    validatorOutput: GenerationValidatorOutput
  ): { complianceScore: number; legalSoundness: number; clarity: number; overall: number } {
    const validatorScore = validatorOutput.validation.overallScore;
    const polisherConfidence = Math.round((polisherOutput.confidence || 0.85) * 100);
    
    // Compliance: directly from validator
    const complianceScore = validatorScore;

    // Legal soundness: average of validator score and polisher confidence
    const legalSoundness = Math.round((validatorScore + polisherConfidence) / 2);

    // Clarity: based on improvements made and risk flags resolved
    const improvementCount = polisherOutput.polished?.improvements?.length || 0;
    const riskFlagCount = validatorOutput.validation.riskFlags.length;
    // More improvements = better clarity work done
    // Base of 70, +5 per improvement (up to 30 bonus), -3 per unresolved risk
    const clarityBase = 70;
    const clarityBonus = Math.min(30, improvementCount * 5);
    const clarityPenalty = Math.min(20, riskFlagCount * 3);
    const clarity = Math.min(100, Math.max(0, clarityBase + clarityBonus - clarityPenalty));

    // Overall: weighted average (compliance 40%, legal 30%, clarity 30%)
    const overall = Math.round(
      complianceScore * 0.4 + legalSoundness * 0.3 + clarity * 0.3
    );

    return { complianceScore, legalSoundness, clarity, overall };
  }

  buildFinalResponse(
    polisherOutput: PolisherOutput,
    analyzerOutput: any,
    drafterOutput: DrafterOutput,
    validatorOutput: GenerationValidatorOutput,
    metadata: {
      documentType: DocumentType;  // FIX #11: proper type instead of `string` + `as any`
      totalCost: number;
      processingTimeMs: number;
    }
  ): DocumentGenerationResponse {
    // FIX #14: calculate real metrics
    const qualityMetrics = this.calculateQualityMetrics(polisherOutput, validatorOutput);

    return {
      finalDocument: polisherOutput.polished.finalDocument,
      format: 'markdown',

      metadata: {
        documentType: metadata.documentType,  // FIX #11: no more `as any`
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

      qualityMetrics,  // FIX #14: real calculated values

      recommendations: {
        beforeSigning: [
          'Перевірте всі реквізити сторін перед підписанням',
          'Переконайтесь, що всі суми та дати заповнені правильно',
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
