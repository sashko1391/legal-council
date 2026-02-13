/**
 * Core Types for Legal Council Orchestration
 * 
 * FIX #10: 'gen-validator' role
 * FIX #17 (Feb 13, 2026): Updated MODEL_PRICING to actual current prices
 */

// ==========================================
// AGENT TYPES
// ==========================================

export type AgentRole = 
  | 'expert' | 'provocateur' | 'validator' | 'synthesizer'
  | 'analyzer' | 'drafter' | 'gen-validator' | 'polisher';

export type ModelProvider = 'anthropic' | 'openai' | 'google';

export interface AgentConfig {
  id: string;
  role: AgentRole;
  model: string;
  provider: ModelProvider;
  priority: number;
  temperature: number;
  maxTokens: number;
}

// ==========================================
// AGENT OUTPUTS
// ==========================================

export interface BaseAgentOutput {
  agentId: string;
  role: AgentRole;
  confidence: number;
  timestamp: string;
  tokensUsed: { input: number; output: number };
  latencyMs: number;
}

export interface AgentError {
  agentId: string;
  error: string;
  timestamp: string;
  retryable: boolean;
}

// ==========================================
// ORCHESTRATOR TYPES
// ==========================================

export interface StopCriteria {
  maxRounds: number;
  maxSeverity: number;
  minConfidence: number;
  convergenceThreshold: number;
}

export interface OrchestratorConfig {
  agents: AgentConfig[];
  stopCriteria: StopCriteria;
  conflictResolution: 'priority' | 'weighted' | 'voting';
  enableAuditTrail: boolean;
}

export interface Round {
  roundNumber: number;
  outputs: BaseAgentOutput[];
  conflicts: Conflict[];
  convergence: number;
  shouldContinue: boolean;
}

export interface Conflict {
  agentA: string;
  agentB: string;
  issue: string;
  severity: number;
  resolution: string;
}

// ==========================================
// FINAL RESPONSE
// ==========================================

export interface CouncilResponse<T = any> {
  finalOutput: T;
  confidence: number;
  totalRounds: number;
  totalCost: number;
  totalLatencyMs: number;
  auditTrail: AuditTrail;
  metadata: {
    stopReason: 'max_rounds' | 'consensus' | 'high_confidence' | 'convergence';
    model: string;
  };
}

export interface AuditTrail {
  rounds: Round[];
  allOutputs: BaseAgentOutput[];
  conflicts: Conflict[];
  decisions: Decision[];
}

export interface Decision {
  timestamp: string;
  type: 'continue_round' | 'stop' | 'conflict_resolution';
  reason: string;
  data: any;
}

// ==========================================
// COST TRACKING
// ==========================================

export interface CostCalculation {
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  model: string;
}

/**
 * FIX #17: Updated to actual prices (Feb 2026).
 * Source: https://docs.anthropic.com/en/docs/about-claude/models
 *         https://openai.com/pricing
 *         https://ai.google.dev/pricing
 * 
 * Prices in USD per 1M tokens.
 */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic
  'claude-opus-4-5-20251101': { input: 15, output: 75 },
  'claude-sonnet-4-5-20250929': { input: 3, output: 15 },
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4 },

  // OpenAI
  'gpt-4-turbo-2024-04-09': { input: 10, output: 30 },
  'gpt-4o': { input: 2.50, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },

  // Google — free tier (rate limited)
  'gemini-2.5-flash-lite': { input: 0, output: 0 },
  'gemini-1.5-flash': { input: 0, output: 0 },
  'gemini-2.0-flash-thinking-exp-01-21': { input: 0, output: 0 },
};

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): CostCalculation {
  const pricing = MODEL_PRICING[model] || { input: 0, output: 0 };
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return { inputTokens, outputTokens, inputCost, outputCost, totalCost: inputCost + outputCost, model };
}
