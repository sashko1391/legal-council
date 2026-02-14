/**
 * Base Agent - Foundation for all Legal Council agents
 * 
 * FIXES Applied:
 * - #4: Rate limit (429) and server error (500, 503) retries
 * - #6: Per-request client creation (no singletons)
 * - #7: Gemini systemInstruction parameter
 * - #8: Retry logic for Google Gemini
 * - #9: Accurate token counts via usageMetadata (Ukrainian text)
 * - #12: AbortController timeout (120s) for all API calls
 * - #13: JSON repair fallback (trailing commas, single quotes, unescaped newlines)
 * - #16: Proper logger instead of console.log (no contract text leak in production)
 * - C3 (Feb 14, 2026): AbortSignal actually passed to all SDK calls
 * - H3 (Feb 14, 2026): Apostrophe-safe JSON repair (Ukrainian об'єкт, обов'язок)
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AgentConfig, BaseAgentOutput } from '../../core/orchestrator/types';
import { calculateCost } from '../../core/orchestrator/types';
import { createAgentLogger, logger } from '../utils/logger';

// ==========================================================================
// CONSTANTS
// ==========================================================================

/** Timeout for any single LLM API call (2 minutes) */
const API_TIMEOUT_MS = 120_000;

/** Maximum retry attempts */
const MAX_RETRIES = 3;

// ==========================================================================
// FIX #6: Per-request client factories
// ==========================================================================

function createAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not found in environment variables');
  return new Anthropic({ apiKey });
}

function createOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not found in environment variables');
  return new OpenAI({ apiKey });
}

function createGoogleClient(): GoogleGenerativeAI {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_API_KEY not found in environment variables');
  return new GoogleGenerativeAI(apiKey);
}

// ==========================================================================
// FIX #4: Retryable error detection
// ==========================================================================

function isRetryableError(error: any): boolean {
  // Network errors
  if (
    error.code === 'EAI_AGAIN' || error.code === 'ENOTFOUND' ||
    error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' ||
    error.message?.includes('Connection error') ||
    error.message?.includes('network')
  ) return true;

  // FIX #12: Timeout abort
  if (error.name === 'AbortError' || error.message?.includes('aborted')) return true;

  // HTTP status-based (rate limit, server errors)
  const status = error.status || error.statusCode || error.response?.status;
  if (status === 429 || status === 500 || status === 503) return true;

  // Provider-specific
  if (error.type === 'rate_limit_error' || error.error?.type === 'rate_limit_error') return true;
  if (error.code === 'rate_limit_exceeded') return true;

  // Message-based
  if (
    error.message?.includes('rate limit') || error.message?.includes('Rate limit') ||
    error.message?.includes('overloaded') || error.message?.includes('Overloaded') ||
    error.message?.includes('Too Many Requests') || error.message?.includes('Service Unavailable')
  ) return true;

  return false;
}

function isAuthError(error: any): boolean {
  if (error.message?.includes('Invalid API key') || error.message?.includes('not found')) return true;
  const status = error.status || error.statusCode || error.response?.status;
  return status === 401 || status === 403;
}

function getRetryDelay(attempt: number, error?: any): number {
  const retryAfter = error?.headers?.['retry-after'] || error?.response?.headers?.['retry-after'];
  if (retryAfter) {
    const ms = parseInt(retryAfter, 10) * 1000;
    if (!isNaN(ms) && ms > 0) return Math.min(ms, 60_000);
  }
  const base = 1000 * Math.pow(2, attempt - 1);
  return Math.min(base + Math.random() * 500, 30_000);
}

// ==========================================================================
// FIX #12: Timeout helper
// ==========================================================================

function createTimeout(): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

// ==========================================================================
// BASE AGENT
// ==========================================================================

export abstract class BaseAgent<TOutput extends BaseAgentOutput = BaseAgentOutput> {
  protected config: AgentConfig;
  protected systemPrompt: string;
  private log: ReturnType<typeof createAgentLogger>;

  constructor(config: AgentConfig, systemPrompt: string) {
    this.config = config;
    this.systemPrompt = systemPrompt;
    this.log = createAgentLogger(config.id);
  }

