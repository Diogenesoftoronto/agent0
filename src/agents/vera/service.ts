import type { AgentContext } from '@agentuity/sdk';
import { AGENT_NAME } from './constants';
import { runModel } from './llm';
import {
    addMemoryRecord,
    getMemory,
    getRecentMemories,
    rememberUser,
} from './memory';
import { summarizeLink } from './summaries';
import { buildThreadFromTweet } from './tweets';
import { extractUrls, isTweetUrl, serverOrDefault } from './utils';
import { extractKnowledge, formatKnowledge } from './knowledge';
import { truncateContent } from './text';

export type VeraRequest = {
    messageText: string;
    userId: string;
    userName: string;
    serverId: string;
    serverName: string;
    isMentioned?: boolean;
};

export type VeraResponse = {
    sections: string[];
    linkSummaries: string[];
    tweetThreads: { url: string; thread: string }[];
    generalResponse: string;
    knowledgeTriples: Array<{ subject: string; predicate: string; object: string }>;
    knowledgeContext: Array<{ subject: string; predicate: string; object: string }>;
};

/**
 * Core service logic for Vera agent.
 * This is shared between the Discord Gateway bot and the webhook agent.
 */
export async function processVeraRequest(
    ctx: AgentContext,
    params: VeraRequest
): Promise<VeraResponse> {
    const { messageText, userId, userName, serverId, serverName, isMentioned = false } = params;

    // Load and update user memory
    const previousMemory = await getMemory(ctx, serverId, userId);
    await rememberUser(ctx, serverId, userId, userName, messageText, previousMemory);

    // Extract and categorize URLs
    const urls = extractUrls(messageText);
    const tweetUrls = urls.filter(isTweetUrl);
    const otherUrls = urls.filter((url) => !isTweetUrl(url));

    // Process link summaries
    const linkSummaries: string[] = [];
    for (const url of otherUrls) {
        linkSummaries.push(await summarizeLink(url, ctx, serverName));
    }

    // Process tweet threads
    const tweetThreads: { url: string; thread: string }[] = [];
    for (const url of tweetUrls) {
        tweetThreads.push(await buildThreadFromTweet(url, ctx, serverName, userName));
    }

    // Extract and store knowledge
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

    // Get recent knowledge for context
    const recentKnowledge = await getRecentMemories(ctx, serverId, { userId, limit: 5 });
    const knowledgeContext = recentKnowledge.flatMap((rec) => rec.knowledge ?? []).slice(-5);

    // Build conversation context
    const conversationContext =
        previousMemory?.lastMessage && previousMemory.lastMessage !== messageText
            ? `Last time you said: "${previousMemory.lastMessage}". `
            : '';

    // Decide whether to generate a general response
    const shouldRespond = urls.length === 0 || isMentioned;

    let generalResponse = '';
    if (shouldRespond) {
        generalResponse = await runModel(
            `You are ${AGENT_NAME}, a kind and fun multiuser assistant on a Discord server named "${serverOrDefault(
                serverName
            )}". ` +
            `User "${userName}" sent: "${messageText}". ${conversationContext}` +
            `Respond concisely with awareness of the server context and invite follow-ups if helpful.` +
            (knowledgeContext.length > 0 ? ` Known recent facts: ${formatKnowledge(knowledgeContext)}` : '')
        );
    }

    // Build response sections
    const sections: string[] = [];

    if (linkSummaries.length > 0) {
        sections.push(`**Link summaries:**\n${linkSummaries.join('\n')}`);
    }

    if (tweetThreads.length > 0) {
        const threadText = tweetThreads
            .map((entry) => `From ${entry.url} (via xcancel):\n${entry.thread}`)
            .join('\n\n');
        sections.push(`**Thread drafts:**\n${threadText}`);
    }

    if (generalResponse) {
        sections.push(generalResponse);
    }

    if (sections.length === 0) {
        sections.push('I did not find URLs, but I am ready to help with summaries or questions.');
    }

    return {
        sections,
        linkSummaries,
        tweetThreads,
        generalResponse,
        knowledgeTriples,
        knowledgeContext,
    };
}
