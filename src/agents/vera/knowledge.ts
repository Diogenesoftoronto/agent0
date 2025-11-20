import type { AgentContext } from '@agentuity/sdk';
import { MODEL_NAME } from './constants';
import { runModel } from './llm';
import { truncateContent } from './text';

export type KnowledgeTriple = {
  subject: string;
  predicate: string;
  object: string;
  source?: string;
};

const MAX_TRIPLES = 5;

async function extractWithLangextract(
  text: string,
  ctx: AgentContext
): Promise<KnowledgeTriple[] | undefined> {
  try {
    // Dynamically import to keep it optional; users can add "langextract" to dependencies when ready.
    const langextract: typeof import('langextract') = await import('langextract');
    const result = await langextract.extract(text, {
      promptDescription: 'Extract subject, predicate, object triples that capture facts and opinions.',
      modelType: 'gemini',
      modelId: MODEL_NAME,
      apiKey: process.env.GOOGLE_API_KEY,
      temperature: 0.05,
      maxTokens: 256,
    });

    const docs = Array.isArray(result) ? result : [result];
    const triples: KnowledgeTriple[] = [];
    for (const doc of docs) {
      for (const extraction of doc.extractions ?? []) {
        const attributes = extraction.attributes ?? {};
        const predicate = attributes.predicate ?? attributes.relation ?? 'says';
        const object = attributes.object ?? attributes.target ?? extraction.extractionText;
        const subject = attributes.subject ?? extraction.extractionClass ?? 'someone';

        if (predicate && object) {
          triples.push({
            subject: String(subject),
            predicate: String(predicate),
            object: String(object),
            source: extraction.extractionText,
          });
        }
      }
    }

    if (triples.length > 0) {
      return triples.slice(0, MAX_TRIPLES);
    }
  } catch (error) {
    ctx.logger.debug('Langextract unavailable or failed, falling back to LLM extraction: %o', error);
  }

  return undefined;
}

async function extractWithLLM(text: string, ctx: AgentContext): Promise<KnowledgeTriple[]> {
  const prompt = `Extract up to ${MAX_TRIPLES} knowledge triples (subject, predicate, object) from the message below. ` +
    `Return strict JSON array, e.g., [{"subject":"Alice","predicate":"enjoys","object":"Rust"}]. ` +
    `Message:\n${truncateContent(text)}`;
  const raw = await runModel(prompt);

  try {
    const parsed = JSON.parse(raw) as Array<Record<string, string>>;
    return parsed
      .filter((item) => item.subject && item.predicate && item.object)
      .slice(0, MAX_TRIPLES)
      .map((item) => ({
        subject: String(item.subject),
        predicate: String(item.predicate),
        object: String(item.object),
      }));
  } catch (error) {
    ctx.logger.warn('Failed to parse LLM knowledge triples: %o (raw: %s)', error, raw);
    return [];
  }
}

export async function extractKnowledge(text: string, ctx: AgentContext): Promise<KnowledgeTriple[]> {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const libTriples = await extractWithLangextract(text, ctx);

  if (libTriples && libTriples.length > 0) {
    return libTriples.slice(0, MAX_TRIPLES);
  }

  return extractWithLLM(text, ctx);
}

export function formatKnowledge(triples: KnowledgeTriple[]): string {
  if (triples.length === 0) return '';

  return triples
    .slice(0, MAX_TRIPLES)
    .map((t) => `• ${t.subject} ${t.predicate} ${t.object}`)
    .join('\n');
}
