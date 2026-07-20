import { GoogleGenerativeAI } from '@google/generative-ai';

let client: GoogleGenerativeAI | null = null;

const getClient = (): GoogleGenerativeAI => {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not defined in the environment variables.');
    client = new GoogleGenerativeAI(apiKey);
  }
  return client;
};

const MODEL_NAME = 'gemini-2.0-flash';

/**
 * Streams a chat response chunk by chunk. `onChunk` is called for each text
 * chunk as it arrives from Gemini, so the caller can forward it over SSE.
 */
export const streamChatResponse = async (
  systemPrompt: string,
  history: { role: 'user' | 'model'; parts: { text: string }[] }[],
  userMessage: string,
  onChunk: (text: string) => void
): Promise<string> => {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({ model: MODEL_NAME, systemInstruction: systemPrompt });

  const chat = model.startChat({ history });
  const result = await chat.sendMessageStream(userMessage);

  let fullText = '';
  for await (const chunk of result.stream) {
    const chunkText = chunk.text();
    fullText += chunkText;
    onChunk(chunkText);
  }
  return fullText;
};

/**
 * Sends a prompt and expects a strict JSON response back. Strips markdown
 * code fences defensively in case the model wraps the JSON in ```json blocks.
 */
export const generateJSON = async <T>(prompt: string): Promise<T> => {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: { responseMimeType: 'application/json' },
  });

  const result = await model.generateContent(prompt);
  const raw = result.response.text();
  const cleaned = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned) as T;
};

/**
 * Sends a plain-text generation prompt (e.g. for job description generation).
 */
export const generateText = async (prompt: string): Promise<string> => {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });
  const result = await model.generateContent(prompt);
  return result.response.text();
};
