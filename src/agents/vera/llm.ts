import { GoogleGenAI } from '@google/genai';
import { MODEL_NAME } from './constants';

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error('Missing the GOOGLE_API_KEY environment variable');
  }

  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
  }

  return client;
}

export async function runModel(prompt: string) {
  const client = getClient();
  const result = await client.models.generateContent({
    model: MODEL_NAME,
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    config: {
      maxOutputTokens: 512,
      temperature: 0.8,
      topP: 0.9,
    },
  });

  const finish = result.candidates?.[0]?.finishReason;
  if (finish && finish !== 'STOP') {
    return `I could not craft a response (finish reason: ${finish}).`;
  }

  return result.text ?? 'I could not craft a response just now.';
}
