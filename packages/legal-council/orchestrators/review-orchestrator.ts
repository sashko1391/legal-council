/**
 * Review Orchestrator
 * Coordinates Expert → Provocateur → Validator → Synthesizer
 * 
 * FIX #11: Proper ContractType (no `as any`)
 * FIX #16: Logger
 * FIX #21 (Feb 13, 2026): Graceful degradation — if an agent fails,
 *   pipeline continues with remaining agents and flags incomplete analysis.
 */

import { ExpertAgent } from '../agents/review/expert';
import { ProvocateurAgent } from '../agents/review/provocateur';
import { ValidatorAgent } from '../agents/review/validator';
import { SynthesizerAgent } from '../agents/review/synthesizer';
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
   * Main orchestration method with graceful degradation
   */
  async analyze(request: ContractReviewRequest): Promise<ContractReviewResponse> {
    const startTime = Date.now();
    let totalCost = 0;
    const failedAgents: string[] = [];

    logger.info('🛡️ Legal Council Review Session Starting...');
    logger.info(`   Max rounds: ${this.config.maxRounds}`);

    // ========================
    // Round 1: Expert Analysis (REQUIRED — fails entire pipeline if down)
    // ========================
    logger.info('\n📋 Round 1: Expert Analysis');
    const expertOutput = await this.expert.analyze(request);
    totalCost += this.expert.calculateCost(expertOutput.tokensUsed);
    logger.info(`   ✓ Found ${expertOutput.analysis.keyIssues.length} issues, risk ${expertOutput.analysis.overallRiskScore}/10`);

    // ========================
    // Round 2: Provocateur Critique (FIX #21: OPTIONAL — degraded mode if fails)
    // ========================
    let provocateurOutput: ProvocateurOutput | null = null;
    try {
      logger.info('\n😈 Round 2: Provocateur Critique');
      provocateurOutput = await this.provocateur.critique(request.contractText, expertOutput);
      totalCost += this.provocateur.calculateCost(provocateurOutput.tokensUsed);
      logger.info(`   ✓ Found ${provocateurOutput.critique.flaws.length} flaws`);
    } catch (error) {
      logger.warn(`   ⚠️ Provocateur failed, continuing in degraded mode: ${(error as Error).message}`);
      failedAgents.push('provocateur');
      provocateurOutput = this.createFallbackProvocateurOutput();
    }

    // ========================
    // Round 3: Validator (FIX #21: OPTIONAL — degraded mode if fails)
    // ========================
    let validatorOutput: ValidatorOutput | null = null;
    try {
      logger.info('\n🔍 Round 3: Validator Check');
      validatorOutput = await this.validator.validate(request, expertOutput, provocateurOutput!);
      totalCost += this.validator.calculateCost(validatorOutput.tokensUsed);
      logger.info(`   ✓ Completeness: ${validatorOutput.validation.completenessScore}%, verdict: ${validatorOutput.validation.verdict}`);
    } catch (error) {
      logger.warn(`   ⚠️ Validator failed, continuing in degraded mode: ${(error as Error).message}`);
      failedAgents.push('validator');
      validatorOutput = this.createFallbackValidatorOutput();
    }

    // ========================
    // Final: Synthesizer (FIX #21: OPTIONAL — build basic response if fails)
    // ========================
    let synthesizerOutput: SynthesizerOutput | null = null;
    try {
      logger.info('\n📝 Final: Synthesizer');
      synthesizerOutput = await this.synthesizer.synthesize(expertOutput, provocateurOutput!, validatorOutput!);
      totalCost += this.synthesizer.calculateCost(synthesizerOutput.tokensUsed);
      logger.info(`   ✓ Critical risks: ${synthesizerOutput.synthesis.criticalRisks.length}`);
    } catch (error) {
      logger.warn(`   ⚠️ Synthesizer failed, building response from Expert output: ${(error as Error).message}`);
      failedAgents.push('synthesizer');
      synthesizerOutput = this.createFallbackSynthesizerOutput(expertOutput);
    }

    // Build final response
    const processingTimeMs = Date.now() - startTime;
    const finalResponse = this.buildFinalResponse(
      synthesizerOutput!,
      expertOutput,
      provocateurOutput!,
      validatorOutput!,
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
  // FIX #21: Fallback outputs for degraded mode
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
        overallAssessment: 'Агент Провокатор недоступний — аналіз неповний',
      },
    } as ProvocateurOutput;
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
        completenessScore: 0,
        verdict: 'NEEDS_REVIEW' as any,
        contradictions: [],
        missingAreas: ['Валідація не виконана — агент недоступний'],
        overallAssessment: 'Агент Валідатор недоступний — результати не перевірені',
      },
    } as ValidatorOutput;
  }

  private createFallbackSynthesizerOutput(expertOutput: ExpertOutput): SynthesizerOutput {
    return {
      agentId: 'synthesizer',
      role: 'synthesizer',
      confidence: expertOutput.confidence * 0.7, // Lower confidence without synthesis
      timestamp: new Date().toISOString(),
      tokensUsed: { input: 0, output: 0 },
      latencyMs: 0,
      synthesis: {
        summary: expertOutput.analysis.executiveSummary + '\n\n⚠️ Увага: Аналіз неповний — Синтезатор недоступний.',
        confidence: expertOutput.confidence * 0.7,
        criticalRisks: expertOutput.analysis.keyIssues
          .filter(i => i.severity >= 4)
          .map(i => ({
            title: i.title,
            description: i.description,
            impact: 'Визначено експертом',
            mitigation: i.recommendation || 'Потребує додаткового аналізу',
          })),
        recommendations: expertOutput.analysis.recommendations || [],
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
      contractType?: ContractType;
      jurisdiction?: string;
      totalCost: number;
      processingTimeMs: number;
      failedAgents?: string[];
    }
  ): ContractReviewResponse {
    // FIX #21: Append degraded mode warning to summary
    let summary = synthesizerOutput.synthesis.summary;
    if (metadata.failedAgents && metadata.failedAgents.length > 0) {
      summary += `\n\n⚠️ УВАГА: Аналіз проведено в неповному режимі. Недоступні агенти: ${metadata.failedAgents.join(', ')}. Рекомендуємо повторити аналіз пізніше для повного звіту.`;
    }

    return {
      summary,
      overallRiskScore: expertOutput.analysis.overallRiskScore,
      confidence: synthesizerOutput.synthesis.confidence,

      criticalRisks: synthesizerOutput.synthesis.criticalRisks,
      recommendations: synthesizerOutput.synthesis.recommendations,

      detailedAnalysis: {
        expertAnalysis: expertOutput.analysis,
        flawsFound: provocateurOutput.critique.flaws,
        validationResults: validatorOutput.validation,
      },

      metadata: {
        contractType: metadata.contractType || 'custom',
        jurisdiction: metadata.jurisdiction,
        analyzedAt: new Date().toISOString(),
        totalCost: metadata.totalCost,
        processingTimeMs: metadata.processingTimeMs,
      },
    };
  }

  private checkStopCriteria(
    expertOutput: ExpertOutput,
    provocateurOutput: ProvocateurOutput,
    validatorOutput: ValidatorOutput,
    currentRound: number
  ): { shouldStop: boolean; reason: string } {
    if (currentRound >= this.config.maxRounds) {
      return { shouldStop: true, reason: 'Max rounds reached' };
    }

    const hasHighSeverityIssues =
      expertOutput.analysis.keyIssues.some(i => i.severity >= this.config.maxSeverityThreshold) ||
      provocateurOutput.critique.flaws.some(f => f.severity >= this.config.maxSeverityThreshold);

    if (!hasHighSeverityIssues) {
      return { shouldStop: true, reason: `No issues with severity >= ${this.config.maxSeverityThreshold}` };
    }

    const avgConfidence = (expertOutput.confidence + provocateurOutput.confidence + validatorOutput.confidence) / 3;
    if (avgConfidence >= this.config.minConfidence) {
      return { shouldStop: true, reason: `Average confidence ${(avgConfidence * 100).toFixed(0)}% >= ${(this.config.minConfidence * 100).toFixed(0)}%` };
    }

    if (validatorOutput.validation.verdict === 'COMPLETE') {
      return { shouldStop: true, reason: 'Validator verdict: COMPLETE' };
    }

    return { shouldStop: false, reason: `High severity issues remain, confidence low (${(avgConfidence * 100).toFixed(0)}%)` };
  }

  getConfig(): ReviewOrchestratorConfig {
    return { ...this.config };
  }

  setConfig(config: Partial<ReviewOrchestratorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ==========================================
// CONVENIENCE FUNCTION
// ==========================================

export async function analyzeContract(
  contractText: string,
  options?: {
    contractType?: ContractReviewRequest['contractType'];
    jurisdiction?: string;
    questions?: string[];
    focusAreas?: ContractReviewRequest['focusAreas'];
    config?: Partial<ReviewOrchestratorConfig>;
  }
): Promise<ContractReviewResponse> {
  const orchestrator = new ReviewOrchestrator(options?.config);
  const request: ContractReviewRequest = {
    contractText,
    contractType: options?.contractType,
    jurisdiction: options?.jurisdiction || 'Ukraine',
    specificQuestions: options?.questions,
    focusAreas: options?.focusAreas,
  };
  return orchestrator.analyze(request);
}
