import Groq from 'groq-sdk';

let client: Groq | null = null;

const getClient = (): Groq => {
  if (!client) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY is not defined in the environment variables.');
    client = new Groq({ apiKey });
  }
  return client;
};

const CHAT_MODEL = 'llama-3.3-70b-versatile';

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Streams a chat response chunk by chunk. `onChunk` is called for each text
 * chunk as it arrives, so the caller can forward it over SSE.
 */
export const streamChatResponse = async (
  systemPrompt: string,
  history: ChatHistoryMessage[],
  userMessage: string,
  onChunk: (text: string) => void
): Promise<string> => {
  const groq = getClient();

  const stream = await groq.chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ],
    stream: true,
  });

  let fullText = '';
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || '';
    if (delta) {
      fullText += delta;
      onChunk(delta);
    }
  }
  return fullText;
};

/**
 * Sends a prompt and expects a strict JSON response back (array or object,
 * depending on the prompt). Strips markdown code fences defensively.
 */
export const generateJSON = async <T>(prompt: string): Promise<T> => {
  const groq = getClient();

  const completion = await groq.chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      {
        role: 'system',
        content: 'You respond with valid JSON only. No markdown code fences, no commentary, no explanation.',
      },
      { role: 'user', content: prompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content || '';
  const cleaned = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned) as T;
};

/**
 * Sends a plain-text generation prompt (e.g. for job description generation).
 */
export const generateText = async (prompt: string): Promise<string> => {
  const groq = getClient();

  const completion = await groq.chat.completions.create({
    model: CHAT_MODEL,
    messages: [{ role: 'user', content: prompt }],
  });

  return completion.choices[0]?.message?.content || '';
};
