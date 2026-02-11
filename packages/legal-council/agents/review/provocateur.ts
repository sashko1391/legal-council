/**
 * Provocateur Agent (Contract Review)
 * Adversarial red-team critic - finds exploitable flaws
 * 
 * FIX (Feb 10, 2026): Transform flat LLM output to nested structure
 */

import { BaseAgent } from '../base-agent';
import { buildProvocateurPrompt } from '../../config/review-prompts';
import { createReviewAgentConfigs } from '../../config/models';
import type { ProvocateurOutput } from '../../types/review-types';
import type { ExpertOutput } from '../../types/review-types';

export class ProvocateurAgent extends BaseAgent<ProvocateurOutput> {
  constructor() {
    const configs = createReviewAgentConfigs();
    const provocateurConfig = configs.find((c) => c.role === 'provocateur')!;

    super(provocateurConfig, '');
  }

  /**
   * Critique contract and find exploitable flaws
   */
  async critique(
    contractText: string,
    expertAnalysis?: ExpertOutput
  ): Promise<ProvocateurOutput> {
    this.systemPrompt = await buildProvocateurPrompt();

    const userPrompt = this.buildUserPrompt(contractText, expertAnalysis);

    const rawOutput = await this.call(userPrompt);

    // Transform flat to nested structure
    const output = this.transformOutput(rawOutput);

    this.validateOutput(output);

    return output;
  }

  /**
   * Build adversarial user prompt
   */
  private buildUserPrompt(
    contractText: string,
    expertAnalysis?: ExpertOutput
  ): string {
    let prompt = '# CONTRACT TO ATTACK\n\n';
    prompt += '```\n';
    prompt += contractText;
    prompt += '\n```\n\n';

    if (expertAnalysis) {
      prompt += '# EXPERT ALREADY FOUND THESE ISSUES\n\n';
      prompt += `Expert identified ${expertAnalysis.analysis.keyIssues.length} issues:\n`;

      expertAnalysis.analysis.keyIssues.forEach((issue) => {
        prompt += `- ${issue.title} (severity ${issue.severity})\n`;
      });

      prompt += '\n**YOUR JOB: Find DIFFERENT flaws that Expert missed!**\n';
      prompt += 'Don\'t repeat what Expert found. Find NEW attack vectors.\n\n';
    }

    prompt += '# YOUR MISSION\n\n';
    prompt += 'You are opposing counsel. Find at least 3 critical flaws you can exploit.\n';
    prompt += 'Be ruthless. Be creative. This is war.\n';
    prompt += '\nOutput strict JSON format as specified in system prompt.\n';

    return prompt;
  }

  /**
   * Transform flat LLM output to nested structure
   */
  private transformOutput(rawOutput: any): ProvocateurOutput {
    return {
      ...rawOutput,
      critique: {
        flaws: rawOutput.flaws,
        maxSeverity: rawOutput.maxSeverity,
        exploitationScenarios: rawOutput.exploitationScenarios,
      },
    } as ProvocateurOutput;
  }

  /**
   * Validate output structure
   */
  private validateOutput(output: ProvocateurOutput): void {
    if (!output.critique || !output.critique.flaws) {
      throw new Error('Provocateur output missing critique.flaws');
    }

    const flawCount = output.critique.flaws.length;

    if (flawCount < 3) {
      console.warn(
        `⚠️ Provocateur only found ${flawCount} flaws (expected ≥3). Prompt may need adjustment.`
      );
    }

    // Validate max severity
    if (
      output.critique.maxSeverity < 1 ||
      output.critique.maxSeverity > 5
    ) {
      console.warn(
        `⚠️ Provocateur maxSeverity out of range: ${output.critique.maxSeverity}`
      );
    }

    // Validate we don't have too many flaws (optimized prompt says max 7)
    if (flawCount > 7) {
      console.warn(`⚠️ Provocateur returned ${flawCount} flaws, max should be 7`);
    }
  }
}

/**
 * Quick way to get provocateur critique
 */
export async function getProvocateurCritique(
  contractText: string,
  expertAnalysis?: ExpertOutput
): Promise<ProvocateurOutput> {
  const provocateur = new ProvocateurAgent();
  return provocateur.critique(contractText, expertAnalysis);
}
