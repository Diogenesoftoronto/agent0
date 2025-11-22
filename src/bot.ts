import { Client, GatewayIntentBits, Partials, Events, REST, Routes } from 'discord.js';
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

// Mock AgentContext for reuse of existing functions with a minimal in-memory KV.
const kvStore = new Map<string, unknown>();
const mockCtx: AgentContext = {
    logger: console as any,
    agentId: 'discord-bot',
    projectId: 'agent0',
    env: process.env,
    kv: {
        async get(name: string, key: string) {
            const composite = `${name}:${key}`;
            const exists = kvStore.has(composite);
            return {
                exists,
                data: {
                    async object<T>() {
                        return exists ? (kvStore.get(composite) as T) : undefined;
                    },
                },
            };
        },
        async set(name: string, key: string, value: unknown) {
            kvStore.set(`${name}:${key}`, value);
        },
        async delete(name: string, key: string) {
            kvStore.delete(`${name}:${key}`);
        },
    },
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

type BuiltResponse = {
    sections: string[];
};

async function buildResponse(params: {
    messageText: string;
    userId: string;
    userName: string;
    serverId: string;
    serverName: string;
    isMentioned?: boolean;
}): Promise<BuiltResponse> {
    const { messageText, userId, userName, serverId, serverName, isMentioned = false } = params;

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
    const knowledgeContext = recentKnowledge.flatMap((rec) => rec.knowledge ?? []).slice(-5);

    const conversationContext =
        previousMemory?.lastMessage && previousMemory.lastMessage !== messageText
            ? `Last time you said: "${previousMemory.lastMessage}". `
            : '';

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

    return { sections };
}

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

        const { sections } = await buildResponse({
            messageText,
            userId,
            userName,
            serverId,
            serverName,
            isMentioned: message.mentions.has(client.user!),
        });

        await message.reply(sections.join('\n\n'));

    } catch (error) {
        console.error('Error processing message:', error);
    }
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== 'vera') return;

    try {
        const messageText = interaction.options.getString('message', true);
        const userId = interaction.user.id;
        const userName = interaction.user.username;
        const serverId = interaction.guild?.id || 'dm';
        const serverName = interaction.guild?.name || 'Direct Message';

        const isDm = !interaction.guild;
        // Ephemeral replies are only supported in guilds. Fall back to public in DMs.
        await interaction.deferReply({ ephemeral: !isDm });
        const { sections } = await buildResponse({
            messageText,
            userId,
            userName,
            serverId,
            serverName,
            // Slash command is an explicit invocation; treat as mentioned.
            isMentioned: true,
        });

        await interaction.editReply(sections.join('\n\n'));
    } catch (error) {
        console.error('Error handling slash command:', error);
        if (interaction.isRepliable()) {
            await interaction.editReply('Sorry, something went wrong processing your command.');
        }
    }
});

async function registerSlashCommands(token: string, applicationId: string) {
    const rest = new REST({ version: '10' }).setToken(token);
    const commands = [
        {
            name: 'vera',
            description: 'Chat with Vera (summaries, threads, and helpful answers)',
            options: [
                {
                    type: 3, // STRING
                    name: 'message',
                    description: 'What you want to ask or share',
                    required: true,
                },
            ],
        },
    ];

    await rest.put(Routes.applicationCommands(applicationId), { body: commands });
}

export async function startBot() {
    const token = process.env.DISCORD_TOKEN;
    const applicationId = process.env.DISCORD_APPLICATION_ID;

    if (!token) {
        console.error('DISCORD_TOKEN is not set in .env');
        process.exit(1);
    }

    if (!applicationId) {
        console.error('DISCORD_APPLICATION_ID is not set in .env');
        process.exit(1);
    }

    try {
        await registerSlashCommands(token, applicationId);
        await client.login(token);
    } catch (error) {
        console.error('Failed to login:', error);
        process.exit(1);
    }
}
