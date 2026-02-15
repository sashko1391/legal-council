/**
 * Generation Orchestrator — v3 with SSE Progress Callbacks
 * Coordinates Analyzer → [Gate] → Drafter → Validator → Polisher
 * 
 * v2 → v3 changes:
 *   - Added optional `onProgress` callback to `generate()` method
 *   - Emits events: agent_start, agent_complete, agent_error, gate_check
 *   - Backward compatible: without callback works exactly as before
 * 
 * Previous fixes preserved:
 *   FIX #16: Logger
 *   FIX #21: Graceful degradation
 *   Pre-Generation Gate with clarification flow
 *   ПРД (Принцип Розумної Достатності)
 *   Blank handling (_______)
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
import type { ProgressCallback } from '../utils/sse-helpers';

// ==========================================
// TYPES
// ==========================================

export interface GenerationOrchestratorConfig {
  maxRevisions: number;
  enableAuditTrail: boolean;
}

export interface ClarificationResponse {
  status: 'needs_clarification';
  questions: string[];
  partialAnalysis: any;
  message: string;
}

export type GenerationResult = DocumentGenerationResponse | ClarificationResponse;

function isClarification(result: GenerationResult): result is ClarificationResponse {
  return (result as ClarificationResponse).status === 'needs_clarification';
}

const DEFAULT_CONFIG: GenerationOrchestratorConfig = {
  maxRevisions: 2,
  enableAuditTrail: true,
};

// ==========================================
// ORCHESTRATOR
// ==========================================

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
   * Main generation method with Pre-Generation Gate, graceful degradation, and SSE progress.
   * 
   * @param request - Document generation request
   * @param onProgress - Optional SSE progress callback for real-time updates
   */
  async generate(
    request: DocumentGenerationRequest,
    onProgress?: ProgressCallback
  ): Promise<GenerationResult> {
    const startTime = Date.now();
    let totalCost = 0;
    const failedAgents: string[] = [];

    // Helper to safely emit progress
    const emit = (event: Parameters<ProgressCallback>[0]) => {
      if (onProgress) {
        try { onProgress(event); } catch { /* ignore */ }
      }
    };

    logger.info('📝 Legal Council Generation Session Starting...');
    logger.info(`   Document type: ${request.documentType}`);

    // ═══════════════════════════════════════
    // Step 1: Analyze requirements (REQUIRED)
    // ═══════════════════════════════════════
    emit({ type: 'agent_start', agent: 'analyzer', message: 'Аналізую вимоги до документа...' });
    const analyzerStart = Date.now();

    logger.info('\n🔍 Step 1: Analyzer');
    
    // If second pass with clarification answers, enrich requirements
    let enrichedRequest = request;
    if (request.clarificationAnswers && Object.keys(request.clarificationAnswers).length > 0) {
      logger.info('   📋 Clarification answers provided — enriching requirements');
      const answersText = Object.entries(request.clarificationAnswers)
        .map(([question, answer]) => `${question}: ${answer}`)
        .join('\n');
      enrichedRequest = {
        ...request,
        requirements: `${request.requirements}\n\nДодаткова інформація:\n${answersText}`,
      };
    }

    const analyzerOutput = await this.analyzer.analyze(enrichedRequest);
    totalCost += this.analyzer.calculateCost(analyzerOutput.tokensUsed);
    logger.info(`   ✔ Must-have clauses: ${analyzerOutput.analysis.structuredRequirements.mustHaveClauses.length}`);

    emit({
      type: 'agent_complete',
      agent: 'analyzer',
      message: `Визначено ${analyzerOutput.analysis.structuredRequirements.mustHaveClauses.length} обов'язкових розділів`,
      durationMs: Date.now() - analyzerStart,
    });

    // ═══════════════════════════════════════
    // 🚨 PRE-GENERATION GATE
    // ═══════════════════════════════════════
    const analysis = analyzerOutput.analysis;
    const hasClarifications = analysis.clarificationsNeeded && analysis.clarificationsNeeded.length > 0;
    const notReady = analysis.readyToGenerate === false;
    const lowConfidence = (analysis.confidence || 0) < 0.5;

    if (notReady || (hasClarifications && lowConfidence)) {
      const questions = analysis.clarificationsNeeded || [];
      logger.info(`\n🚨 PRE-GENERATION GATE: Insufficient information`);
      logger.info(`   readyToGenerate: ${analysis.readyToGenerate}`);
      logger.info(`   confidence: ${analysis.confidence}`);
      logger.info(`   questions: ${questions.length}`);

      emit({
        type: 'gate_check',
        message: `Потрібна додаткова інформація: ${questions.length} питань`,
        data: { questions },
      });

      return {
        status: 'needs_clarification',
        questions,
        partialAnalysis: analysis.structuredRequirements,
        message: 'Для створення якісного документа потрібна додаткова інформація:',
      };
    }

    logger.info(`   ✔ Pre-Generation Gate: PASSED (confidence: ${analysis.confidence})`);

    // ═══════════════════════════════════════
    // Step 2: Draft document (REQUIRED)
    // ═══════════════════════════════════════
    emit({ type: 'agent_start', agent: 'drafter', message: 'Створюю проект документа...' });
    const drafterStart = Date.now();

    logger.info('\n📄 Step 2: Drafter');
    const drafterOutput = await this.drafter.draft(request.documentType, analyzerOutput);
    totalCost += this.drafter.calculateCost(drafterOutput.tokensUsed);
    logger.info(`   ✔ Document: ${drafterOutput.draft.documentText.length} chars, ${drafterOutput.draft.includedClauses.length} clauses`);

    emit({
      type: 'agent_complete',
      agent: 'drafter',
      message: `Проект створено: ${drafterOutput.draft.includedClauses.length} розділів`,
      durationMs: Date.now() - drafterStart,
    });

    // ═══════════════════════════════════════
    // Step 3: Validate (OPTIONAL)
    // ═══════════════════════════════════════
    let validatorOutput: GenerationValidatorOutput;
    try {
      emit({ type: 'agent_start', agent: 'gen-validator', message: 'Перевіряю відповідність законодавству...' });
      const valStart = Date.now();

      logger.info('\n✅ Step 3: Validator');
      validatorOutput = await this.validator.validate(analyzerOutput, drafterOutput);
      totalCost += this.validator.calculateCost(validatorOutput.tokensUsed);
      logger.info(`   ✔ Score: ${validatorOutput.validation.overallScore}%, verdict: ${validatorOutput.validation.verdict}`);

      emit({
        type: 'agent_complete',
        agent: 'gen-validator',
        message: `Оцінка: ${validatorOutput.validation.overallScore}%`,
        durationMs: Date.now() - valStart,
      });
    } catch (error) {
      logger.warn(`   ⚠️ Validator failed: ${(error as Error).message}`);
      failedAgents.push('gen-validator');
      validatorOutput = this.createFallbackValidatorOutput();

      emit({
        type: 'agent_error',
        agent: 'gen-validator',
        message: 'Валідація пропущена, продовжую',
      });
    }

    // Check if needs revision
    if (
      validatorOutput.validation.verdict === 'NEEDS_REVISION' &&
      validatorOutput.validation.riskFlags.some((f) => f.severity >= 4)
    ) {
      logger.warn('⚠️ Critical issues found — would need revision in production');
    }

    // ═══════════════════════════════════════
    // Step 4: Polish (OPTIONAL)
    // ═══════════════════════════════════════
    let polisherOutput: PolisherOutput;
    try {
      emit({ type: 'agent_start', agent: 'polisher', message: 'Фінальне полірування та ДСТУ...' });
      const polStart = Date.now();

      logger.info('\n✨ Step 4: Polisher');
      polisherOutput = await this.polisher.polish(drafterOutput, validatorOutput);
      totalCost += this.polisher.calculateCost(polisherOutput.tokensUsed);
      logger.info(`   ✔ Improvements: ${polisherOutput.polished.improvements.length}`);

      emit({
        type: 'agent_complete',
        agent: 'polisher',
        message: `${polisherOutput.polished.improvements.length} покращень внесено`,
        durationMs: Date.now() - polStart,
      });
    } catch (error) {
      logger.warn(`   ⚠️ Polisher failed: ${(error as Error).message}`);
      failedAgents.push('polisher');
      polisherOutput = this.createFallbackPolisherOutput(drafterOutput);

      emit({
        type: 'agent_error',
        agent: 'polisher',
        message: 'Використовую чернетку без полірування',
      });
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

    // Append degraded warning if needed
    if (failedAgents.length > 0) {
      finalResponse.finalDocument += `\n\n⚠️ УВАГА: Документ створено в неповному режимі. Недоступні агенти: ${failedAgents.join(', ')}. Рекомендуємо ретельну перевірку.`;
      logger.warn(`   ⚠️ Degraded: agents ${failedAgents.join(', ')} failed`);
    }

    logger.info(`\n🎉 Generation Complete! Cost: $${totalCost.toFixed(4)}, time: ${(processingTimeMs / 1000).toFixed(1)}s, quality: ${finalResponse.qualityMetrics.overall}%`);

    return finalResponse;
  }

  // ==========================================
  // Fallback outputs
  // ==========================================

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
        overallScore: 50,
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
    clarificationAnswers?: Record<string, string>;
    config?: Partial<GenerationOrchestratorConfig>;
    onProgress?: ProgressCallback;
  }
): Promise<GenerationResult> {
  const orchestrator = new GenerationOrchestrator(options?.config);
  const request: DocumentGenerationRequest = {
    documentType,
    requirements,
    jurisdiction: options?.jurisdiction || 'Ukraine',
    parties: options?.parties,
    clarificationAnswers: options?.clarificationAnswers,
  };
  return orchestrator.generate(request, options?.onProgress);
}
