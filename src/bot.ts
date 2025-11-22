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
import { metrics, trace } from '@opentelemetry/api';

const agentContextPromise = createAgentContext();

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
    const ctx = await agentContextPromise;

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
        // Ensure Agentuity context is ready (KV, logger, etc.)
        await agentContextPromise;
        await registerSlashCommands(token, applicationId);
        await client.login(token);
    } catch (error) {
        console.error('Failed to login:', error);
        process.exit(1);
    }
}

async function createAgentContext(): Promise<AgentContext> {
    try {
        // @ts-expect-error createServerContext is exported at runtime but missing from the type surface
        const agentuitySdk = (await import('@agentuity/sdk')) as any;
        const createServerContext = agentuitySdk.createServerContext as
            | undefined
            | ((req: {
                  tracer: unknown;
                  meter: unknown;
                  logger: unknown;
                  orgId?: string;
                  projectId?: string;
                  deploymentId?: string;
                  runId?: string;
                  sessionId?: string;
                  devmode?: boolean;
                  sdkVersion: string;
                  agents: Array<{ id: string; name: string; filename: string; description?: string }>;
              }) => Promise<AgentContext>);

        if (!createServerContext) {
            throw new Error('Agentuity SDK createServerContext not available');
        }

        const tracer = trace.getTracer('discord-bot');
        const meter = metrics.getMeter('discord-bot');
        const logger = (agentuitySdk.logger?.child?.({ service: 'discord-bot' }) ??
            console) as AgentContext['logger'];

        return await createServerContext({
            tracer,
            meter,
            logger,
            orgId: process.env.AGENTUITY_ORG_ID,
            projectId: process.env.AGENTUITY_PROJECT_ID ?? 'agent0',
            deploymentId: process.env.AGENTUITY_DEPLOYMENT_ID ?? 'discord-bot',
            runId: 'discord-bot',
            sessionId: 'discord-bot',
            devmode: process.env.NODE_ENV !== 'production',
            sdkVersion: agentuitySdk?.internal?.getConfig?.()?.version ?? 'discord-bot',
            agents: [
                {
                    id: 'discord-bot',
                    name: 'discord-bot',
                    filename: 'src/bot.ts',
                    description: 'Discord gateway bot using Agentuity KV',
                },
            ],
        });
    } catch (error) {
        console.warn('Falling back to in-memory context (Agentuity KV unavailable):', error);
        const kvStore = new Map<string, unknown>();
        return {
            logger: console as any,
            agentId: 'discord-bot',
            projectId: process.env.AGENTUITY_PROJECT_ID ?? 'agent0',
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
        } as AgentContext;
    }
}
