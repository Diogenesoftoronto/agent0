import { Client, GatewayIntentBits, Partials, Events, REST, Routes } from 'discord.js';
import { processVeraRequest } from './agents/vera/service';
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
    const ctx = await agentContextPromise;
    const { sections } = await processVeraRequest(ctx, params);
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
        } as unknown as AgentContext;
    }
}
