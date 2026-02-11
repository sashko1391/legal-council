/**
 * Drafter Agent (Document Generation)
 * Generates ДСТУ-compliant Ukrainian contracts
 */

import { BaseAgent } from '../base-agent';
import { buildDrafterPrompt } from '../../config/generation-prompts';
import { createGenerationAgentConfigs } from '../../config/models';
import type { DrafterOutput, AnalyzerOutput, DocumentType } from '../../types/generation-types';

export class DrafterAgent extends BaseAgent<DrafterOutput> {
  constructor() {
    const configs = createGenerationAgentConfigs();
    const drafterConfig = configs.find((c) => c.role === 'drafter')!;

    super(drafterConfig, '');
  }

  /**
   * Draft complete contract based on structured requirements
   */
  async draft(
    documentType: DocumentType,
    analyzerOutput: AnalyzerOutput
  ): Promise<DrafterOutput> {
    this.systemPrompt = await buildDrafterPrompt(documentType);

    const userPrompt = this.buildUserPrompt(analyzerOutput);
    const output = await this.call(userPrompt);

    this.validateOutput(output);
    return output;
  }

  private buildUserPrompt(analyzerOutput: AnalyzerOutput): string {
    const req = analyzerOutput.analysis.structuredRequirements;

    let prompt = '# STRUCTURED REQUIREMENTS\n\n';
    prompt += '```json\n';
    prompt += JSON.stringify(req, null, 2);
    prompt += '\n```\n\n';

    prompt += '# SUGGESTED CLAUSES\n\n';
    analyzerOutput.analysis.suggestedClauses.forEach((clause) => {
      prompt += `- ${clause.type} (${clause.priority}): ${clause.rationale}\n`;
    });

    prompt += '\n# YOUR TASK\n\n';
    prompt += 'Generate complete ДСТУ-compliant contract in Ukrainian language.\n';
    prompt += 'Follow the EXACT structure from your system prompt.\n';
    prompt += 'Include all mandatory sections per Ukrainian law.\n';
    prompt += 'Output strict JSON with "documentText" field containing full Markdown contract.\n';

    return prompt;
  }

  private validateOutput(output: any): void {
    if (!output.draft || !output.draft.documentText) {
      throw new Error('Drafter output missing documentText');
    }

    const text = output.draft.documentText;

    // Basic ДСТУ validation
    if (!text.includes('ДОГОВІР')) {
      console.warn('⚠️ Contract missing "ДОГОВІР" title');
    }

    if (!text.includes('ПРЕДМЕТ ДОГОВОРУ')) {
      console.warn('⚠️ Contract missing mandatory section: ПРЕДМЕТ ДОГОВОРУ');
    }

    if (!text.includes('ПІДПИСИ СТОРІН')) {
      console.warn('⚠️ Contract missing signature section');
    }
  }
}

export async function draftDocument(
  documentType: DocumentType,
  analyzerOutput: AnalyzerOutput
): Promise<DrafterOutput> {
  const drafter = new DrafterAgent();
  return drafter.draft(documentType, analyzerOutput);
}
