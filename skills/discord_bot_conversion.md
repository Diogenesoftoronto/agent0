# Skill: Converting Agentuity Agent to Discord Bot

## Context
The original agent was built using the Agentuity SDK, designed to run as a webhook-based agent (receiving HTTP requests). The goal was to convert this into a standalone Discord bot using `discord.js` that connects via the WebSocket Gateway.

## Learnings

### 1. Entry Point Replacement
- **Original**: `index.ts` imported `runner` from `@agentuity/sdk` and executed it.
- **New**: `index.ts` imports a `startBot` function from `src/bot.ts`.
- **Takeaway**: The Agentuity project structure is flexible. You can replace the default runner with any custom Node.js/Bun logic while keeping the project configuration (`agentuity.yaml`, `package.json`) intact.

### 2. Reusing Agent Logic
- **Challenge**: Existing functions (like `rememberUser`, `summarizeLink`) expect an `AgentContext` object provided by the SDK.
- **Solution**: Created a mock context object in `src/bot.ts` to satisfy the type requirements.
  ```typescript
  const mockCtx: AgentContext = {
    logger: console as any,
    agentId: 'discord-bot',
    projectId: 'agent0',
    env: process.env,
  } as any;
  ```
- **Takeaway**: Business logic can be decoupled from the specific transport (webhook vs gateway) by mocking or adapting the context.

### 3. Adapting Event Models
- **Webhook**: Receives `AgentRequest` (HTTP).
- **Discord.js**: Receives `Message` object (Event).
- **Mapping**:
  - `req.data.text()` -> `message.content`
  - `req.get('userId')` -> `message.author.id`
  - `req.get('serverId')` -> `message.guild.id`
- **Takeaway**: The core logic of extracting URLs, summarizing, and generating responses remains the same; only the input extraction layer needs to change.

### 4. Dependencies
- Required `discord.js` for the bot client.
- Required `@types/node` for process environment variables and other Node.js globals (if not already present).

## Process Summary
1.  Install `discord.js`: `bun add discord.js`.
2.  Create `src/bot.ts` to initialize `Client`, handle `messageCreate`, and reply.
3.  Refactor `index.ts` to call `startBot()` instead of `runner()`.
4.  Ensure `DISCORD_TOKEN` is set in `.env`.
