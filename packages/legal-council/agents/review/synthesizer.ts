/**
 * Synthesizer Agent (Contract Review)
 * Combines all council outputs into final executive summary
 * 
 * FIX (Feb 10, 2026): Transform flat LLM output to nested structure
 */

import { BaseAgent } from '../base-agent';
import { buildSynthesizerPrompt } from '../../config/review-prompts';
import { createReviewAgentConfigs } from '../../config/models';
import type {
  SynthesizerOutput,
  ExpertOutput,
  ProvocateurOutput,
  ValidatorOutput,
} from '../../types/review-types';

export class SynthesizerAgent extends BaseAgent<SynthesizerOutput> {
  constructor() {
    const configs = createReviewAgentConfigs();
    const synthesizerConfig = configs.find((c) => c.role === 'synthesizer')!;

    super(synthesizerConfig, '');
  }

  /**
   * Synthesize all council outputs into final answer
   */
  async synthesize(
    expertOutput: ExpertOutput,
    provocateurOutput: ProvocateurOutput,
    validatorOutput: ValidatorOutput
  ): Promise<SynthesizerOutput> {
    this.systemPrompt = await buildSynthesizerPrompt();

    const userPrompt = this.buildUserPrompt(
      expertOutput,
      provocateurOutput,
      validatorOutput
    );

    const rawOutput = await this.call(userPrompt);

    // Transform flat to nested structure
    const output = this.transformOutput(rawOutput);

    this.validateOutput(output);

    return output;
  }

  /**
   * Build synthesis prompt with all council outputs
   */
  private buildUserPrompt(
    expertOutput: ExpertOutput,
    provocateurOutput: ProvocateurOutput,
    validatorOutput: ValidatorOutput
  ): string {
    let prompt = '# AI COUNCIL OUTPUTS TO SYNTHESIZE\n\n';

    // Expert analysis
    prompt += '## EXPERT ANALYSIS\n\n';
    prompt += '```json\n';
    prompt += JSON.stringify(expertOutput.analysis, null, 2);
    prompt += '\n```\n\n';
    prompt += `Expert Confidence: ${(expertOutput.confidence * 100).toFixed(0)}%\n\n`;

    // Provocateur critique
    prompt += '## PROVOCATEUR CRITIQUE (Red-Team)\n\n';
    prompt += '```json\n';
    prompt += JSON.stringify(provocateurOutput.critique, null, 2);
    prompt += '\n```\n\n';
    prompt += `Provocateur Confidence: ${(provocateurOutput.confidence * 100).toFixed(0)}%\n`;
    prompt += `Max Severity Found: ${provocateurOutput.critique.maxSeverity}/5\n\n`;

    // Validator results
    prompt += '## VALIDATOR ASSESSMENT\n\n';
    prompt += '```json\n';
    prompt += JSON.stringify(validatorOutput.validation, null, 2);
    prompt += '\n```\n\n';
    prompt += `Completeness: ${validatorOutput.validation.completenessScore}%\n`;
    prompt += `Verdict: ${validatorOutput.validation.verdict}\n\n`;

    // Synthesis instructions
    prompt += '# YOUR SYNTHESIS TASK\n\n';
    prompt += '1. **Prioritize by severity**: Lead with highest-risk issues\n';
    prompt += '2. **Resolve contradictions**: If Expert and Provocateur disagree, explain both views and make judgment\n';
    prompt += '3. **Consolidate duplicates**: Don\'t repeat same issue twice\n';
    prompt += '4. **Be actionable**: Every risk needs clear mitigation\n';
    prompt += '5. **Plain language**: Client-friendly, not overly technical\n';
    prompt += '6. **Balanced**: Honest about risks, but not alarmist\n';
    prompt += '\nIf Validator found contradictions, address them in keyDisagreements.\n';
    prompt += '\nOutput strict JSON format as specified in system prompt.\n';

    return prompt;
  }

  /**
   * Transform flat LLM output to nested structure
   */
  private transformOutput(rawOutput: any): SynthesizerOutput {
    return {
      ...rawOutput,
      synthesis: {
        summary: rawOutput.summary,
        criticalRisks: rawOutput.criticalRisks,
        recommendations: rawOutput.recommendations,
        confidence: rawOutput.confidence || rawOutput.synthesisConfidence || 0.8,
        keyDisagreements: rawOutput.keyDisagreements || [],
      },
    } as SynthesizerOutput;
  }

  /**
   * Validate output structure
   */
  private validateOutput(output: SynthesizerOutput): void {
    const required = ['summary', 'criticalRisks', 'recommendations', 'confidence'];

    for (const field of required) {
      if (!(field in output.synthesis)) {
        throw new Error(`Synthesizer output missing required field: synthesis.${field}`);
      }
    }

    // Validate confidence is in range
    if (
      output.synthesis.confidence < 0 ||
      output.synthesis.confidence > 1
    ) {
      console.warn(
        `⚠️ Synthesizer confidence out of range: ${output.synthesis.confidence}`
      );
    }

    // Validate we don't have too many risks/recommendations (optimized prompt says max 5 each)
    const riskCount = output.synthesis.criticalRisks.length;
    const recCount = output.synthesis.recommendations.length;

    if (riskCount > 5) {
      console.warn(`⚠️ Synthesizer returned ${riskCount} risks, max should be 5`);
    }

    if (recCount > 5) {
      console.warn(`⚠️ Synthesizer returned ${recCount} recommendations, max should be 5`);
    }
  }

  /**
   * Get high-priority action items for client
   */
  getActionItems(output: SynthesizerOutput) {
    return output.synthesis.recommendations
      .filter((rec) => rec.priority === 'high')
      .map((rec) => rec.action);
  }
}

/**
 * Quick way to synthesize council outputs
 */
export async function synthesizeAnalysis(
  expertOutput: ExpertOutput,
  provocateurOutput: ProvocateurOutput,
  validatorOutput: ValidatorOutput
): Promise<SynthesizerOutput> {
  const synthesizer = new SynthesizerAgent();
  return synthesizer.synthesize(expertOutput, provocateurOutput, validatorOutput);
}
