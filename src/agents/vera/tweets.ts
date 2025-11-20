import type { AgentContext } from '@agentuity/sdk';
import { fetchContent } from './fetchers';
import { runModel } from './llm';
import { toXcancelUrl } from './utils';

export async function buildThreadFromTweet(
  tweetUrl: string,
  ctx: AgentContext,
  serverName: string,
  userName: string
): Promise<{ url: string; thread: string }> {
  const lookupUrl = toXcancelUrl(tweetUrl) ?? tweetUrl;
  const body = await fetchContent(lookupUrl, ctx);

  if (!body) {
    return {
      url: tweetUrl,
      thread: 'Could not retrieve the tweet via xcancel. Double-check the link.',
    };
  }

  const tweetExtraction = await runModel(
    `Extract the tweet text (and any visible replies) from the following HTML or text captured from xcancel. ` +
      `Return a compact transcription with speaker names when available.\n${body}`
  );

  const thread = await runModel(
    `Using this tweet content, craft a short Discord thread tailored for "${serverName}". ` +
      `Write 3-6 numbered posts that keep the original voice but invite the community to respond. ` +
      `Tag the user "${userName}" naturally if it fits. Tweet content:\n${tweetExtraction}`
  );

  return { url: tweetUrl, thread };
}
