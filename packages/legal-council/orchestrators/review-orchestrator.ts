/**
 * Review Orchestrator — v3 with SSE Progress Callbacks
 * Coordinates Expert → Provocateur → Validator → Synthesizer
 * 
 * v2 → v3 changes:
 *   - Added optional `onProgress` callback to `analyze()` method
 *   - Emits events: agent_start, agent_complete, agent_error, rag_start, rag_complete
 *   - Backward compatible: without callback works exactly as before
 * 
 * Previous fixes preserved:
 *   FIX #11: Proper ContractType (no `as any`)
 *   FIX #16: Logger
 *   FIX #21: Graceful degradation
 *   FIX L1: checkStopCriteria called in analyze loop
 *   REFACTOR: RAG at orchestrator level, shared by all agents
 */

import { ExpertAgent } from '../agents/review/expert';
import { ProvocateurAgent } from '../agents/review/provocateur';
import { ValidatorAgent } from '../agents/review/validator';
import { SynthesizerAgent } from '../agents/review/synthesizer';
import { getLawContext } from '../services/law-rag-service';
import type {
  ContractReviewRequest,
  ContractReviewResponse,
  ContractType,
  ExpertOutput,
  ProvocateurOutput,
  ValidatorOutput,
  SynthesizerOutput,
} from '../types/review-types';
import type { Round, AuditTrail } from '../../core/orchestrator/types';
import { logger } from '../utils/logger';
import type { ProgressCallback } from '../utils/sse-helpers';

export interface ReviewOrchestratorConfig {
  maxRounds: number;
  maxSeverityThreshold: number;
  minConfidence: number;
  enableAuditTrail: boolean;
}

const DEFAULT_CONFIG: ReviewOrchestratorConfig = {
  maxRounds: 3,
  maxSeverityThreshold: 3,
  minConfidence: 0.85,
  enableAuditTrail: true,
};

// ==========================================
// Contract type mapping
// ==========================================

const CONTRACT_TYPE_MAP: Record<string, string> = {
  // English
  'vendor': 'sale',
  'sale': 'sale',
  'lease': 'lease',
  'rental': 'lease',
  'service': 'service',
  'employment': 'employment',
  'work': 'work',
  'loan': 'loan',
  'nda': 'general',
  // Ukrainian
  'оренда': 'lease',
  'постачка': 'sale',
  'послуги': 'service',
  'трудовий': 'employment',
  'підряд': 'work',
  'купівлі-продаж': 'sale',
  'інше': 'general',
};

export class ReviewOrchestrator {
  private config: ReviewOrchestratorConfig;
  private expert: ExpertAgent;
  private provocateur: ProvocateurAgent;
  private validator: ValidatorAgent;
  private synthesizer: SynthesizerAgent;

  constructor(config: Partial<ReviewOrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.expert = new ExpertAgent();
    this.provocateur = new ProvocateurAgent();
    this.validator = new ValidatorAgent();
    this.synthesizer = new SynthesizerAgent();
  }

