/**
 * Model Configuration for Legal Council
 * Supports production/testing/development modes
 * 
 * FIX (Feb 10, 2026): Updated Gemini model to stable version
 */

import { AgentConfig, ModelProvider } from '../../core/orchestrator/types';

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
  // Production: Best quality, highest cost
  production: {
    review: {
      expert: 'claude-opus-4-5-20251101',       // $0.375/query
      provocateur: 'gemini-2.5-flash-lite',     // FREE (latest version)
      validator: 'claude-sonnet-4-5-20250929',  // $0.05/query
      synthesizer: 'gpt-4-turbo-2024-04-09',    // $0.08/query
    },
    generation: {
      analyzer: 'claude-opus-4-5-20251101',     // $0.375/query
      drafter: 'gpt-4-turbo-2024-04-09',        // $0.15/query
      validator: 'claude-sonnet-4-5-20250929',  // $0.05/query
      polisher: 'claude-opus-4-5-20251101',     // $0.20/query
    },
  },
  
  // Testing: Good quality, 70% cost reduction
  testing: {
    review: {
      expert: 'claude-sonnet-4-5-20250929',     // $0.05/query (7x cheaper!)
      provocateur: 'gemini-2.5-flash-lite',     // FREE (latest version)
      validator: 'claude-sonnet-4-5-20250929',  // $0.05/query
      synthesizer: 'gpt-4o',                    // $0.04/query
    },
    generation: {
      analyzer: 'claude-sonnet-4-5-20250929',   // $0.05/query
      drafter: 'gpt-4o',                        // $0.08/query
      validator: 'claude-sonnet-4-5-20250929',  // $0.05/query
      polisher: 'claude-sonnet-4-5-20250929',   // $0.08/query
    },
  },
  
  // Development: Maximum cost savings for local testing
  development: {
    review: {
      expert: 'gpt-4o-mini',                    // $0.0003 (дуже дешево!)
      provocateur: 'gemini-2.5-flash-lite',     // FREE (latest version)
      validator: 'gemini-2.5-flash-lite',       // FREE (instead of Sonnet)
      synthesizer: 'gpt-4o-mini',               // Cheapest
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

// Set via environment variable: LEGAL_COUNCIL_ENV=production|testing|development
const ENV = (process.env.LEGAL_COUNCIL_ENV || 'testing') as Environment;

export const ACTIVE_CONFIG = MODEL_CONFIGS[ENV];

console.log(`🔧 Legal Council running in ${ENV.toUpperCase()} mode`);

// ==========================================
// AGENT CONFIGS (Full specifications)
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
    {
      id: 'expert',
      role: 'expert',
      model: models.expert,
      provider: getProvider(models.expert),
      priority: 100,
      temperature: 0.3, // Low for deterministic analysis
      maxTokens: 8000, // Increased to handle large contract analyses
    },
    {
      id: 'provocateur',
      role: 'provocateur',
      model: models.provocateur,
      provider: getProvider(models.provocateur),
      priority: 95,
      temperature: 0.7, // Higher for creative flaw-finding
      maxTokens: 2000,
    },
    {
      id: 'validator',
      role: 'validator',
      model: models.validator,
      provider: getProvider(models.validator),
      priority: 85,
      temperature: 0.2, // Very low for strict checking
      maxTokens: 1500,
    },
    {
      id: 'synthesizer',
      role: 'synthesizer',
      model: models.synthesizer,
      provider: getProvider(models.synthesizer),
      priority: 100,
      temperature: 0.4, // Balanced
      maxTokens: 3000,
    },
  ];
}

export function createGenerationAgentConfigs(): AgentConfig[] {
  const models = ACTIVE_CONFIG.generation;
  
  return [
    {
      id: 'analyzer',
      role: 'analyzer',
      model: models.analyzer,
      provider: getProvider(models.analyzer),
      priority: 100,
      temperature: 0.3,
      maxTokens: 2000,
    },
    {
      id: 'drafter',
      role: 'drafter',
      model: models.drafter,
      provider: getProvider(models.drafter),
      priority: 90,
      temperature: 0.5, // Slightly creative for drafting
      maxTokens: 6000,  // Longer for full contracts
    },
    {
      id: 'gen-validator',
      role: 'validator',
      model: models.validator,
      provider: getProvider(models.validator),
      priority: 85,
      temperature: 0.2,
      maxTokens: 2000,
    },
    {
      id: 'polisher',
      role: 'polisher',
      model: models.polisher,
      provider: getProvider(models.polisher),
      priority: 95,
      temperature: 0.4,
      maxTokens: 6000,
    },
  ];
}

// ==========================================
// COST ESTIMATION
// ==========================================

export function estimateCostPerQuery(workflow: 'review' | 'generation'): {
  production: number;
  testing: number;
  development: number;
} {
  // Rough estimates based on average token usage
  const avgTokens = {
    review: { input: 10000, output: 5000 },
    generation: { input: 5000, output: 8000 },
  };
  
  // Using pricing from types.ts MODEL_PRICING
  return {
    production: workflow === 'review' ? 0.51 : 0.65,
    testing: workflow === 'review' ? 0.14 : 0.18,
    development: workflow === 'review' ? 0.001 : 0.002,  // GPT-4o-mini + Gemini FREE!
  };
}
