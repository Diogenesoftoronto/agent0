import type { AgentRequest, AgentResponse, AgentContext } from '@agentuity/sdk';
import { buildDiscordPayload, sendToDiscord } from './discord';
import { processVeraRequest } from './service';
import { formatKnowledge } from './knowledge';
import { deriveMessageText, safeJson } from './utils';
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

    // Use the shared service to process the request
    const {
      sections,
      linkSummaries,
      tweetThreads,
      generalResponse,
      knowledgeTriples,
      knowledgeContext,
    } =
      await processVeraRequest(ctx, {
        messageText,
        userId,
        userName,
        serverId,
        serverName,
        isMentioned: false, // Webhooks don't have mention logic by default
      });

    // Build webhook-specific response with additional formatting
    const webhookSections = [`Hi ${userName}! Here is what I found (I remember you were here before).`];

    if (linkSummaries.length > 0) {
      webhookSections.push(`Link summaries:\n${linkSummaries.join('\n')}`);
    }

    if (tweetThreads.length > 0) {
      const threadText = tweetThreads
        .map((entry) => `From ${entry.url} (via xcancel):\n${entry.thread}`)
        .join('\n\n');
      webhookSections.push(`Thread drafts:\n${threadText}`);
    }

    if (generalResponse) {
      webhookSections.push(generalResponse);
    }

    if (knowledgeTriples.length > 0) {
      webhookSections.push(`Noted knowledge:\n${formatKnowledge(knowledgeTriples)}`);
    } else if (knowledgeContext.length > 0) {
      webhookSections.push(`Recent knowledge I remember:\n${formatKnowledge(knowledgeContext)}`);
    }

    if (webhookSections.length === 1) {
      webhookSections.push('No links detected, but I am ready to help with summaries or questions.');
    }

    const discordPayload = buildDiscordPayload(
      webhookSections,
      linkSummaries,
      tweetThreads,
      generalResponse
    );
    await sendToDiscord(webhookUrl, discordPayload, ctx, threadId, threadName);

    return resp.text(webhookSections.join('\n\n'));
  } catch (error) {
    ctx.logger.error('Error running agent:', error);

    return resp.text('Sorry, there was an error processing your request.');
  }
}
