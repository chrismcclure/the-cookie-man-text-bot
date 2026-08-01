import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createOpenAiProvider } from '../src/aiProviders/openaiProvider.js';
import { OPENAI_MODEL } from '../src/aiProviders/openaiConfig.js';

// A local fake OpenAI SDK client — shaped like the real `OpenAI` client's
// `responses.create` surface, but records calls and never touches the
// network. This is injected in place of a real client so these tests never
// need OPENAI_API_KEY and never make a real API call.
function createFakeOpenAiClient({ outputText = 'a reply', error } = {}) {
  const calls = [];
  return {
    calls,
    responses: {
      async create(params) {
        calls.push(params);
        if (error) {
          throw error;
        }
        return { output_text: outputText };
      },
    },
  };
}

describe('createOpenAiProvider', () => {
  it('requires an OpenAI client to be constructed (never reads env vars itself)', () => {
    assert.throws(() => createOpenAiProvider({}));
  });

  it('sends the Cookie Man instructions to the OpenAI client', async () => {
    const client = createFakeOpenAiClient();
    const provider = createOpenAiProvider({ client });

    await provider.generateReply({ instructions: 'You are The Cookie Man.', message: 'hi' });

    assert.equal(client.calls.length, 1);
    assert.equal(client.calls[0].instructions, 'You are The Cookie Man.');
  });

  it("sends the user's message", async () => {
    const client = createFakeOpenAiClient();
    const provider = createOpenAiProvider({ client });

    await provider.generateReply({
      instructions: 'You are The Cookie Man.',
      message: 'Do you have snickerdoodles?',
    });

    assert.equal(client.calls[0].input, 'Do you have snickerdoodles?');
  });

  it('supplies the centrally configured model', async () => {
    const client = createFakeOpenAiClient();
    const provider = createOpenAiProvider({ client });

    await provider.generateReply({ instructions: 'x', message: 'hi' });

    assert.equal(client.calls[0].model, OPENAI_MODEL);
  });

  it('extracts and returns only the generated text from the response', async () => {
    const client = createFakeOpenAiClient({ outputText: 'The vault is sealed until Tuesday.' });
    const provider = createOpenAiProvider({ client });

    const result = await provider.generateReply({ instructions: 'x', message: 'hi' });

    assert.equal(result, 'The vault is sealed until Tuesday.');
  });

  it('propagates OpenAI SDK failures as a rejected promise without leaking the raw SDK error type', async () => {
    const sdkError = new Error('rate limit exceeded');
    const client = createFakeOpenAiClient({ error: sdkError });
    const provider = createOpenAiProvider({ client });

    await assert.rejects(
      () => provider.generateReply({ instructions: 'x', message: 'hi' }),
      (err) => {
        assert.ok(err instanceof Error);
        assert.equal(err.cause, sdkError, 'original SDK error should be preserved as the cause for server-side logging');
        return true;
      },
    );
  });
});
