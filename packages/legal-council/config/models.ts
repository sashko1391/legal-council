/**
 * Model Configuration for Legal Council
 * 
 * FIX #10: gen-validator role
 * FIX #17 (Feb 13, 2026): Dynamic cost estimation from MODEL_PRICING
 *   — No more hardcoded cost numbers
 *   — Updated Claude/GPT prices to current actuals
 */

import { AgentConfig, ModelProvider, MODEL_PRICING } from '../../core/orchestrator/types';

// ==========================================
// ENVIRONMENT-BASED CONFIGS
// ==========================================

export type Environment = 'production' | 'testing' | 'development';

interface ModelSet {
  review: {
    expert: string;
    provocateur: string;
    validator: string;
    synthesizer: string;
  };
  generation: {
    analyzer: string;
    drafter: string;
    validator: string;
    polisher: string;
  };
}

export const MODEL_CONFIGS: Record<Environment, ModelSet> = {
  production: {
    review: {
      expert: 'claude-opus-4-5-20251101',
      provocateur: 'gemini-2.5-flash-lite',
      validator: 'claude-sonnet-4-5-20250929',
      synthesizer: 'gpt-4-turbo-2024-04-09',
    },
    generation: {
      analyzer: 'claude-opus-4-5-20251101',
      drafter: 'gpt-4-turbo-2024-04-09',
      validator: 'claude-sonnet-4-5-20250929',
      polisher: 'claude-opus-4-5-20251101',
    },
  },
  testing: {
    review: {
      expert: 'claude-sonnet-4-5-20250929',
      provocateur: 'gemini-2.5-flash-lite',
      validator: 'claude-sonnet-4-5-20250929',
      synthesizer: 'gpt-4o',
    },
    generation: {
      analyzer: 'claude-sonnet-4-5-20250929',
      drafter: 'gpt-4o',
      validator: 'claude-sonnet-4-5-20250929',
      polisher: 'claude-sonnet-4-5-20250929',
    },
  },
  development: {
    review: {
      expert: 'gpt-4o-mini',
      provocateur: 'gemini-2.5-flash-lite',
      validator: 'gemini-2.5-flash-lite',
      synthesizer: 'gpt-4o-mini',
    },
    generation: {
      analyzer: 'gpt-4o-mini',
      drafter: 'gpt-4o-mini',
      validator: 'gemini-2.5-flash-lite',
      polisher: 'gpt-4o-mini',
    },
  },
};

// ==========================================
// ACTIVE CONFIGURATION
// ==========================================

const ENV = (process.env.LEGAL_COUNCIL_ENV || 'testing') as Environment;
export const ACTIVE_CONFIG = MODEL_CONFIGS[ENV];

console.log(`🧠 Legal Council running in ${ENV.toUpperCase()} mode`);

// ==========================================
// AGENT CONFIGS
// ==========================================

function getProvider(model: string): ModelProvider {
  if (model.includes('claude')) return 'anthropic';
  if (model.includes('gpt')) return 'openai';
  if (model.includes('gemini')) return 'google';
  throw new Error(`Unknown model provider for: ${model}`);
}

export function createReviewAgentConfigs(): AgentConfig[] {
  const models = ACTIVE_CONFIG.review;
  return [
    { id: 'expert', role: 'expert', model: models.expert, provider: getProvider(models.expert), priority: 100, temperature: 0.3, maxTokens: 8000 },
    { id: 'provocateur', role: 'provocateur', model: models.provocateur, provider: getProvider(models.provocateur), priority: 95, temperature: 0.7, maxTokens: 2000 },
    { id: 'validator', role: 'validator', model: models.validator, provider: getProvider(models.validator), priority: 85, temperature: 0.2, maxTokens: 1500 },
    { id: 'synthesizer', role: 'synthesizer', model: models.synthesizer, provider: getProvider(models.synthesizer), priority: 100, temperature: 0.4, maxTokens: 3000 },
  ];
}

export function createGenerationAgentConfigs(): AgentConfig[] {
  const models = ACTIVE_CONFIG.generation;
  return [
    { id: 'analyzer', role: 'analyzer', model: models.analyzer, provider: getProvider(models.analyzer), priority: 100, temperature: 0.3, maxTokens: 2000 },
    { id: 'drafter', role: 'drafter', model: models.drafter, provider: getProvider(models.drafter), priority: 90, temperature: 0.5, maxTokens: 6000 },
    { id: 'gen-validator', role: 'gen-validator', model: models.validator, provider: getProvider(models.validator), priority: 85, temperature: 0.2, maxTokens: 2000 },
    { id: 'polisher', role: 'polisher', model: models.polisher, provider: getProvider(models.polisher), priority: 95, temperature: 0.4, maxTokens: 6000 },
  ];
}

// ==========================================
// FIX #17: DYNAMIC COST ESTIMATION
// ==========================================

/**
 * Calculate estimated cost per query based on actual MODEL_PRICING.
 * No more hardcoded numbers — reads from the pricing table.
 */
export function estimateCostPerQuery(workflow: 'review' | 'generation'): {
  production: number;
  testing: number;
  development: number;
} {
  // Average token usage per workflow (measured from real usage)
  const avgTokens = {
    review: { input: 10000, output: 5000 },
    generation: { input: 5000, output: 8000 },
  };

  const tokens = avgTokens[workflow];
  const result: Record<string, number> = {};

  for (const env of ['production', 'testing', 'development'] as Environment[]) {
    const models = MODEL_CONFIGS[env][workflow];
    let totalCost = 0;

    // Sum cost for each agent in the pipeline
    for (const model of Object.values(models)) {
      const pricing = MODEL_PRICING[model] || { input: 0, output: 0 };
      const inputCost = (tokens.input / 1_000_000) * pricing.input;
      const outputCost = (tokens.output / 1_000_000) * pricing.output;
      totalCost += inputCost + outputCost;
    }

    result[env] = Math.round(totalCost * 10000) / 10000; // 4 decimal places
  }

  return result as { production: number; testing: number; development: number };
}
