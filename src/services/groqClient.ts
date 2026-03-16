const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export interface GroqCommandResponse {
  action: string;
  payload?: {
    path?: string;
    appName?: string;
    mediaPath?: string;
  };
}

interface CommandContext {
  lastCommandText?: string;
  lastResolvedPath?: string;
}

export async function parseCommandWithGroq(
  userText: string,
  context?: CommandContext,
): Promise<GroqCommandResponse> {
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
- "path" is for folders or generic files.
- "mediaPath" is specifically for audio/video/image files to play or open.
- If the user refers to a folder that is already known (e.g. "that folder"), reuse the previous folder path.
- If the user refers to "that file" / "that video" / "that image" from the last command, choose the most likely single file path based on the context you have (e.g. combine the last folder with the given file name).
- If the request describes multiple steps, choose the single MOST IMPORTANT action the agent should execute now.
- Use "C:/Users/USERNAME/..." as a placeholder for the user's home directory when needed.
- If the request is unclear or unsupported, choose the closest allowed action and leave unknown fields undefined.

Examples (do NOT include these in your response, they are just guidance):

User: "open my downloads folder"
→ {
  "action": "open_folder",
  "payload": { "path": "C:/Users/USERNAME/Downloads" }
}

User: "go to downloads folder and open the image in it"
→ {
  "action": "open_file",
  "payload": { "path": "C:/Users/USERNAME/Downloads" }
}

User: "play the video file cats.mp4 from my downloads"
→ {
  "action": "play_media",
  "payload": { "mediaPath": "C:/Users/USERNAME/Downloads/cats.mp4" }
}

User: "open vs code"
→ {
  "action": "launch_app",
  "payload": { "appName": "vscode" }
}
`.trim();

  const contextBlock =
    context && (context.lastCommandText || context.lastResolvedPath)
      ? `
Previous context (may be referenced as "that folder", "that file", etc.):
- last_command_text: ${context.lastCommandText ?? 'N/A'}
- last_resolved_path: ${context.lastResolvedPath ?? 'N/A'}
`.trim()
      : '';

  const userPrompt = `
User command:
${userText}

${contextBlock}

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

