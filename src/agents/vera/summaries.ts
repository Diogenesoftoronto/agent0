import type { AgentContext } from '@agentuity/sdk';
import { fetchContent } from './fetchers';
import { runModel } from './llm';

export async function summarizeLink(url: string, ctx: AgentContext, serverName: string) {
  const body = await fetchContent(url, ctx);

  if (!body) {
    return `- ${url}: (could not fetch content, please try again)`;
  }

  const summary = await runModel(
    `Summarize the key points of the link for a Discord audience on "${serverName}". ` +
      `Stay concise (3-5 bullet points) and surface any actions for the server. Content:\n${body}`
  );

  return `- ${url}: ${summary}`;
}
