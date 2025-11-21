<div align="center">
    <img src="https://raw.githubusercontent.com/agentuity/cli/refs/heads/main/.github/Agentuity.png" alt="Agentuity" width="100"/> <br/>
    <strong>Agent0: Vera - The Discord Bot</strong> <br/>
    <br/>
</div>

# 🤖 Agent0: Vera

Welcome to **Agent0**, the home of **Vera**, a smart and helpful Discord bot powered by Agentuity.

## 🌟 What is Vera?

Vera is more than just a chatbot. She is an AI agent capable of:
- **Summarizing Links**: Automatically provides summaries for shared URLs.
- **Unrolling Tweets**: Fetches and displays full threads from X/Twitter links.
- **Remembering Context**: Keeps track of conversations and learns facts about the server and users.
- **Engaging Conversation**: Offers friendly and context-aware chat.

## 📋 Prerequisites

- **Bun**: Version 1.2.4 or higher
- **Discord Bot Token**: You need a bot application created in the [Discord Developer Portal](https://discord.com/developers/applications).

## 🚀 Getting Started

### 1. Setup Environment

Create a `.env` file in the root directory (or use the existing one) and add your Discord Bot Token:

```env
DISCORD_TOKEN=your_discord_bot_token_here
```

*Note: If you are using Agentuity features, ensure your `AGENTUITY_API_KEY` is also set.*

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

## 📚 Documentation

- **[AGENTS.md](./AGENTS.md)**: Detailed breakdown of Vera's capabilities and architecture.
- **[skills/discord_bot_conversion.md](./skills/discord_bot_conversion.md)**: Notes on how this project was converted from a webhook agent to a Discord bot.

## 🔧 Configuration

The project is configured via `agentuity.yaml` and `package.json`.
- **`src/bot.ts`**: The main entry point for the Discord bot.
- **`src/agents/vera/`**: Contains the core logic for the agent.

## 📝 License

This project is licensed under the terms specified in the LICENSE file.
