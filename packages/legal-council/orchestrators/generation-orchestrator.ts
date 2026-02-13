/**
 * Generation Orchestrator
 * Coordinates Analyzer → Drafter → Validator → Polisher
 * 
 * FIX #16: Logger instead of console.log
 * FIX #21 (Feb 13, 2026): Graceful degradation for non-critical agents
 */

import { AnalyzerAgent } from '../agents/generation/analyzer';
import { DrafterAgent } from '../agents/generation/drafter';
import { GenerationValidatorAgent } from '../agents/generation/validator';
import { PolisherAgent } from '../agents/generation/polisher';
import type {
  DocumentGenerationRequest,
  DocumentGenerationResponse,
  GenerationValidatorOutput,
  PolisherOutput,
} from '../types/generation-types';
import { logger } from '../utils/logger';

export interface GenerationOrchestratorConfig {
  maxRevisions: number;
  enableAuditTrail: boolean;
}

const DEFAULT_CONFIG: GenerationOrchestratorConfig = {
  maxRevisions: 2,
  enableAuditTrail: true,
};

export class GenerationOrchestrator {
  private config: GenerationOrchestratorConfig;
  private analyzer: AnalyzerAgent;
  private drafter: DrafterAgent;
  private validator: GenerationValidatorAgent;
  private polisher: PolisherAgent;

  constructor(config: Partial<GenerationOrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.analyzer = new AnalyzerAgent();
    this.drafter = new DrafterAgent();
    this.validator = new GenerationValidatorAgent();
    this.polisher = new PolisherAgent();
  }

  /**
   * Main generation method with graceful degradation
   */
  async generate(request: DocumentGenerationRequest): Promise<DocumentGenerationResponse> {
    const startTime = Date.now();
    let totalCost = 0;
    const failedAgents: string[] = [];

    logger.info('📝 Legal Council Generation Session Starting...');
    logger.info(`   Document type: ${request.documentType}`);

    // Step 1: Analyze requirements (REQUIRED)
    logger.info('\n🔍 Step 1: Analyzer');
    const analyzerOutput = await this.analyzer.analyze(request);
    totalCost += this.analyzer.calculateCost(analyzerOutput.tokensUsed);
    logger.info(`   ✓ Must-have clauses: ${analyzerOutput.analysis.structuredRequirements.mustHaveClauses.length}`);

    // Step 2: Draft document (REQUIRED)
    logger.info('\n📄 Step 2: Drafter');
    const drafterOutput = await this.drafter.draft(request.documentType, analyzerOutput);
    totalCost += this.drafter.calculateCost(drafterOutput.tokensUsed);
    logger.info(`   ✓ Document: ${drafterOutput.draft.documentText.length} chars, ${drafterOutput.draft.includedClauses.length} clauses`);

    // Step 3: Validate (FIX #21: OPTIONAL — degraded mode if fails)
    let validatorOutput: GenerationValidatorOutput;
    try {
      logger.info('\n✅ Step 3: Validator');
      validatorOutput = await this.validator.validate(analyzerOutput, drafterOutput);
      totalCost += this.validator.calculateCost(validatorOutput.tokensUsed);
      logger.info(`   ✓ Score: ${validatorOutput.validation.overallScore}%, verdict: ${validatorOutput.validation.verdict}`);
    } catch (error) {
      logger.warn(`   ⚠️ Validator failed, continuing: ${(error as Error).message}`);
      failedAgents.push('gen-validator');
      validatorOutput = this.createFallbackValidatorOutput();
    }

    // Check if needs revision
    if (
      validatorOutput.validation.verdict === 'NEEDS_REVISION' &&
      validatorOutput.validation.riskFlags.some((f) => f.severity >= 4)
    ) {
      logger.warn('⚠️ Critical issues found — would need revision in production');
      // Future: Loop back to drafter
    }

    // Step 4: Polish (FIX #21: OPTIONAL — return unpolished draft if fails)
    let polisherOutput: PolisherOutput;
    try {
      logger.info('\n✨ Step 4: Polisher');
      polisherOutput = await this.polisher.polish(drafterOutput, validatorOutput);
      totalCost += this.polisher.calculateCost(polisherOutput.tokensUsed);
      logger.info(`   ✓ Improvements: ${polisherOutput.polished.improvements.length}`);
    } catch (error) {
      logger.warn(`   ⚠️ Polisher failed, using raw draft: ${(error as Error).message}`);
      failedAgents.push('polisher');
      polisherOutput = this.createFallbackPolisherOutput(drafterOutput);
    }

    // Build final response
    const processingTimeMs = Date.now() - startTime;
    const finalResponse = this.polisher.buildFinalResponse(
      polisherOutput,
      analyzerOutput,
      drafterOutput,
      validatorOutput,
      { documentType: request.documentType, totalCost, processingTimeMs }
    );

    // FIX #21: Append degraded warning if needed
    if (failedAgents.length > 0) {
      finalResponse.finalDocument += `\n\n⚠️ УВАГА: Документ створено в неповному режимі. Недоступні агенти: ${failedAgents.join(', ')}. Рекомендуємо ретельну перевірку.`;
      logger.warn(`   ⚠️ Degraded: agents ${failedAgents.join(', ')} failed`);
    }

    logger.info(`\n🎉 Generation Complete! Cost: $${totalCost.toFixed(4)}, time: ${(processingTimeMs / 1000).toFixed(1)}s, quality: ${finalResponse.qualityMetrics.overall}%`);

    return finalResponse;
  }

  // FIX #21: Fallback outputs

  private createFallbackValidatorOutput(): GenerationValidatorOutput {
    return {
      agentId: 'gen-validator',
      role: 'gen-validator',
      confidence: 0,
      timestamp: new Date().toISOString(),
      tokensUsed: { input: 0, output: 0 },
      latencyMs: 0,
      validation: {
        legalCompliance: [],
        missingElements: ['Валідація не виконана — агент недоступний'],
        riskFlags: [],
        overallScore: 50, // Neutral score
        verdict: 'NEEDS_REVISION',
      },
    } as GenerationValidatorOutput;
  }

  private createFallbackPolisherOutput(drafterOutput: any): PolisherOutput {
    return {
      agentId: 'polisher',
      role: 'polisher',
      confidence: 0.5,
      timestamp: new Date().toISOString(),
      tokensUsed: { input: 0, output: 0 },
      latencyMs: 0,
      polished: {
        finalDocument: drafterOutput.draft.documentText,
        improvements: [],
        executiveSummary: '⚠️ Документ не пройшов фінальне полірування — використовується чернетка.',
        keyTerms: [],
      },
    } as PolisherOutput;
  }

  getConfig(): GenerationOrchestratorConfig {
    return { ...this.config };
  }

  setConfig(config: Partial<GenerationOrchestratorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ==========================================
// CONVENIENCE FUNCTION
// ==========================================

export async function generateDocument(
  requirements: string,
  documentType: DocumentGenerationRequest['documentType'],
  options?: {
    jurisdiction?: string;
    parties?: DocumentGenerationRequest['parties'];
    config?: Partial<GenerationOrchestratorConfig>;
  }
): Promise<DocumentGenerationResponse> {
  const orchestrator = new GenerationOrchestrator(options?.config);
  const request: DocumentGenerationRequest = {
    documentType,
    requirements,
    jurisdiction: options?.jurisdiction || 'Ukraine',
    parties: options?.parties,
  };
  return orchestrator.generate(request);
}
