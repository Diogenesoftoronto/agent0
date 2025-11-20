import type { AgentContext } from '@agentuity/sdk';
import { DEFAULT_XCANCEL_BASE } from './constants';

const URL_REGEX = /https?:\/\/[^\s<>()[\]{}"']+/gi;

export function extractUrls(text: string): string[] {
  return Array.from(new Set(text.match(URL_REGEX) ?? []));
}

export function isTweetUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');

    return host === 'x.com' || host === 'twitter.com';
  } catch {
    return false;
  }
}

export function toXcancelUrl(tweetUrl: string): string | null {
  try {
    const parsed = new URL(tweetUrl);

    const base = (process.env.XCANCEL_BASE_URL ?? DEFAULT_XCANCEL_BASE).replace(/\/$/, '');

    return `${base}${parsed.pathname}`;
  } catch {
    return null;
  }
}

export function deriveMessageText(payload: unknown, rawBody: string): string {
  if (typeof payload === 'string') {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const maybeContent =
      (payload as { content?: string }).content ??
      (payload as { text?: string }).text ??
      (payload as { message?: string }).message ??
      (payload as { data?: { content?: string } }).data?.content ??
      (payload as { body?: string }).body;

    if (typeof maybeContent === 'string' && maybeContent.length > 0) {
      return maybeContent;
    }
  }

  return rawBody;
}

export async function safeJson(rawBody: string, ctx: AgentContext) {
  try {
    return JSON.parse(rawBody);
  } catch (error) {
    ctx.logger.warn('Failed to parse JSON body: %o', error);

    return undefined;
  }
}

export function serverOrDefault(serverName?: string): string {
  if (!serverName || serverName.trim().length === 0) {
    return 'this server';
  }

  return serverName;
}
