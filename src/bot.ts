import { Client, GatewayIntentBits, Partials, Events } from 'discord.js';
import { AGENT_NAME } from './agents/vera/constants';
import { runModel } from './agents/vera/llm';
import {
    addMemoryRecord,
    getMemory,
    getRecentMemories,
    rememberUser,
} from './agents/vera/memory';
import { summarizeLink } from './agents/vera/summaries';
import { buildThreadFromTweet } from './agents/vera/tweets';
import {
    extractUrls,
    isTweetUrl,
    serverOrDefault,
} from './agents/vera/utils';
import { extractKnowledge, formatKnowledge } from './agents/vera/knowledge';
import { truncateContent } from './agents/vera/text';
import type { AgentContext } from '@agentuity/sdk';

// Mock AgentContext for reuse of existing functions
// In a real scenario, you might want to properly initialize logger and other context properties
const mockCtx: AgentContext = {
    logger: console as any,
    agentId: 'discord-bot',
    projectId: 'agent0',
    env: process.env,
    // Add other required properties if needed by the SDK functions
} as any;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
});

client.once(Events.ClientReady, (c) => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    try {
        const messageText = message.content;
        const userId = message.author.id;
        const userName = message.author.username;
        const serverId = message.guild?.id || 'dm';
        const serverName = message.guild?.name || 'Direct Message';

        // Reuse existing logic
        const previousMemory = await getMemory(mockCtx, serverId, userId);
        await rememberUser(mockCtx, serverId, userId, userName, messageText, previousMemory);

        const urls = extractUrls(messageText);
        const tweetUrls = urls.filter(isTweetUrl);
        const otherUrls = urls.filter((url) => !isTweetUrl(url));

        const linkSummaries: string[] = [];
        for (const url of otherUrls) {
            linkSummaries.push(await summarizeLink(url, mockCtx, serverName));
        }

        const tweetThreads: { url: string; thread: string }[] = [];
        for (const url of tweetUrls) {
            tweetThreads.push(await buildThreadFromTweet(url, mockCtx, serverName, userName));
        }

        const knowledgeTriples = await extractKnowledge(messageText, mockCtx);
        await addMemoryRecord(mockCtx, {
            id: `${Date.now()}`,
            serverId,
            userId,
            userName,
            message: truncateContent(messageText),
            knowledge: knowledgeTriples,
            createdAtIso: new Date().toISOString(),
        });

        const recentKnowledge = await getRecentMemories(mockCtx, serverId, { userId, limit: 5 });
        const knowledgeContext = recentKnowledge
            .flatMap((rec) => rec.knowledge ?? [])
            .slice(-5);

        const conversationContext =
            previousMemory?.lastMessage && previousMemory.lastMessage !== messageText
                ? `Last time you said: "${previousMemory.lastMessage}". `
                : '';

        // Only generate a general response if there are no URLs or if specifically mentioned/replied to
        // For now, let's keep the logic similar: if no URLs, generate response.
        // Or if the bot is mentioned.
        const isMentioned = message.mentions.has(client.user!);
        const shouldRespond = urls.length === 0 || isMentioned;

        let generalResponse = '';
        if (shouldRespond) {
            generalResponse = await runModel(
                `You are ${AGENT_NAME}, a kind and fun multiuser assistant on a Discord server named "${serverOrDefault(
                    serverName
                )}". ` +
                `User "${userName}" sent: "${messageText}". ${conversationContext}` +
                `Respond concisely with awareness of the server context and invite follow-ups if helpful.` +
                (knowledgeContext.length > 0
                    ? ` Known recent facts: ${formatKnowledge(knowledgeContext)}`
                    : '')
            );
        }

        const sections: string[] = [];

        // Only add greeting if we are responding
        if (shouldRespond || linkSummaries.length > 0 || tweetThreads.length > 0) {
            // sections.push(`Hi ${userName}!`); // Maybe skip generic greeting to be less spammy in chat
        }

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

        if (sections.length > 0) {
            await message.reply(sections.join('\n\n'));
        }

    } catch (error) {
        console.error('Error processing message:', error);
    }
});

export async function startBot() {
    const token = process.env.DISCORD_TOKEN;
    if (!token) {
        console.error('DISCORD_TOKEN is not set in .env');
        process.exit(1);
    }

    try {
        await client.login(token);
    } catch (error) {
        console.error('Failed to login:', error);
        process.exit(1);
    }
}