  async call(userPrompt: string): Promise<TOutput> {
    const startTime = Date.now();

    try {
      let response: string;
      let tokensUsed: { input: number; output: number };

      switch (this.config.provider) {
        case 'anthropic':
          ({ response, tokensUsed } = await this.callAnthropic(userPrompt));
          break;
        case 'openai':
          ({ response, tokensUsed } = await this.callOpenAI(userPrompt));
          break;
        case 'google':
          ({ response, tokensUsed } = await this.callGoogle(userPrompt));
          break;
        default:
          throw new Error(`Unknown provider: ${this.config.provider}`);
      }

      const latencyMs = Date.now() - startTime;

      // FIX #16: debug level — suppressed in production (no contract text leak)
      this.log.debug(`Raw LLM Response (first 500 chars):\n${response.substring(0, 500)}`);
      this.log.debug(`Response total length: ${response.length} chars`);

      const parsed = this.parseResponse(response);

      const baseOutput: BaseAgentOutput = {
        agentId: this.config.id,
        role: this.config.role,
        confidence: parsed.confidence || 0.8,
        timestamp: new Date().toISOString(),
        tokensUsed,
        latencyMs,
      };

      return { ...baseOutput, ...parsed } as TOutput;
    } catch (error) {
      this.log.error(`Agent failed:`, error);
      throw error;
    }
  }

  // ==========================================================================
  // ANTHROPIC — FIX C3: signal passed to SDK
  // ==========================================================================

