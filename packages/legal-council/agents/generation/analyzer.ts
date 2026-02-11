/**
 * Analyzer Agent (Document Generation)
 * Parses user requirements into structured specifications
 */

import { BaseAgent } from '../base-agent';
import { buildAnalyzerPrompt } from '../../config/generation-prompts';
import { createGenerationAgentConfigs } from '../../config/models';
import type {
  AnalyzerOutput,
  DocumentGenerationRequest,
} from '../../types/generation-types';

export class AnalyzerAgent extends BaseAgent<AnalyzerOutput> {
  constructor() {
    const configs = createGenerationAgentConfigs();
    const analyzerConfig = configs.find((c) => c.role === 'analyzer')!;

    super(analyzerConfig, '');
  }

  /**
   * Analyze user requirements and structure them
   */
  async analyze(request: DocumentGenerationRequest): Promise<AnalyzerOutput> {
    this.systemPrompt = await buildAnalyzerPrompt(request.documentType);

    const userPrompt = this.buildUserPrompt(request);
    const output = await this.call(userPrompt);

    this.validateOutput(output);
    return output;
  }

  private buildUserPrompt(request: DocumentGenerationRequest): string {
    let prompt = '# USER REQUIREMENTS\n\n';
    prompt += request.requirements;
    prompt += '\n\n# DOCUMENT TYPE\n\n';
    prompt += `${request.documentType}\n\n`;

    if (request.jurisdiction) {
      prompt += `# JURISDICTION\n\n${request.jurisdiction}\n\n`;
    }

    if (request.parties && request.parties.length > 0) {
      prompt += '# PARTIES\n\n';
      request.parties.forEach((p) => {
        prompt += `- ${p.role}: ${p.name || '[to be filled]'}\n`;
      });
      prompt += '\n';
    }

    if (request.specificClauses && request.specificClauses.length > 0) {
      prompt += '# SPECIFIC CLAUSES REQUESTED\n\n';
      request.specificClauses.forEach((c) => {
        prompt += `- ${c.type} (${c.priority}): ${c.requirements}\n`;
      });
      prompt += '\n';
    }

    prompt += '# YOUR TASK\n\n';
    prompt += 'Parse these requirements into structured JSON format.\n';
    prompt += 'Make smart assumptions where info is missing.\n';
    prompt += 'Suggest additional clauses that are essential for this document type.\n';

    return prompt;
  }

  private validateOutput(output: any): void {
    if (!output.analysis || !output.analysis.structuredRequirements) {
      throw new Error('Analyzer output missing structuredRequirements');
    }

    const req = output.analysis.structuredRequirements;
    if (!req.documentType || !req.parties || !req.mustHaveClauses) {
      console.warn('⚠️ Analyzer output missing key fields');
    }
  }
}

export async function analyzeRequirements(
  request: DocumentGenerationRequest
): Promise<AnalyzerOutput> {
  const analyzer = new AnalyzerAgent();
  return analyzer.analyze(request);
}
