// Placeholder AI provider used only until the real OpenAI-backed provider
// exists. Satisfies the same duck-typed contract
// (`generateReply({ instructions, message }) => Promise<string>`) so it can
// be swapped out later without touching CookieManService or the HTTP layer.
export function createStubAiProvider() {
  return {
    async generateReply({ message }) {
      return `(stub Cookie Man) You said: "${message}". Real cookie wisdom coming once OpenAI is wired up.`;
    },
  };
}