  /**
   * Main orchestration method with graceful degradation and SSE progress.
   * 
   * @param request - Contract review request
   * @param onProgress - Optional SSE progress callback for real-time updates
   */
  async analyze(
    request: ContractReviewRequest,
    onProgress?: ProgressCallback
  ): Promise<ContractReviewResponse> {
    const startTime = Date.now();
    let totalCost = 0;
    const failedAgents: string[] = [];

    // Helper to safely emit progress
    const emit = (event: Parameters<ProgressCallback>[0]) => {
      if (onProgress) {
        try { onProgress(event); } catch { /* ignore */ }
      }
    };

    logger.info('🛡️ Legal Council Review Session Starting...');
    logger.info(`   Max rounds: ${this.config.maxRounds}`);

    // ========================
    // RAG: Search legislation ONCE
    // ========================
    emit({ type: 'rag_start', message: 'Пошук у базі 207 законів...' });

    const lawContext = await this.fetchLawContext(
      request.contractText,
      request.contractType
    );

    emit({ type: 'rag_complete', message: 'Знайдено релевантні статті законодавства' });

    let expertOutput!: ExpertOutput;
    let provocateurOutput!: ProvocateurOutput;
    let validatorOutput!: ValidatorOutput;

    // ========================
    // Multi-round loop
    // ========================
    for (let round = 1; round <= this.config.maxRounds; round++) {
      logger.info(`\n━━━ Round ${round}/${this.config.maxRounds} ━━━`);

      // ========================
      // Step 1: Expert Analysis (REQUIRED)
      // ========================
      emit({ type: 'agent_start', agent: 'expert', message: 'Аналізую відповідність законодавству...' });
      const expertStart = Date.now();

      logger.info('\n📋 Expert Analysis');
      expertOutput = await this.expert.analyze(request, lawContext);
      totalCost += this.expert.calculateCost(expertOutput.tokensUsed);
      logger.info(`   ✔ Found ${expertOutput.analysis.keyIssues.length} issues, risk ${expertOutput.analysis.overallRiskScore}/10`);

      emit({
        type: 'agent_complete',
        agent: 'expert',
        message: `${expertOutput.analysis.keyIssues.length} проблем знайдено, ризик ${expertOutput.analysis.overallRiskScore}/10`,
        durationMs: Date.now() - expertStart,
      });

      // ========================
      // Step 2: Provocateur Critique (OPTIONAL)
      // ========================
      try {
        emit({ type: 'agent_start', agent: 'provocateur', message: 'Перевіряю приховані ризики...' });
        const provStart = Date.now();

        logger.info('\n😈 Provocateur Critique');
        provocateurOutput = await this.provocateur.critique(request.contractText, expertOutput, lawContext);
        totalCost += this.provocateur.calculateCost(provocateurOutput.tokensUsed);
        logger.info(`   ✔ Found ${provocateurOutput.critique.flaws.length} flaws`);

        emit({
          type: 'agent_complete',
          agent: 'provocateur',
          message: `${provocateurOutput.critique.flaws.length} слабких місць виявлено`,
          durationMs: Date.now() - provStart,
        });
      } catch (error) {
        logger.warn(`   ⚠️ Provocateur failed: ${(error as Error).message}`);
        failedAgents.push('provocateur');
        provocateurOutput = this.createFallbackProvocateurOutput();

        emit({
          type: 'agent_error',
          agent: 'provocateur',
          message: 'Агент недоступний, продовжую в degraded режимі',
        });
      }

      // ========================
      // Step 3: Validator (OPTIONAL)
      // ========================
      try {
        emit({ type: 'agent_start', agent: 'validator', message: 'Перевіряю висновки...' });
        const valStart = Date.now();

        logger.info('\n🔍 Validator Check');
        validatorOutput = await this.validator.validate(request, expertOutput, provocateurOutput, lawContext);
        totalCost += this.validator.calculateCost(validatorOutput.tokensUsed);
        logger.info(`   ✔ Completeness: ${validatorOutput.validation.completenessScore}%, verdict: ${validatorOutput.validation.verdict}`);

        emit({
          type: 'agent_complete',
          agent: 'validator',
          message: `Повнота: ${validatorOutput.validation.completenessScore}%`,
          durationMs: Date.now() - valStart,
        });
      } catch (error) {
        logger.warn(`   ⚠️ Validator failed: ${(error as Error).message}`);
        failedAgents.push('validator');
        validatorOutput = this.createFallbackValidatorOutput();

        emit({
          type: 'agent_error',
          agent: 'validator',
          message: 'Агент недоступний, продовжую',
        });
      }

      // ========================
      // Check stop criteria
      // ========================
      const stopCheck = this.checkStopCriteria(expertOutput, provocateurOutput, validatorOutput, round);
      logger.info(`   Stop check: ${stopCheck.reason}`);

      if (stopCheck.shouldStop) {
        if (round < this.config.maxRounds) {
          logger.info(`   → Stopping early at round ${round}: ${stopCheck.reason}`);
        }
        break;
      }

      if (validatorOutput.validation.missingAspects?.length > 0) {
        logger.info(`   → Round ${round + 1} will focus on: ${validatorOutput.validation.missingAspects.join(', ')}`);
        request = {
          ...request,
          focusAreas: [
            ...(request.focusAreas || []),
            ...validatorOutput.validation.missingAspects,
          ] as any,
        };
      }
    }

    // ========================
    // Final: Synthesizer (OPTIONAL)
    // ========================
    let synthesizerOutput: SynthesizerOutput;
    try {
      emit({ type: 'agent_start', agent: 'synthesizer', message: 'Формую фінальний звіт...' });
      const synStart = Date.now();

      logger.info('\n📝 Final: Synthesizer');
      synthesizerOutput = await this.synthesizer.synthesize(expertOutput, provocateurOutput, validatorOutput, lawContext);
      totalCost += this.synthesizer.calculateCost(synthesizerOutput.tokensUsed);
      logger.info(`   ✔ Critical risks: ${synthesizerOutput.synthesis.criticalRisks.length}`);

      emit({
        type: 'agent_complete',
        agent: 'synthesizer',
        message: `Звіт готовий: ${synthesizerOutput.synthesis.criticalRisks.length} критичних ризиків`,
        durationMs: Date.now() - synStart,
      });
    } catch (error) {
      logger.warn(`   ⚠️ Synthesizer failed: ${(error as Error).message}`);
      failedAgents.push('synthesizer');
      synthesizerOutput = this.createFallbackSynthesizerOutput(expertOutput);

      emit({
        type: 'agent_error',
        agent: 'synthesizer',
        message: 'Використовую результати Експерта напряму',
      });
    }

    const processingTimeMs = Date.now() - startTime;
    const finalResponse = this.buildFinalResponse(
      synthesizerOutput,
      expertOutput,
      provocateurOutput,
      validatorOutput,
      {
        contractType: request.contractType,
        jurisdiction: request.jurisdiction,
        totalCost,
        processingTimeMs,
        failedAgents,
      }
    );

    logger.info(`\n✨ Legal Council Review Complete!`);
    logger.info(`   Total cost: $${totalCost.toFixed(4)}`);
    logger.info(`   Processing time: ${(processingTimeMs / 1000).toFixed(1)}s`);
    if (failedAgents.length > 0) {
      logger.warn(`   ⚠️ Degraded mode: agents ${failedAgents.join(', ')} failed`);
    }

    return finalResponse;
  }

