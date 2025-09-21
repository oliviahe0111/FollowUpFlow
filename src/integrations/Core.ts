// LLM Integration - connects to your /api/llm endpoint
export async function InvokeLLM(params: { 
  prompt: string; 
  add_context_from_internet?: boolean 
}) {
  try {
    // Add timeout to frontend request as well
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Frontend timeout: AI request took longer than 45 seconds')), 45000);
    });

    const apiCall = fetch('/api/llm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: params.prompt,
      }),
    });

    const response = await Promise.race([apiCall, timeoutPromise]) as Response;

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM API Error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.content;
  } catch (error) {
    console.error('Error invoking LLM:', error);
    throw error;
  }
}