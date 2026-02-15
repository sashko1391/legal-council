/**
 * SSE (Server-Sent Events) Helpers
 * 
 * Shared utilities for streaming agent progress to the frontend.
 * Used by both review and generate API routes.
 * 
 * Protocol:
 *   event: agent_start | agent_complete | agent_error | rag_start | rag_complete | result | error | done
 *   data: JSON payload
 */

// ==========================================
// TYPES
// ==========================================

export type ProgressEventType =
  | 'agent_start'
  | 'agent_complete'
  | 'agent_error'
  | 'rag_start'
  | 'rag_complete'
  | 'gate_check'
  | 'result'
  | 'error'
  | 'done';

export interface ProgressEvent {
  type: ProgressEventType;
  agent?: string;
  message?: string;
  durationMs?: number;
  data?: any;
}

export type ProgressCallback = (event: ProgressEvent) => void;

// ==========================================
// SSE ENCODER
// ==========================================

/**
 * Encode a single SSE event as a UTF-8 string.
 * Format: `event: <type>\ndata: <json>\n\n`
 */
export function encodeSSEEvent(event: ProgressEvent): string {
  const eventType = event.type;
  const payload = JSON.stringify(event);
  return `event: ${eventType}\ndata: ${payload}\n\n`;
}

/**
 * Create a ReadableStream that can be used as an SSE response.
 * The `execute` function receives a `send` callback to emit events
 * and a `progress` callback to pass to orchestrators.
 */
export function createSSEStream(
  execute: (
    send: (event: ProgressEvent) => void,
    progress: ProgressCallback
  ) => Promise<void>
): ReadableStream {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const send = (event: ProgressEvent) => {
        try {
          const encoded = encoder.encode(encodeSSEEvent(event));
          controller.enqueue(encoded);
        } catch {
          // Controller may be closed if client disconnected
        }
      };

      // The progress callback simply forwards to send
      const progress: ProgressCallback = (event) => send(event);

      try {
        await execute(send, progress);
      } catch (error) {
        send({
          type: 'error',
          message: error instanceof Error ? error.message : 'Невідома помилка',
        });
      } finally {
        // Always close with done event
        send({ type: 'done' });
        try {
          controller.close();
        } catch {
          // Already closed
        }
      }
    },
  });
}

/**
 * Create an SSE Response with proper headers.
 */
export function createSSEResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
