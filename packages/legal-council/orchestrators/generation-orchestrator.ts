/**
 * Generation Orchestrator
 * Coordinates Analyzer → Drafter → Validator → Polisher
 */

import { AnalyzerAgent } from '../agents/generation/analyzer';
import { DrafterAgent } from '../agents/generation/drafter';
import { GenerationValidatorAgent } from '../agents/generation/validator';
import { PolisherAgent } from '../agents/generation/polisher';
import type {
  DocumentGenerationRequest,
  DocumentGenerationResponse,
} from '../types/generation-types';

export interface GenerationOrchestratorConfig {
  maxRevisions: number; // Max times to redraft if validator fails
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
   * Main generation method
   */
  async generate(request: DocumentGenerationRequest): Promise<DocumentGenerationResponse> {
    const startTime = Date.now();
    let totalCost = 0;

    console.log('📝 Legal Council Generation Session Starting...');
    console.log(`   Document type: ${request.documentType}`);
    console.log(`   Max revisions: ${this.config.maxRevisions}`);

    // Step 1: Analyze requirements
    console.log('\n🔍 Step 1: Analyzer');
    const analyzerOutput = await this.analyzer.analyze(request);
    totalCost += this.analyzer.calculateCost(analyzerOutput.tokensUsed);
    console.log(`   ✓ Structured requirements`);
    console.log(
      `   ✓ Must-have clauses: ${analyzerOutput.analysis.structuredRequirements.mustHaveClauses.length}`
    );
    console.log(
      `   ✓ Suggested clauses: ${analyzerOutput.analysis.suggestedClauses.length}`
    );

    // Step 2: Draft document
    console.log('\n📄 Step 2: Drafter');
    const drafterOutput = await this.drafter.draft(
      request.documentType,
      analyzerOutput
    );
    totalCost += this.drafter.calculateCost(drafterOutput.tokensUsed);
    console.log(`   ✓ Draft generated`);
    console.log(
      `   ✓ Document length: ${drafterOutput.draft.documentText.length} chars`
    );
    console.log(
      `   ✓ Clauses included: ${drafterOutput.draft.includedClauses.length}`
    );

    // Step 3: Validate
    console.log('\n✅ Step 3: Validator');
    const validatorOutput = await this.validator.validate(analyzerOutput, drafterOutput);
    totalCost += this.validator.calculateCost(validatorOutput.tokensUsed);
    console.log(`   ✓ Compliance score: ${validatorOutput.validation.overallScore}%`);
    console.log(`   ✓ Verdict: ${validatorOutput.validation.verdict}`);
    console.log(
      `   ✓ Risk flags: ${validatorOutput.validation.riskFlags.length}`
    );

    // Check if needs revision
    if (
      validatorOutput.validation.verdict === 'NEEDS_REVISION' &&
      validatorOutput.validation.riskFlags.some((f) => f.severity >= 4)
    ) {
      console.log('\n⚠️  Critical issues found - would need revision in production');
      console.log('   (MVP: proceeding to polisher anyway)');
      // In production: Loop back to drafter with validator feedback
    }

    // Step 4: Polish
    console.log('\n✨ Step 4: Polisher');
    const polisherOutput = await this.polisher.polish(drafterOutput, validatorOutput);
    totalCost += this.polisher.calculateCost(polisherOutput.tokensUsed);
    console.log(`   ✓ Document polished`);
    console.log(
      `   ✓ Improvements made: ${polisherOutput.polished.improvements.length}`
    );
    console.log(`   ✓ Executive summary prepared`);

    // Build final response
    const processingTimeMs = Date.now() - startTime;
    const finalResponse = this.polisher.buildFinalResponse(
      polisherOutput,
      analyzerOutput,
      drafterOutput,
      validatorOutput,
      {
        documentType: request.documentType,
        totalCost,
        processingTimeMs,
      }
    );

    console.log(`\n🎉 Legal Council Generation Complete!`);
    console.log(`   Total cost: $${totalCost.toFixed(4)}`);
    console.log(`   Processing time: ${(processingTimeMs / 1000).toFixed(1)}s`);
    console.log(
      `   Quality score: ${finalResponse.qualityMetrics.overall}%`
    );

    return finalResponse;
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
