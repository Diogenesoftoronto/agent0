<div align="center">
    <img src="https://raw.githubusercontent.com/agentuity/cli/refs/heads/main/.github/Agentuity.png" alt="Agentuity" width="100"/> <br/>
    <strong>Build Agents, Not Infrastructure</strong> <br/>
    <br/>
        <a target="_blank" href="https://app.agentuity.com/deploy" alt="Agentuity">
            <img src="https://app.agentuity.com/img/deploy.svg" /> 
        </a>
    <br/>
</div>

# 🤖 Agent0: Vera (Bun Agent Project)

Welcome to your Agentuity Bun Agent project, **Agent0: Vera**—a smart and helpful Discord bot powered by Agentuity.

## 🌟 What is Vera?

Vera is more than just a chatbot. She is an AI agent capable of:
- **Summarizing Links**: Automatically provides summaries for shared URLs.
- **Unrolling Tweets**: Fetches and displays full threads from X/Twitter links.
- **Remembering Context**: Keeps track of conversations and learns facts about the server and users.
- **Engaging Conversation**: Offers friendly and context-aware chat.

## 📋 Prerequisites

- **Bun**: Version 1.2.4 or higher
- **Discord Bot Token**: You need a bot application created in the [Discord Developer Portal](https://discord.com/developers/applications)

## 🚀 Getting Started

### Authentication

Before using Agentuity, log in:

```bash
agentuity login
```

### 1. Setup Environment

Create a `.env` file in the root directory (or use the existing one) and add your Discord application credentials:

```env
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_APPLICATION_ID=your_discord_application_id_here
DISCORD_PUBLIC_KEY=your_discord_public_key_here
```

*Note: If you are using Agentuity features, ensure your `AGENTUITY_API_KEY` is also set. For sensitive values, prefer `agentuity env set --secret ...`.*

You can set environment variables via Agentuity:

```bash
agentuity env set DISCORD_PUBLIC_KEY $DISCORD_PUBLIC_KEY
agentuity env set --secret DISCORD_APPLICATION_ID $DISCORD_APPLICATION_ID
agentuity env set --secret DISCORD_TOKEN $DISCORD_TOKEN
```

### Create a new agent (optional)

```bash
agentuity agent new
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Run the Bot

You can start the bot in development mode using:

```bash
agentuity dev
```

Or directly via Bun:

```bash
bun run start
```

The bot will log in and print `Ready! Logged in as [Tag]` to the console.

## 🌐 Deployment

When you're ready to deploy to Agentuity Cloud:

```bash
agentuity deploy
```

## 📚 Documentation

- **[AGENTS.md](./AGENTS.md)**: Detailed breakdown of Vera's capabilities and architecture.
- **[skills/discord_bot_conversion.md](./skills/discord_bot_conversion.md)**: Notes on how this project was converted from a webhook agent to a Discord bot.
- **Agentuity docs**: https://agentuity.dev/SDKs/javascript
- **Discord docs**: https://discord.com/developers/docs/intro

## 🔧 Configuration

The project is configured via `agentuity.yaml` and `package.json`.
- **`src/bot.ts`**: The main entry point for the Discord bot.
- **`src/agents/vera/`**: Contains the core logic for the agent.

## 📝 License

This project is licensed under the terms specified in the LICENSE file.
