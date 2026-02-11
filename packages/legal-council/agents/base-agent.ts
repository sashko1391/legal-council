/**
 * Base Agent - Foundation for all Legal Council agents
 * 
 * FIXES (Feb 10, 2026):
 * - Improved JSON parsing with multiple strategies
 * - Detailed error logging to debug undefined outputs
 * - Better handling of LLM responses with extra text
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AgentConfig, BaseAgentOutput } from '../../core/orchestrator/types';
import { calculateCost } from '../../core/orchestrator/types';

// Singleton instances
let anthropicClient: Anthropic | null = null;
let openaiClient: OpenAI | null = null;
let googleClient: GoogleGenerativeAI | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not found in environment variables');
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not found in environment variables');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

function getGoogleClient(): GoogleGenerativeAI {
  if (!googleClient) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY not found in environment variables');
    }
    googleClient = new GoogleGenerativeAI(apiKey);
  }
  return googleClient;
}

// ==========================================
// BASE AGENT
// ==========================================

export abstract class BaseAgent<TOutput extends BaseAgentOutput = BaseAgentOutput> {
  protected config: AgentConfig;
  protected systemPrompt: string;

  constructor(config: AgentConfig, systemPrompt: string) {
    this.config = config;
    this.systemPrompt = systemPrompt;
  }

  /**
   * Main method to call LLM and get response
   */
  async call(userPrompt: string): Promise<TOutput> {
    const startTime = Date.now();

    try {
      let response: string;
      let tokensUsed: { input: number; output: number };

      // Route to appropriate provider
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

      // Log raw response for debugging
      console.log(`\n🔍 [${this.config.id}] Raw LLM Response (first 500 chars):`);
      console.log(response.substring(0, 500));
      console.log(`... (total length: ${response.length} chars)\n`);

      // Parse JSON response with improved error handling
      const parsed = this.parseResponse(response);

      // Build base output
      const baseOutput: BaseAgentOutput = {
        agentId: this.config.id,
        role: this.config.role,
        confidence: parsed.confidence || 0.8, // Default if not specified
        timestamp: new Date().toISOString(),
        tokensUsed,
        latencyMs,
      };

      // Merge with parsed data
      return { ...baseOutput, ...parsed } as TOutput;
    } catch (error) {
      console.error(`❌ Agent ${this.config.id} failed:`, error);
      throw error;
    }
  }

  /**
   * Call Anthropic API (Claude) with retry logic for network errors
   */
  private async callAnthropic(userPrompt: string): Promise<{
    response: string;
    tokensUsed: { input: number; output: number };
  }> {
    const client = getAnthropicClient();
    
    // Retry logic for network errors
    const maxRetries = 3;
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const message = await client.messages.create({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          system: this.systemPrompt,
          messages: [
            {
              role: 'user',
              content: userPrompt,
            },
          ],
        });

        // Extract text from response
        const textContent = message.content.find((c) => c.type === 'text');
        if (!textContent || textContent.type !== 'text') {
          throw new Error('No text content in Anthropic response');
        }

        return {
          response: textContent.text,
          tokensUsed: {
            input: message.usage.input_tokens,
            output: message.usage.output_tokens,
          },
        };
        
      } catch (error: any) {
        lastError = error;
        
        // Check if it's a network error that we should retry
        const isNetworkError = 
          error.code === 'EAI_AGAIN' ||
          error.code === 'ENOTFOUND' ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ECONNRESET' ||
          error.message?.includes('Connection error') ||
          error.message?.includes('network');
        
        // Don't retry on API errors (invalid key, rate limit, etc)
        if (!isNetworkError) {
          throw error;
        }
        
        // If this was the last attempt, throw
        if (attempt === maxRetries) {
          console.error(`❌ [${this.config.id}] All ${maxRetries} attempts failed with network error`);
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        const delayMs = 1000 * Math.pow(2, attempt - 1);
        console.log(`⚠️ [${this.config.id}] Network error on attempt ${attempt}/${maxRetries}. Retrying in ${delayMs}ms...`);
        console.log(`   Error: ${error.code} - ${error.message}`);
        
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    throw lastError;
  }

  /**
   * Call OpenAI API (GPT-4) with retry logic for network errors
   */
  private async callOpenAI(userPrompt: string): Promise<{
    response: string;
    tokensUsed: { input: number; output: number };
  }> {
    const client = getOpenAIClient();
    
    // Retry logic for network errors
    const maxRetries = 3;
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const completion = await client.chat.completions.create({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          messages: [
            {
              role: 'system',
              content: this.systemPrompt,
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
        });

        const choice = completion.choices[0];
        if (!choice || !choice.message || !choice.message.content) {
          throw new Error('No content in OpenAI response');
        }

        return {
          response: choice.message.content,
          tokensUsed: {
            input: completion.usage?.prompt_tokens || 0,
            output: completion.usage?.completion_tokens || 0,
          },
        };
        
      } catch (error: any) {
        lastError = error;
        
        const isNetworkError = 
          error.code === 'EAI_AGAIN' ||
          error.code === 'ENOTFOUND' ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ECONNRESET' ||
          error.message?.includes('Connection error') ||
          error.message?.includes('network');
        
        if (!isNetworkError || attempt === maxRetries) {
          throw error;
        }
        
        const delayMs = 1000 * Math.pow(2, attempt - 1);
        console.log(`⚠️ [${this.config.id}] Network error on attempt ${attempt}/${maxRetries}. Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    throw lastError;
  }

  /**
   * Call Google Gemini API
   */
  private async callGoogle(userPrompt: string): Promise<{
    response: string;
    tokensUsed: { input: number; output: number };
  }> {
    const client = getGoogleClient();
    const model = client.getGenerativeModel({ model: this.config.model });

    const fullPrompt = `${this.systemPrompt}\n\n${userPrompt}`;
    const result = await model.generateContent(fullPrompt);
    const response = result.response.text();

    // Google doesn't provide token counts, estimate
    const estimatedInputTokens = Math.ceil(fullPrompt.length / 4);
    const estimatedOutputTokens = Math.ceil(response.length / 4);

    return {
      response,
      tokensUsed: {
        input: estimatedInputTokens,
        output: estimatedOutputTokens,
      },
    };
  }

  /**
   * Parse JSON response with multiple strategies and detailed error logging
   */
  protected parseResponse(response: string): any {
    const originalResponse = response; // Save for error logging

    try {
      // Strategy 1: Clean up markdown fences
      let cleaned = response.trim();

      // Remove ```json and ``` if present
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
      }

      // Strategy 2: Try to find JSON object in the response
      // Look for first { and last }
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');

      if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      }

      // Attempt to parse
      const parsed = JSON.parse(cleaned);
      
      console.log(`✅ [${this.config.id}] Successfully parsed JSON`);
      return parsed;

    } catch (error) {
      // Detailed error logging
      console.error(`\n❌ [${this.config.id}] JSON Parsing Failed!`);
      console.error(`\n📄 Original Response (full):`);
      console.error(originalResponse);
      console.error(`\n🔍 Response Length: ${originalResponse.length} characters`);
      console.error(`\n⚠️ Parse Error:`, error);
      console.error(`\n💡 First 200 chars: ${originalResponse.substring(0, 200)}`);
      console.error(`\n💡 Last 200 chars: ${originalResponse.substring(Math.max(0, originalResponse.length - 200))}`);
      
      // Check for common issues
      if (!originalResponse.includes('{')) {
        console.error(`\n🚨 Response does not contain any '{' character - not JSON!`);
      }
      if (originalResponse.includes('I\'m sorry') || originalResponse.includes('I cannot')) {
        console.error(`\n🚨 LLM appears to have refused the request!`);
      }

      throw new Error(`Invalid JSON response from ${this.config.id}: ${error}\nSee console for full response.`);
    }
  }

  /**
   * Calculate cost for this agent call
   */
  calculateCost(tokensUsed: { input: number; output: number }): number {
    const costCalc = calculateCost(
      this.config.model,
      tokensUsed.input,
      tokensUsed.output
    );
    return costCalc.totalCost;
  }

  /**
   * Log agent activity (for debugging)
   */
  protected log(message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${this.config.id}] ${message}`, data || '');
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

/**
 * Retry wrapper with exponential backoff
 */
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

      // Don't retry on certain errors
      if (
        error instanceof Error &&
        (error.message.includes('Invalid API key') ||
          error.message.includes('not found'))
      ) {
        throw error;
      }

      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}
