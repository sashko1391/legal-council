/**
 * Review Orchestrator
 * Coordinates Expert → Provocateur → Validator → Synthesizer
 * Implements tick-based cycle with stop criteria
 * 
 * FIX (Feb 11, 2026): buildFinalResponse moved to Orchestrator to avoid webpack cache issues
 */

import { ExpertAgent } from '../agents/review/expert';
import { ProvocateurAgent } from '../agents/review/provocateur';
import { ValidatorAgent } from '../agents/review/validator';
import { SynthesizerAgent } from '../agents/review/synthesizer';
import type {
  ContractReviewRequest,
  ContractReviewResponse,
  ExpertOutput,
  ProvocateurOutput,
  ValidatorOutput,
  SynthesizerOutput,
} from '../types/review-types';
import type { Round, AuditTrail } from '../../core/orchestrator/types';

export interface ReviewOrchestratorConfig {
  maxRounds: number; // Max iterations before forcing stop
  maxSeverityThreshold: number; // Stop if no issues >= this severity
  minConfidence: number; // Stop if all agents >= this confidence
  enableAuditTrail: boolean;
}

const DEFAULT_CONFIG: ReviewOrchestratorConfig = {
  maxRounds: 3,
  maxSeverityThreshold: 3, // Stop if no severity >= 3 issues remain
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

    // Initialize agents
    this.expert = new ExpertAgent();
    this.provocateur = new ProvocateurAgent();
    this.validator = new ValidatorAgent();
    this.synthesizer = new SynthesizerAgent();
  }

  /**
   * Main orchestration method
   */
  async analyze(request: ContractReviewRequest): Promise<ContractReviewResponse> {
    const startTime = Date.now();
    const rounds: Round[] = [];
    let totalCost = 0;

    console.log('🛡️ Legal Council Review Session Starting...');
    console.log(`   Max rounds: ${this.config.maxRounds}`);
    console.log(`   Stop criteria: severity < ${this.config.maxSeverityThreshold}, confidence > ${this.config.minConfidence}`);

    // Round 1: Initial analysis
    console.log('\n📋 Round 1: Expert Analysis');
    const expertOutput = await this.expert.analyze(request);
    totalCost += this.expert.calculateCost(expertOutput.tokensUsed);
    console.log(`   ✓ Found ${expertOutput.analysis.keyIssues.length} issues`);
    console.log(`   ✓ Risk score: ${expertOutput.analysis.overallRiskScore}/10`);
    console.log(`   ✓ Confidence: ${(expertOutput.confidence * 100).toFixed(0)}%`);

    // Round 2: Adversarial critique
    console.log('\n🔥 Round 2: Provocateur Critique');
    const provocateurOutput = await this.provocateur.critique(
      request.contractText,
      expertOutput
    );
    totalCost += this.provocateur.calculateCost(provocateurOutput.tokensUsed);
    console.log(`   ✓ Found ${provocateurOutput.critique.flaws.length} flaws`);
    console.log(`   ✓ Max severity: ${provocateurOutput.critique.maxSeverity}/5`);
    console.log(`   ✓ Confidence: ${(provocateurOutput.confidence * 100).toFixed(0)}%`);

    // Round 3: Validation
    console.log('\n🔍 Round 3: Validator Check');
    const validatorOutput = await this.validator.validate(
      request,
      expertOutput,
      provocateurOutput
    );
    totalCost += this.validator.calculateCost(validatorOutput.tokensUsed);
    console.log(`   ✓ Completeness: ${validatorOutput.validation.completenessScore}%`);
    console.log(`   ✓ Verdict: ${validatorOutput.validation.verdict}`);
    console.log(`   ✓ Contradictions: ${validatorOutput.validation.contradictions.length}`);

    // Check stop criteria
    const shouldStop = this.checkStopCriteria(
      expertOutput,
      provocateurOutput,
      validatorOutput,
      1
    );

    if (shouldStop.shouldStop) {
      console.log(`\n✅ Stop criteria met: ${shouldStop.reason}`);
    } else {
      console.log(`\n⭐ Continue criteria: ${shouldStop.reason}`);
      // In MVP, we don't actually iterate - just log
      // Future: Implement multi-round refinement
    }

    // Final: Synthesis
    console.log('\n📝 Final: Synthesizer');
    const synthesizerOutput = await this.synthesizer.synthesize(
      expertOutput,
      provocateurOutput,
      validatorOutput
    );
    totalCost += this.synthesizer.calculateCost(synthesizerOutput.tokensUsed);
    console.log(`   ✓ Critical risks: ${synthesizerOutput.synthesis.criticalRisks.length}`);
    console.log(`   ✓ Recommendations: ${synthesizerOutput.synthesis.recommendations.length}`);
    console.log(`   ✓ Confidence: ${(synthesizerOutput.synthesis.confidence * 100).toFixed(0)}%`);

    // Build final response
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
      }
    );

    console.log(`\n✨ Legal Council Review Complete!`);
    console.log(`   Total cost: $${totalCost.toFixed(4)}`);
    console.log(`   Processing time: ${(processingTimeMs / 1000).toFixed(1)}s`);
    console.log(`   Final confidence: ${(finalResponse.confidence * 100).toFixed(0)}%`);

    return finalResponse;
  }

  /**
   * Build final ContractReviewResponse from all outputs
   */
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
    }
  ): ContractReviewResponse {
    return {
      summary: synthesizerOutput.synthesis.summary,
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
        contractType: metadata.contractType as any,
        jurisdiction: metadata.jurisdiction,
        analyzedAt: new Date().toISOString(),
        totalCost: metadata.totalCost,
        processingTimeMs: metadata.processingTimeMs,
      },
    };
  }

  /**
   * Check if we should stop iteration
   */
  private checkStopCriteria(
    expertOutput: ExpertOutput,
    provocateurOutput: ProvocateurOutput,
    validatorOutput: ValidatorOutput,
    currentRound: number
  ): { shouldStop: boolean; reason: string } {
    // Criteria 1: Max rounds reached
    if (currentRound >= this.config.maxRounds) {
      return { shouldStop: true, reason: 'Max rounds reached' };
    }

    // Criteria 2: No high-severity issues
    const hasHighSeverityIssues =
      expertOutput.analysis.keyIssues.some(
        (i) => i.severity >= this.config.maxSeverityThreshold
      ) ||
      provocateurOutput.critique.flaws.some(
        (f) => f.severity >= this.config.maxSeverityThreshold
      );

    if (!hasHighSeverityIssues) {
      return {
        shouldStop: true,
        reason: `No issues with severity >= ${this.config.maxSeverityThreshold}`,
      };
    }

    // Criteria 3: High confidence from all agents
    const avgConfidence =
      (expertOutput.confidence +
        provocateurOutput.confidence +
        validatorOutput.confidence) /
      3;

    if (avgConfidence >= this.config.minConfidence) {
      return {
        shouldStop: true,
        reason: `Average confidence ${(avgConfidence * 100).toFixed(0)}% >= ${(this.config.minConfidence * 100).toFixed(0)}%`,
      };
    }

    // Criteria 4: Validator says COMPLETE
    if (validatorOutput.validation.verdict === 'COMPLETE') {
      return { shouldStop: true, reason: 'Validator verdict: COMPLETE' };
    }

    // Continue if none of the stop criteria met
    return {
      shouldStop: false,
      reason: `High severity issues remain (${hasHighSeverityIssues}), confidence low (${(avgConfidence * 100).toFixed(0)}%)`,
    };
  }

  /**
   * Get configuration
   */
  getConfig(): ReviewOrchestratorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<ReviewOrchestratorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ==========================================
// CONVENIENCE FUNCTION
// ==========================================

/**
 * Quick way to analyze contract
 */
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
