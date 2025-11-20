import type { AgentRequest, AgentResponse, AgentContext } from '@agentuity/sdk';
import { AGENT_NAME } from './constants';
import { buildDiscordPayload, sendToDiscord } from './discord';
import { runModel } from './llm';
import {
  addMemoryRecord,
  getMemory,
  getRecentMemories,
  rememberUser,
} from './memory';
import { summarizeLink } from './summaries';
import { buildThreadFromTweet } from './tweets';
import {
  deriveMessageText,
  extractUrls,
  isTweetUrl,
  safeJson,
  serverOrDefault,
} from './utils';
import { extractKnowledge, formatKnowledge } from './knowledge';
import { truncateContent } from './text';
export { welcome } from './welcome';

export default async function Agent(
  req: AgentRequest,
  resp: AgentResponse,
  ctx: AgentContext
) {
  try {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

    if (!webhookUrl) {
      return resp.text('Please set DISCORD_WEBHOOK_URL in your .env file');
    }

    const rawBody = await req.data.text();
    const isJson = req.data.contentType?.includes('json');
    const parsedBody = isJson ? await safeJson(rawBody, ctx) : undefined;
    const messageText = deriveMessageText(parsedBody, rawBody);

    const metaString = (value: unknown, fallback: string) =>
      typeof value === 'string' && value.length > 0 ? value : fallback;
    const metaStringOptional = (value: unknown) =>
      typeof value === 'string' && value.length > 0 ? value : undefined;

    const userId = metaString(
      req.get('userId', (parsedBody as { author?: { id?: string } })?.author?.id),
      'anonymous'
    );
    const userName = metaString(
      req.get(
        'userName',
        (parsedBody as { author?: { username?: string; name?: string } })?.author?.username ??
          (parsedBody as { author?: { name?: string } })?.author?.name
      ),
      'friend'
    );
    const serverId = metaString(
      req.get('serverId', (parsedBody as { server?: { id?: string } })?.server?.id),
      'global'
    );
    const serverName = metaString(
      req.get('serverName', (parsedBody as { server?: { name?: string } })?.server?.name),
      'the server'
    );
    const threadId = metaStringOptional(
      req.get('threadId', (parsedBody as { thread_id?: string })?.thread_id)
    );
    const threadName = metaStringOptional(
      req.get('threadName', (parsedBody as { thread_name?: string })?.thread_name)
    );

    const previousMemory = await getMemory(ctx, serverId, userId);
    await rememberUser(ctx, serverId, userId, userName, messageText, previousMemory);

    const urls = extractUrls(messageText);
    const tweetUrls = urls.filter(isTweetUrl);
    const otherUrls = urls.filter((url) => !isTweetUrl(url));

    const linkSummaries: string[] = [];
    for (const url of otherUrls) {
      linkSummaries.push(await summarizeLink(url, ctx, serverName));
    }

    const tweetThreads: { url: string; thread: string }[] = [];
    for (const url of tweetUrls) {
      tweetThreads.push(await buildThreadFromTweet(url, ctx, serverName, userName));
    }

    const knowledgeTriples = await extractKnowledge(messageText, ctx);
    await addMemoryRecord(ctx, {
      id: `${Date.now()}`,
      serverId,
      userId,
      userName,
      message: truncateContent(messageText),
      knowledge: knowledgeTriples,
      createdAtIso: new Date().toISOString(),
    });
    const recentKnowledge = await getRecentMemories(ctx, serverId, { userId, limit: 5 });
    const knowledgeContext = recentKnowledge
      .flatMap((rec) => rec.knowledge ?? [])
      .slice(-5);

    const conversationContext =
      previousMemory?.lastMessage && previousMemory.lastMessage !== messageText
        ? `Last time you said: "${previousMemory.lastMessage}". `
        : '';

    const generalResponse =
      urls.length === 0
        ? await runModel(
            `You are ${AGENT_NAME}, a kind and fun multiuser assistant on a Discord server named "${serverOrDefault(
              serverName
            )}". ` +
              `User "${userName}" sent: "${messageText}". ${conversationContext}` +
              `Respond concisely with awareness of the server context and invite follow-ups if helpful.` +
              (knowledgeContext.length > 0
                ? ` Known recent facts: ${formatKnowledge(knowledgeContext)}`
                : '')
          )
        : '';

    const sections: string[] = [];
    sections.push(
      `Hi ${userName}! Here is what I found for ${serverOrDefault(serverName)} (I remember you were here before).`
    );

    if (linkSummaries.length > 0) {
      sections.push(`Link summaries:\n${linkSummaries.join('\n')}`);
    }

    if (tweetThreads.length > 0) {
      const threadText = tweetThreads
        .map((entry) => `From ${entry.url} (via xcancel):\n${entry.thread}`)
        .join('\n\n');
      sections.push(`Thread drafts:\n${threadText}`);
    }

    if (generalResponse) {
      sections.push(generalResponse);
    }

    if (knowledgeTriples.length > 0) {
      sections.push(`Noted knowledge:\n${formatKnowledge(knowledgeTriples)}`);
    } else if (knowledgeContext.length > 0) {
      sections.push(`Recent knowledge I remember:\n${formatKnowledge(knowledgeContext)}`);
    }

    if (sections.length === 1) {
      sections.push('No links detected, but I am ready to help with summaries or questions.');
    }

    const discordPayload = buildDiscordPayload(
      sections,
      linkSummaries,
      tweetThreads,
      generalResponse
    );
    await sendToDiscord(webhookUrl, discordPayload, ctx, threadId, threadName);

    return resp.text(sections.join('\n\n'));
  } catch (error) {
    ctx.logger.error('Error running agent:', error);

    return resp.text('Sorry, there was an error processing your request.');
  }
}
