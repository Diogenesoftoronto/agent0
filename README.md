<div align="center">
    <img src="https://raw.githubusercontent.com/agentuity/cli/refs/heads/main/.github/Agentuity.png" alt="Agentuity" width="100"/> <br/>
    <strong>Agent0: Vera</strong> <br/>
    <br/>
</div>

# 🤖 Agent0: Vera 

Agent0 exists because I wanted a better Discord bot than what I experienced in the Latent Space server. That bot could spin up threads from tweets with summaries and an xcancel link. Vera does that too, and also remembers people in chat so you can ask about prior conversations or users.

## 🌟 What is Vera?

Vera is more than just a chatbot (not really). She is an AI agent capable of:
- **Summarizing Links**: Automatically provides summaries for shared URLs.
- **Unrolling Tweets**: Fetches and displays full threads from X/Twitter links.
- **Remembering Context**: Keeps track of conversations and learns facts about the server and users.
- **Engaging Conversation**: Offers friendly and context-aware chat.

## 📋 Prerequisites

- **Bun**: Version 1.2.4 or higher
- **Discord Bot Token**: You need a bot application created in the [Discord Developer Portal](https://discord.com/developers/applications)

## 🚀 Getting Started

### 1. Discord Setup

1.  **Create Application**: Go to the [Discord Developer Portal](https://discord.com/developers/applications) and click "New Application". Name it "Vera" (or whatever you like).
2.  **Get Credentials**:
    *   Copy the **Application ID** from the "General Information" page.
    *   Go to the **Bot** tab, click "Reset Token", and copy the **Token**.
3.  **Enable Intents**:
    *   On the **Bot** tab, scroll down to "Privileged Gateway Intents".
    *   Enable **Message Content Intent**, **Server Members Intent**, and **Presence Intent**.
    *   Save changes.
4.  **Invite Bot**:
    *   Go to the **OAuth2** > **URL Generator** tab.
    *   Select `bot` and `applications.commands` scopes.
    *   Select `Send Messages`, `Read Messages/View Channels`, `Embed Links`, and `Attach Files` permissions.
    *   Copy the generated URL and open it in your browser to invite the bot to your test server.

### 2. Environment Configuration

Create a `.env` file in the root directory:

```env
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_APPLICATION_ID=your_discord_application_id_here
GOOGLE_API_KEY=your_google_api_key_here
```

*Note: You can get a Google API Key from [Google AI Studio](https://aistudio.google.com/).*

### 3. Install & Run

Install dependencies:
```bash
bun install
```

Start the bot locally:
```bash
bun run dev
```

You should see: `Ready! Logged in as Vera#1234`

### 4. Testing

Once the bot is running and in your server:

1.  **Direct Message**: Send a DM to the bot saying "Hello!". It should reply.
2.  **Server Chat**: In a channel where the bot is present, mention it: `@Vera what do you think of this project?`.
3.  **Link Summary**: Paste a link to a news article or documentation page. Vera should automatically reply with a summary.
4.  **Slash Command**: Type `/vera message: tell me a joke`. (Note: Slash commands may take up to an hour to propagate globally, but are instant in the guild if you updated the code correctly).

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
