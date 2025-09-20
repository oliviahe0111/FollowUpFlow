import type { NextApiRequest, NextApiResponse } from 'next';
import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).end();
    }

    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'prompt required' });
    }

    const token = process.env.GITHUB_TOKEN;

    // No token? Return a friendly stub so your app works during setup.
    if (!token) {
      const stub =
        'Here is a quick response based on your context:\\n\\n' +
        '• Key ideas that extend your thread\\n' +
        '• Practical next steps\\n' +
        '• Trade-offs to consider\\n\\n' +
        '_(Add GITHUB_TOKEN to .env for real model output.)_';
      return res.status(200).json({ text: stub });
    }

    const endpoint = "https://models.github.ai/inference";
    const model = "openai/gpt-4o";

    const client = ModelClient(
      endpoint,
      new AzureKeyCredential(token),
    );

    const response = await client.path("/chat/completions").post({
      body: {
        messages: [
          { role: 'system', content: 'Be concise, actionable, and structure with short paragraphs.' },
          { role: 'user', content: prompt }
        ],
        model: model,
        temperature: 0.5,
      }
    });

    if (isUnexpected(response)) {
      console.error('GitHub Models API error:', response.body.error);
      if (response.body.error?.message?.toLowerCase().includes('rate')) {
        return res.status(429).json({ error: 'Rate limit' });
      }
      return res.status(500).json({ error: 'AI service error' });
    }

    const text = response.body.choices?.[0]?.message?.content ?? 'No response.';
    return res.status(200).json({ text });
  } catch (e: any) {
    console.error('llm api error:', e);
    if (String(e?.message || '').toLowerCase().includes('rate')) {
      return res.status(429).json({ error: 'Rate limit' });
    }
    return res.status(500).json({ error: 'server_error' });
  }
}
