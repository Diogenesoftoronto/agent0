export const welcome = () => {
  return {
    welcome:
      'I summarize links, pull tweets via xcancel, spin those into thread starters, and remember who is talking so I can respect the server context.',
    prompts: [
      {
        data: 'Can you summarize the links we dropped earlier today and suggest a thread title?',
        contentType: 'text/plain',
      },
      {
        data: 'Grab this tweet and make a Discord thread from it: https://x.com/someone/status/123',
        contentType: 'text/plain',
      },
      {
        data: 'Who asked about onboarding resources last time?',
        contentType: 'text/plain',
      },
    ],
  };
};
