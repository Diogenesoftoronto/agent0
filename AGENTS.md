# Vera - The Helpful Discord Agent

Vera is a conversational AI agent designed to be a helpful and fun presence on your Discord server. She is built using the Agentuity SDK and runs as a standalone Discord bot.

## Capabilities

### 1. Conversational Assistant
Vera can engage in natural conversations with users. She remembers context from previous interactions (per user/server) to provide more personalized responses.
- **Memory**: Remembers the last message from a user to provide continuity.
- **Personality**: Friendly, helpful, and aware of the server context.

### 2. Link Summarization
When a user posts a link, Vera automatically visits the URL and provides a concise summary of the content.
- **Supported Content**: General web pages, articles, and documentation.
- **Benefit**: Saves users from clicking every link to know what it's about.

### 3. Tweet Expansion (X/Twitter)
Vera detects Twitter/X links and fetches the full thread content.
- **Thread Drafts**: Reconstructs the conversation thread from a single tweet link.
- **Privacy**: Uses `xcancel` or similar proxies to fetch content without requiring a Twitter account.

### 4. Knowledge Extraction
Vera actively learns from the conversation.
- **Fact Extraction**: Identifies and stores key facts (triples) from user messages.
- **Recall**: Uses recent knowledge to inform her responses.

## Architecture

Vera is implemented in `src/agents/vera/index.ts` (logic) and `src/bot.ts` (Discord interface).

### Key Components
- **`bot.ts`**: The Discord client entry point. Listens for `messageCreate` events.
- **`memory.ts`**: Handles storing and retrieving user context and knowledge.
- **`summaries.ts`**: Logic for fetching and summarizing web content.
- **`tweets.ts`**: Logic for parsing and reconstructing Twitter threads.
- **`llm.ts`**: Interface to the Large Language Model for generating responses and summaries.