  private async callAnthropic(userPrompt: string): Promise<{
    response: string;
    tokensUsed: { input: number; output: number };
  }> {
    const client = createAnthropicClient();
    let lastError: any;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const timeout = createTimeout();
      try {
        // FIX C3: Pass AbortSignal as second argument (request options)
        const message = await client.messages.create(
          {
            model: this.config.model,
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature,
            system: this.systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
          },
          { signal: timeout.signal }
        );
        timeout.clear();

        const textContent = message.content.find((c) => c.type === 'text');
        if (!textContent || textContent.type !== 'text') {
          throw new Error('No text content in Anthropic response');
        }

        return {
          response: textContent.text,
          tokensUsed: { input: message.usage.input_tokens, output: message.usage.output_tokens },
        };
      } catch (error: any) {
        timeout.clear();
        lastError = error;
        if (isAuthError(error) || !isRetryableError(error)) throw error;
        if (attempt === MAX_RETRIES) { this.log.error(`All ${MAX_RETRIES} attempts failed`); throw error; }
        const delay = getRetryDelay(attempt, error);
        this.log.warn(`Retryable error (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay}ms: ${error.status || error.code} - ${error.message}`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw lastError;
  }

  // ==========================================================================
  // OPENAI — FIX C3: signal passed to SDK
  // ==========================================================================

  private async callOpenAI(userPrompt: string): Promise<{
    response: string;
    tokensUsed: { input: number; output: number };
  }> {
    const client = createOpenAIClient();
    let lastError: any;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const timeout = createTimeout();
      try {
        // FIX C3: Pass AbortSignal as second argument (request options)
        const completion = await client.chat.completions.create(
          {
            model: this.config.model,
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature,
            messages: [
              { role: 'system', content: this.systemPrompt },
              { role: 'user', content: userPrompt },
            ],
          },
          { signal: timeout.signal }
        );
        timeout.clear();

        const choice = completion.choices[0];
        if (!choice?.message?.content) throw new Error('No content in OpenAI response');

        return {
          response: choice.message.content,
          tokensUsed: { input: completion.usage?.prompt_tokens || 0, output: completion.usage?.completion_tokens || 0 },
        };
      } catch (error: any) {
        timeout.clear();
        lastError = error;
        if (isAuthError(error) || !isRetryableError(error) || attempt === MAX_RETRIES) throw error;
        const delay = getRetryDelay(attempt, error);
        this.log.warn(`Retryable error (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay}ms: ${error.status || error.code} - ${error.message}`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw lastError;
  }

  // ==========================================================================
  // GOOGLE GEMINI (#7, #8, #9) — FIX C3: timeout via requestOptions
  // ==========================================================================

  private async callGoogle(userPrompt: string): Promise<{
    response: string;
    tokensUsed: { input: number; output: number };
  }> {
    const client = createGoogleClient();
    // FIX C3: Gemini SDK doesn't support AbortSignal on generateContent,
    // so we use requestOptions.timeout on the model itself
    const model = client.getGenerativeModel(
      {
        model: this.config.model,
        systemInstruction: this.systemPrompt, // FIX #7
      },
      { timeout: API_TIMEOUT_MS } // FIX C3: request-level timeout
    );

    let lastError: any;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const timeout = createTimeout();
      try {
        const result = await model.generateContent(userPrompt);
        timeout.clear();
        const response = result.response.text();

        // FIX #9: Real token counts from API (fallback /3 for Ukrainian text)
        const usage = result.response.usageMetadata;
        const inputTokens = usage?.promptTokenCount || Math.ceil(userPrompt.length / 3);
        const outputTokens = usage?.candidatesTokenCount || Math.ceil(response.length / 3);

        return { response, tokensUsed: { input: inputTokens, output: outputTokens } };
      } catch (error: any) {
        timeout.clear();
        lastError = error;
        if (isAuthError(error) || !isRetryableError(error) || attempt === MAX_RETRIES) throw error;
        const delay = getRetryDelay(attempt, error);
        this.log.warn(`Google API error (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay}ms: ${error.status || error.code} - ${error.message}`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw lastError;
  }

  // ==========================================================================
  // FIX #13: JSON Parsing with repair fallback
  // ==========================================================================

  protected parseResponse(response: string): any {
    const originalResponse = response;

    try {
      // Strategy 1: Clean markdown fences
      let cleaned = response.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
      }

      // Strategy 2: Extract JSON object
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      }

      // Strategy 3: Try direct parse
      try {
        const parsed = JSON.parse(cleaned);
        this.log.info('Successfully parsed JSON');
        return parsed;
      } catch (directError) {
        // Strategy 4: Repair common LLM JSON issues
        this.log.debug('Direct JSON parse failed, attempting repair...');
        const repaired = this.repairJson(cleaned);
        const parsed = JSON.parse(repaired);
        this.log.info('Successfully parsed JSON after repair');
        return parsed;
      }

    } catch (error) {
      // FIX #16: Error details only in debug (production: no contract text in logs)
      this.log.error(`JSON Parsing Failed!`);
      this.log.debug(`Original Response (full):\n${originalResponse}`);
      this.log.debug(`Response Length: ${originalResponse.length} characters`);
      this.log.debug(`First 200 chars: ${originalResponse.substring(0, 200)}`);
      this.log.debug(`Last 200 chars: ${originalResponse.substring(Math.max(0, originalResponse.length - 200))}`);

      if (!originalResponse.includes('{')) {
        this.log.error('Response does not contain any JSON object');
      }
      if (originalResponse.includes("I'm sorry") || originalResponse.includes('I cannot')) {
        this.log.error('LLM appears to have refused the request');
      }

      throw new Error(`Invalid JSON response from ${this.config.id}: ${error}\nSee logs for details.`);
    }
  }

  /**
   * FIX #13 + H3: Attempt to repair common JSON issues from LLM output
   * 
   * H3: Apostrophe-safe — Ukrainian text uses ' inside words (об'єкт, обов'язок).
   * Old code replaced ALL single quotes, corrupting Ukrainian text.
   * New code only replaces single quotes used as JSON delimiters.
   */
  private repairJson(json: string): string {
    let repaired = json;

    // Fix 1: Remove trailing commas before } or ]
    // e.g., {"a": 1, "b": 2,} → {"a": 1, "b": 2}
    repaired = repaired.replace(/,\s*([\]}])/g, '$1');

    // Fix 2: Replace single-quoted JSON delimiters (NOT Ukrainian apostrophes)
    // Ukrainian: об'єкт, обов'язок, з'єднання — apostrophe INSIDE a word
    // JSON delimiters: {'key': 'value'} — apostrophe AROUND keys/values
    // Strategy: replace ' only when it appears as a string delimiter
    //   - After : , [ { (opening a value)
    //   - Before : ] } , (closing a value/key)
    repaired = repaired.replace(/([:,\[{])\s*'([^']*?)'\s*(?=[,\]}:])/g, '$1"$2"');
    // Catch remaining key patterns: 'key':
    repaired = repaired.replace(/'([^']*?)'(\s*:)/g, '"$1"$2');

    // Fix 3: Fix unescaped newlines inside strings
    repaired = repaired.replace(/"([^"]*?)"/g, (match) => {
      return match
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
    });

    // Fix 4: Remove JavaScript-style comments
    repaired = repaired.replace(/\/\/.*$/gm, '');
    repaired = repaired.replace(/\/\*[\s\S]*?\*\//g, '');

    // Fix 5: Fix unquoted keys (simple cases)
    // e.g., {key: "value"} → {"key": "value"}
    repaired = repaired.replace(/(\{|,)\s*([a-zA-Z_]\w*)\s*:/g, '$1"$2":');

    return repaired;
  }

  calculateCost(tokensUsed: { input: number; output: number }): number {
    const costCalc = calculateCost(this.config.model, tokensUsed.input, tokensUsed.output);
    return costCalc.totalCost;
  }

  protected logMessage(message: string, data?: any): void {
    this.log.info(message, data);
  }
}

// ==========================================
// ERROR HANDLING
// ==========================================

export class AgentError extends Error {
  constructor(
    public agentId: string,
    public originalError: Error,
    public retryable: boolean = true
  ) {
    super(`Agent ${agentId} failed: ${originalError.message}`);
    this.name = 'AgentError';
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (isAuthError(error)) throw error;
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        logger.info(`Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError!;
}
