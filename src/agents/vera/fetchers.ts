import type { AgentContext } from '@agentuity/sdk';
import { truncateContent } from './text';

export async function fetchContent(url: string, ctx: AgentContext): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'vera/1.0 (+https://agentuity.com)',
      },
    });

    if (!response.ok) {
      ctx.logger.warn('Fetch failed for %s with status %d', url, response.status);

      return null;
    }

    const raw = await response.text();

    return truncateContent(raw);
  } catch (error) {
    ctx.logger.warn('Fetch error for %s: %o', url, error);

    return null;
  }
}
