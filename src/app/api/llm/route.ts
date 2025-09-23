import { NextRequest, NextResponse } from 'next/server';
import { 
  LLMRequest
} from '@/types/domain';
import { authenticateAppRouterRequest } from '../_auth';
import { 
  createErrorResponse, 
  parseJsonBody,
  handleCORS 
} from '../_utils';

export const runtime = 'nodejs';

export async function OPTIONS() {
  return handleCORS();
}

export async function POST(request: NextRequest) {
  console.log(`[API] POST /api/llm`);

  try {
    // Authenticate user
    const { user } = await authenticateAppRouterRequest(request);
    if (!user) {
      return createErrorResponse(401, 'Authentication required', 'unauthenticated');
    }

    // Parse and validate request body
    let body: LLMRequest;
    try {
      body = await parseJsonBody(request);
    } catch {
      return createErrorResponse(400, 'Invalid JSON in request body', 'invalid_json');
    }
    
    if (!body.prompt) {
      return createErrorResponse(400, 'Missing required field: prompt', 'missing_prompt');
    }

    console.log(`[API] Processing LLM request from user ${user.id}`);

    // Validate GitHub token
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      console.error('[API] GitHub token not configured');
      return createErrorResponse(500, 'LLM service not configured', 'service_not_configured');
    }

    try {
      // Call GitHub Models API with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch('https://models.inference.ai.azure.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${githubToken}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are a helpful AI assistant that helps with brainstorming and expanding ideas. Provide concise, creative, and actionable suggestions.'
            },
            {
              role: 'user',
              content: body.prompt
            }
          ],
          model: 'gpt-4o-mini',
          temperature: 0.7,
          max_tokens: 1000,
          top_p: 1
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[API] GitHub Models API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        
        if (response.status === 401) {
          return createErrorResponse(500, 'LLM service authentication failed', 'llm_auth_failed');
        } else if (response.status === 429) {
          return createErrorResponse(429, 'LLM service rate limit exceeded', 'llm_rate_limit');
        } else {
          return createErrorResponse(500, 'LLM service error', 'llm_service_error');
        }
      }

      const data = await response.json();
      
      if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        console.error('[API] Invalid response from GitHub Models API:', data);
        return createErrorResponse(500, 'Invalid response from LLM service', 'llm_invalid_response');
      }

      const content = data.choices[0]?.message?.content;
      if (!content) {
        console.error('[API] No content in LLM response:', data);
        return createErrorResponse(500, 'Empty response from LLM service', 'llm_empty_response');
      }

      // Return response directly with both keys for compatibility
      const llmResponse = {
        content: content.trim(),
        response: content.trim() // Compatibility key
      };

      console.log(`[API] LLM request completed successfully`, {
        promptLength: body.prompt.length,
        responseLength: llmResponse.content.length,
        tokens: data.usage?.total_tokens || 0
      });

      // Return directly as JSON, not wrapped in {data: ...}
      return new NextResponse(JSON.stringify(llmResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (fetchError: unknown) {
      console.error('[API] GitHub Models API fetch error:', fetchError);
      
      // Handle timeout specifically
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return createErrorResponse(504, 'AI request timed out after 30 seconds. Please try again.', 'llm_timeout');
      }
      
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Network error';
      return createErrorResponse(500, `Failed to connect to LLM service: ${errorMessage}`, 'llm_network_error');
    }

  } catch (error: unknown) {
    console.error('[API] llm POST error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return createErrorResponse(500, errorMessage, 'server_error');
  }
}