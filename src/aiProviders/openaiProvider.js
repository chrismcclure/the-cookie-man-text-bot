import { OPENAI_MODEL } from './openaiConfig.js';

// Adapter between the OpenAI Responses API and the app's duck-typed
// aiProvider contract: generateReply({ instructions, message }) => Promise<string>.
//
// The OpenAI SDK client is injected rather than constructed here, so:
//   - tests can supply a fake client and never need OPENAI_API_KEY or a
//     network call
//   - this module never reads process.env itself — the composition root
//     decides how the client is built
//   - OpenAI-specific request/response shapes (and SDK error types) stay
//     behind this boundary instead of leaking into CookieManService or HTTP
export function createOpenAiProvider({ client }) {
  if (!client) {
    throw new Error('createOpenAiProvider requires an OpenAI client');
  }

  return {
    async generateReply({ instructions, message }) {
      let response;
      try {
        response = await client.responses.create({
          model: OPENAI_MODEL,
          instructions,
          input: message,
        });
      } catch (err) {
        // Normalize to a plain Error so callers never need to know about
        // OpenAI's SDK error types; the original is kept as `cause` for
        // server-side diagnostics only.
        throw new Error('OpenAI request failed', { cause: err });
      }

      return response.output_text;
    },
  };
}
