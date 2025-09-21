/**
 * Production-ready LLM API using GitHub Models (Azure REST client)
 * 
 * Environment Variables:
 * - GITHUB_TOKEN (required): GitHub Models access token
 * - GITHUB_MODELS_ENDPOINT (optional): Default https://models.github.ai/inference
 * - GITHUB_MODELS_MODEL (optional): Default openai/gpt-5
 * 
 * Request: POST { prompt: string, system?: string, max_completion_tokens?: number, max_tokens?: number, temperature?: number }
 * Response: { content: string } | { error: string, code?: string }
 * 
 * Note: Parameters use model defaults if not provided. GitHub Models may restrict certain parameter values.
 * Uses dynamic imports to avoid build-time resolution issues on Vercel
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { LLMResponse, ErrorResponse, isLLMRequest } from '@/types/api';

// Retry helper with exponential backoff
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default async function handler(
  req: NextApiRequest, 
  res: NextApiResponse<LLMResponse | ErrorResponse>
) {
  // Method validation
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed', code: 'method_not_allowed' });
  }

  try {
    // Environment variable validation
    const token = process.env.GITHUB_TOKEN;
    const endpoint = process.env.GITHUB_MODELS_ENDPOINT || 'https://models.github.ai/inference';
    const model = process.env.GITHUB_MODELS_MODEL || 'gpt-4o-mini'; // Use faster, more reliable model

    if (!token) {
      console.log('Missing GITHUB_TOKEN environment variable');
      return res.status(500).json({ 
        error: 'Missing GITHUB_TOKEN environment variable. Set it in Vercel dashboard under Settings > Environment Variables.',
        code: 'missing_env_var'
      });
    }

    // Log configuration (anonymized)
    console.log('LLM API called:', {
      method: req.method,
      model,
      endpoint,
      hasToken: !!token,
      tokenLength: token ? `${token.length} chars` : 'none'
    });

    // Request validation
    if (!isLLMRequest(req.body)) {
      return res.status(400).json({ 
        error: 'Invalid request body. prompt is required and must be a non-empty string',
        code: 'invalid_input'
      });
    }

    const { prompt, system, max_tokens, max_completion_tokens, temperature } = req.body;

    // Support both max_tokens (legacy) and max_completion_tokens (GitHub Models standard)
    const maxTokens = max_completion_tokens || max_tokens;

    // Dynamic imports to avoid build-time issues
    const [{ default: ModelClient, isUnexpected }, { AzureKeyCredential }] = await Promise.all([
      import('@azure-rest/ai-inference'),
      import('@azure/core-auth')
    ]);

    // Create client at runtime
    const client = ModelClient(endpoint, new AzureKeyCredential(token));

    // Prepare messages
    const messages: Array<{ role: string; content: string }> = [];
    
    if (system) {
      messages.push({ role: 'system', content: system });
    }
    
    messages.push({ role: 'user', content: prompt });

    // Request parameters - only include provided values to use model defaults
    const requestBody = {
      messages,
      model,
      max_completion_tokens: maxTokens || 500, // Default to 500 tokens for faster responses
      ...(temperature !== undefined && { temperature })
    };

    // Main request with single retry for transient errors
    let lastError: unknown = null;
    
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // Set a reasonable timeout for the entire operation
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000);
        });
        
        const apiCall = async () => {
          const response = await client.path("/chat/completions").post({
            body: requestBody
          });
          return response;
        };
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await Promise.race([apiCall(), timeoutPromise]) as any;

        if (isUnexpected(response)) {
          const status = parseInt(response.status as string, 10);
          const errorMessage = response.body?.error?.message || 'Unknown error';
          
          console.log(`GitHub Models API error (attempt ${attempt + 1}):`, {
            status,
            hasError: !!response.body?.error,
            errorCode: response.body?.error?.code || 'unknown'
          });

          // Check if this is a retryable error
          if (status === 429 && attempt === 0) {
            // Rate limited - retry once
            const backoffMs = 500 + Math.random() * 1000; // 500-1500ms jitter
            console.log(`Rate limited, retrying after ${backoffMs}ms`);
            await sleep(backoffMs);
            continue;
          } else if ((status >= 500 && status < 600) && attempt === 0) {
            // Server error - retry once
            const backoffMs = 500 + Math.random() * 1000;
            console.log(`Server error ${status}, retrying after ${backoffMs}ms`);
            await sleep(backoffMs);
            continue;
          }

          // Map specific error codes
          if (status === 401 || status === 403) {
            return res.status(status).json({
              error: 'Authentication failed. Check your GITHUB_TOKEN permissions.',
              code: 'auth_error'
            });
          } else if (status === 429) {
            return res.status(429).json({
              error: 'Rate limit exceeded. Please retry after a few seconds.',
              code: 'rate_limited'
            });
          } else if (status >= 500 && status < 600) {
            return res.status(502).json({
              error: 'GitHub Models service is temporarily unavailable.',
              code: 'model_unavailable'
            });
          } else {
            return res.status(502).json({
              error: `Model request failed: ${errorMessage}`,
              code: 'model_error'
            });
          }
        }

        // Success - extract content
        const content = response.body.choices?.[0]?.message?.content;
        
        if (!content || content.trim().length === 0) {
          return res.status(502).json({
            error: 'Empty model response. The model did not generate any content.',
            code: 'empty_response'
          });
        }

        return res.status(200).json({ content: content.trim() });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        lastError = error;
        console.log(`Request error (attempt ${attempt + 1}):`, {
          message: error.message,
          name: error.name,
          isRetryable: attempt === 0
        });

        // Retry on network/connection errors and timeouts
        if (attempt === 0 && (
          error.code === 'ECONNRESET' ||
          error.code === 'ETIMEDOUT' ||
          error.message?.toLowerCase().includes('network') ||
          error.message?.toLowerCase().includes('timeout')
        )) {
          const backoffMs = 500 + Math.random() * 1000;
          await sleep(backoffMs);
          continue;
        }

        // Don't retry other errors
        break;
      }
    }

    // All retries exhausted
    console.error('All retry attempts failed:', {
      finalError: lastError instanceof Error ? lastError.message : 'Unknown error'
    });

    // Check if the final error was a timeout
    if (lastError instanceof Error && lastError.message.includes('timeout')) {
      return res.status(504).json({
        error: 'Request timed out. The AI model took too long to respond.',
        code: 'timeout'
      });
    }

    return res.status(500).json({
      error: 'Failed to connect to GitHub Models after retries.',
      code: 'connection_failed'
    });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Unexpected error in LLM API:', {
      message: error.message,
      name: error.name
    });

    return res.status(500).json({
      error: 'Internal server error.',
      code: 'server_error'
    });
  }
}
