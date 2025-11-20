import { MAX_CONTENT_CHARS } from './constants';

export function truncateContent(input: string): string {
  if (input.length <= MAX_CONTENT_CHARS) {
    return input;
  }

  return input.slice(0, MAX_CONTENT_CHARS);
}
