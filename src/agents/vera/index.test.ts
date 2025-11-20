import { describe, expect, test } from 'bun:test';
import { buildDiscordPayload, buildWebhookUrl } from './discord';
import { addMemoryRecord, getRecentMemories } from './memory';
import type { KnowledgeTriple } from './knowledge';
import { DISCORD_EMBED_LIMIT } from './constants';
import { deriveMessageText, extractUrls, isTweetUrl, toXcancelUrl } from './utils';
import { extractKnowledge } from './knowledge';
import { mock } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('vera helpers', () => {
  test('extractUrls finds unique urls', () => {
    const input =
      'check https://example.com and also https://x.com/foo/status/1 plus https://example.com again';
    const urls = extractUrls(input);

    expect(urls).toEqual([
      'https://example.com',
      'https://x.com/foo/status/1',
    ]);
  });

  test('isTweetUrl detects twitter/x domains', () => {
    expect(isTweetUrl('https://x.com/foo/status/123')).toBe(true);
    expect(isTweetUrl('https://twitter.com/foo/status/456')).toBe(true);
    expect(isTweetUrl('https://example.com/post')).toBe(false);
  });

  test('toXcancelUrl rewrites to configured base', async () => {
    process.env.XCANCEL_BASE_URL = 'https://stub.xcancel.test';
    const rewritten = toXcancelUrl('https://x.com/foo/status/123');

    expect(rewritten).toBe('https://stub.xcancel.test/foo/status/123');
  });

  test('deriveMessageText prefers content field over raw body', () => {
    const content = deriveMessageText({ content: 'hello world' }, 'raw');

    expect(content).toBe('hello world');
  });

  test('buildDiscordPayload truncates long embeds', () => {
    const long = 'a'.repeat(DISCORD_EMBED_LIMIT + 50);
    const payload = buildDiscordPayload(
      ['intro'],
      [long],
      [{ url: 'https://x.com/a', thread: long }],
      long
    );

    const descriptions = payload.embeds.map((embed) => embed.description.length);
    for (const len of descriptions) {
      expect(len).toBeLessThanOrEqual(DISCORD_EMBED_LIMIT);
    }
  });

  test('buildWebhookUrl appends thread_id', () => {
    const url = buildWebhookUrl('https://discord.com/api/webhooks/1/abc', '123');

    expect(url).toBe('https://discord.com/api/webhooks/1/abc?thread_id=123');
  });

  test('addMemoryRecord stores and filters by user', async () => {
    const kvStore = new Map<string, unknown>();
    const ctx = createMockContext(kvStore);
    const knowledge: KnowledgeTriple[] = [{ subject: 'alice', predicate: 'likes', object: 'rust' }];
    await addMemoryRecord(ctx, {
      id: '1',
      serverId: 's1',
      userId: 'u1',
      userName: 'alice',
      message: 'hello world',
      knowledge,
      createdAtIso: new Date().toISOString(),
    });

    const records = await getRecentMemories(ctx, 's1', { userId: 'u1', limit: 5 });
    expect(records).toHaveLength(1);
    expect(records[0]?.knowledge?.[0]?.predicate).toBe('likes');
  });

  test('extractKnowledge uses langextract results when available', async () => {
    const fixture = JSON.parse(
      readFileSync(join(__dirname, '__fixtures__', 'samsum-sample.json'), 'utf8')
    ) as { dialogue: string };

    mock.module('langextract', () => ({
      async extract(text: string) {
        expect(text).toContain('Megan');
        return {
          extractions: [
            {
              extractionText: 'Megan will bring coffee later',
              attributes: {
                subject: 'Megan',
                predicate: 'plans to bring',
                object: 'coffee',
              },
            },
          ],
        };
      },
    }));

    const triples = await extractKnowledge(fixture.dialogue, createMockContext(new Map()));
    expect(triples[0]?.predicate).toBe('plans to bring');
    mock.restore();
  });
});

function createMockContext(store: Map<string, unknown>) {
  return {
    kv: {
      async get(name: string, key: string) {
        const composite = `${name}:${key}`;
        if (!store.has(composite)) {
          return { exists: false, data: undefined as never };
        }
        const value = store.get(composite);
        return {
          exists: true,
          data: {
            async object<T>() {
              return value as T;
            },
          },
        };
      },
      async set(name: string, key: string, value: unknown) {
        store.set(`${name}:${key}`, value);
      },
      async delete(name: string, key: string) {
        store.delete(`${name}:${key}`);
      },
    },
    logger: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  } as unknown as import('@agentuity/sdk').AgentContext;
}
