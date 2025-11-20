import { GoogleGenAI } from '@google/genai';
import { MODEL_NAME } from './constants';

if (!process.env.GOOGLE_API_KEY) {
  console.error('Missing the GOOGLE_API_KEY environment variable');

  process.exit(1);
}

const client = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

export async function runModel(prompt: string) {
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
