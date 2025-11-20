import type { AgentContext } from '@agentuity/sdk';
import type { KnowledgeTriple } from './knowledge';
import { truncateContent } from './text';

const PEOPLE_STORE = 'vera:people';
const KNOWLEDGE_STORE = 'vera:memories';
const MAX_MEMORY_RECORDS = 50;

export type PersonMemory = {
  userId: string;
  userName?: string;
  serverId: string;
  lastSeenIso: string;
  lastMessage?: string;
  notes?: string;
};

export type MemoryRecord = {
  id: string;
  serverId: string;
  userId: string;
  userName?: string;
  message: string;
  knowledge?: KnowledgeTriple[];
  createdAtIso: string;
};

async function getJson<T>(ctx: AgentContext, store: string, key: string): Promise<T | undefined> {
  try {
    const result = await ctx.kv.get(store, key);

    if (!result.exists) {
      return undefined;
    }

    return await result.data.object<T>();
  } catch (error) {
    ctx.logger.warn('Unable to read %s/%s: %o', store, key, error);

    return undefined;
  }
}

export async function getMemory(
  ctx: AgentContext,
  serverId: string,
  userId: string
): Promise<PersonMemory | undefined> {
  return getJson<PersonMemory>(ctx, PEOPLE_STORE, `${serverId}:${userId}`);
}

export async function rememberUser(
  ctx: AgentContext,
  serverId: string,
  userId: string,
  userName: string,
  lastMessage: string,
  previous?: PersonMemory
): Promise<PersonMemory> {
  const nowIso = new Date().toISOString();
  const record: PersonMemory = {
    userId,
    userName,
    serverId,
    lastSeenIso: nowIso,
    lastMessage: truncateContent(lastMessage ?? '').slice(0, 500),
    notes: previous?.notes,
  };

  try {
    await ctx.kv.set(PEOPLE_STORE, `${serverId}:${userId}`, record);
  } catch (error) {
    ctx.logger.warn('Unable to persist memory: %o', error);
  }

  return record;
}

export async function addMemoryRecord(ctx: AgentContext, record: MemoryRecord): Promise<void> {
  const key = `${record.serverId}:recent`;
  const existing = (await getJson<MemoryRecord[]>(ctx, KNOWLEDGE_STORE, key)) ?? [];
  const next = [...existing, record].slice(-MAX_MEMORY_RECORDS);

  try {
    await ctx.kv.set(KNOWLEDGE_STORE, key, next);
  } catch (error) {
    ctx.logger.warn('Unable to persist knowledge memory: %o', error);
  }
}

export async function getRecentMemories(
  ctx: AgentContext,
  serverId: string,
  { userId, limit = 5 }: { userId?: string; limit?: number } = {}
): Promise<MemoryRecord[]> {
  const key = `${serverId}:recent`;
  const records = (await getJson<MemoryRecord[]>(ctx, KNOWLEDGE_STORE, key)) ?? [];
  const filtered = userId ? records.filter((r) => r.userId === userId) : records;

  return filtered.slice(-limit);
}