  // ==========================================
  // RAG: Fetch law context at orchestrator level
  // ==========================================

  private async fetchLawContext(
    contractText: string,
    contractType?: string
  ): Promise<string> {
    try {
      const ragType = CONTRACT_TYPE_MAP[(contractType || '').toLowerCase()] || 'general';
      const lawContext = await getLawContext(contractText, ragType);
      logger.info(`📚 RAG: fetched law context for type="${ragType}" (input="${contractType}")`);
      return lawContext;
    } catch (error) {
      logger.warn(`⚠️ RAG unavailable: ${(error as Error).message}`);
      return '<relevant_law_articles>\nRAG система тимчасово недоступна. Використовуйте загальні знання українського законодавства.\n</relevant_law_articles>';
    }
  }

  // ==========================================
  // Stop criteria
  // ==========================================

  private checkStopCriteria(
    expertOutput: ExpertOutput,
    provocateurOutput: ProvocateurOutput,
    validatorOutput: ValidatorOutput,
    round: number
  ): { shouldStop: boolean; reason: string } {
    // Always stop at max rounds
    if (round >= this.config.maxRounds) {
      return { shouldStop: true, reason: `Max rounds reached (${this.config.maxRounds})` };
    }

    // Stop if validator says complete
    if (validatorOutput.validation.verdict === 'COMPLETE') {
      return { shouldStop: true, reason: 'Validator verdict: COMPLETE' };
    }

    // Stop if completeness is high enough
    if (validatorOutput.validation.completenessScore >= 85) {
      return { shouldStop: true, reason: `High completeness: ${validatorOutput.validation.completenessScore}%` };
    }

    // Stop if no missing aspects to investigate
    if (!validatorOutput.validation.missingAspects || validatorOutput.validation.missingAspects.length === 0) {
      return { shouldStop: true, reason: 'No missing aspects identified' };
    }

    return { shouldStop: false, reason: `Missing aspects: ${validatorOutput.validation.missingAspects.join(', ')}` };
  }

