const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export interface GroqCommandResponse {
  action: string;
  payload?: {
    path?: string;
    appName?: string;
    mediaPath?: string;
  };
}

export async function parseCommandWithGroq(userText: string): Promise<GroqCommandResponse> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  if (!apiKey) {
    throw new Error('Missing GROQ API key. Set VITE_GROQ_API_KEY in your environment.');
  }

  const systemPrompt = `
You are a desktop command parser for a Windows user.
Convert the user's natural language instruction into a STRICT JSON object describing ONE action.

Allowed actions:
- "open_folder"
- "open_file"
- "launch_app"
- "play_media"

Rules:
- ALWAYS respond with ONLY valid JSON. No explanations, no markdown.
- The JSON MUST have this exact shape:
  {
    "action": "open_folder" | "open_file" | "launch_app" | "play_media",
    "payload": {
      "path"?: "string",
      "appName"?: "string",
      "mediaPath"?: "string"
    }
  }
- Use absolute or user-meaningful paths when possible (e.g. "C:/Users/USERNAME/Documents").
- If the request is unclear or unsupported, choose the closest allowed action and leave unknown fields undefined.
`.trim();

  const userPrompt = `
User command:
${userText}

Respond with JSON only.
`.trim();

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GROQ API error: ${response.status} ${text}`);
  }

  const json = await response.json();
  const content: string | undefined = json.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('GROQ API returned empty content.');
  }

  try {
    const parsed = JSON.parse(content) as GroqCommandResponse;
    return parsed;
  } catch (err) {
    throw new Error('Failed to parse GROQ JSON response.');
  }
}

