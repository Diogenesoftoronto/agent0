import type { AgentContext } from '@agentuity/sdk';
import { DISCORD_EMBED_LIMIT } from './constants';
import { truncateContent } from './text';

export function buildDiscordPayload(
  sections: string[],
  linkSummaries: string[],
  tweetThreads: { url: string; thread: string }[],
  generalResponse: string
) {
  const embeds: Array<{
    title: string;
    description: string;
    color?: number;
  }> = [];

  if (linkSummaries.length > 0) {
    embeds.push({
      title: 'Link summaries',
      description: truncateContent(linkSummaries.join('\n')).slice(0, DISCORD_EMBED_LIMIT),
      color: 0x4caf50,
    });
  }

  if (tweetThreads.length > 0) {
    const threadsText = tweetThreads
      .map((entry) => `• ${entry.url}\n${entry.thread}`)
      .join('\n\n');
    embeds.push({
      title: 'Thread drafts',
      description: truncateContent(threadsText).slice(0, DISCORD_EMBED_LIMIT),
      color: 0x03a9f4,
    });
  }

  if (generalResponse) {
    embeds.push({
      title: 'Reply',
      description: truncateContent(generalResponse).slice(0, DISCORD_EMBED_LIMIT),
      color: 0x9c27b0,
    });
  }

  return {
    username: 'Vera',
    content: sections[0],
    embeds,
  };
}

export function buildWebhookUrl(base: string, threadId?: string) {
  if (!threadId) {
    return base;
  }

  const url = new URL(base);
  url.searchParams.set('thread_id', threadId);

  return url.toString();
}

export async function sendToDiscord(
  webhookUrl: string,
  payload: unknown,
  ctx: AgentContext,
  threadId?: string,
  threadName?: string
) {
  try {
    const targetUrl = buildWebhookUrl(webhookUrl, threadId);
    const body = threadName
      ? { ...(payload as Record<string, unknown>), thread_name: threadName }
      : payload;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      ctx.logger.error('Discord webhook error: %s', errorText);
    }
  } catch (error) {
    ctx.logger.error('Failed to send to Discord webhook: %o', error);
  }
}