  // ==========================================
  // Fallback outputs for degraded mode
  // ==========================================

  private createFallbackProvocateurOutput(): ProvocateurOutput {
    return {
      agentId: 'provocateur',
      role: 'provocateur',
      confidence: 0,
      timestamp: new Date().toISOString(),
      tokensUsed: { input: 0, output: 0 },
      latencyMs: 0,
      critique: {
        flaws: [],
        maxSeverity: 0,
        exploitationScenarios: ['Агент Провокатор недоступний — аналіз неповний'],
      },
    };
  }

  private createFallbackValidatorOutput(): ValidatorOutput {
    return {
      agentId: 'validator',
      role: 'validator',
      confidence: 0,
      timestamp: new Date().toISOString(),
      tokensUsed: { input: 0, output: 0 },
      latencyMs: 0,
      validation: {
        isComplete: false,
        completenessScore: 50,
        missingAspects: [],
        contradictions: [],
        verdict: 'COMPLETE' as const,
        reason: 'Валідація не виконана — агент недоступний',
        overallAssessment: 'Валідація не виконана — агент недоступний',
      },
    } as ValidatorOutput;
  }

  private createFallbackSynthesizerOutput(expertOutput: ExpertOutput): SynthesizerOutput {
    return {
      agentId: 'synthesizer',
      role: 'synthesizer',
      confidence: expertOutput.confidence * 0.8,
      timestamp: new Date().toISOString(),
      tokensUsed: { input: 0, output: 0 },
      latencyMs: 0,
      synthesis: {
        summary: expertOutput.analysis.executiveSummary || 'Аналіз завершено (без синтезу)',
        criticalRisks: (expertOutput.analysis.keyIssues || [])
          .filter((i: any) => i.severity >= 4)
          .map((i: any) => ({
            title: i.title,
            description: i.description,
            impact: 'Потребує уваги',
            mitigation: i.recommendation || 'Рекомендується юридична консультація',
          })),
        recommendations: (expertOutput.analysis.recommendations || []).map((r: any) => ({
          priority: 'high' as const,
          action: typeof r === 'string' ? r : r.action || 'Перевірте умови договору',
          rationale: typeof r === 'string' ? '' : r.rationale || '',
        })),
        confidence: expertOutput.confidence * 0.8,
        keyDisagreements: ['Синтезатор недоступний — повний аналіз суперечностей не проведено'],
      },
    } as SynthesizerOutput;
  }

  // ==========================================
  // Build final response
  // ==========================================

  private buildFinalResponse(
    synthesizerOutput: SynthesizerOutput,
    expertOutput: ExpertOutput,
    provocateurOutput: ProvocateurOutput,
    validatorOutput: ValidatorOutput,
    metadata: {
      contractType?: string;
      jurisdiction?: string;
      totalCost: number;
      processingTimeMs: number;
      failedAgents: string[];
    }
  ): ContractReviewResponse {
    const response: any = {
      summary: synthesizerOutput.synthesis.summary,
      overallRiskScore: expertOutput.analysis.overallRiskScore,
      confidence: synthesizerOutput.confidence,
      criticalRisks: synthesizerOutput.synthesis.criticalRisks,
      recommendations: synthesizerOutput.synthesis.recommendations,
      detailedAnalysis: {
        expertAnalysis: expertOutput.analysis,
        flawsFound: provocateurOutput.critique.flaws,
        validationResults: validatorOutput.validation,
      },
      metadata: {
        contractType: metadata.contractType || 'auto',
        jurisdiction: metadata.jurisdiction || 'Ukraine',
        analyzedAt: new Date().toISOString(),
        totalCost: metadata.totalCost,
        processingTimeMs: metadata.processingTimeMs,
      },
    };

    // Add failedAgents as extra metadata (not in strict type but useful for frontend)
    if (metadata.failedAgents.length > 0) {
      response.metadata.failedAgents = metadata.failedAgents;
    }

    return response as ContractReviewResponse;
  }
}
