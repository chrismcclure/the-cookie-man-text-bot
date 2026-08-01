import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { CookieManService } from '../src/cookieMan/cookieManService.js';
import { COOKIE_MAN_INSTRUCTIONS } from '../src/cookieMan/cookieManPrompt.js';

// A local fake — no network, no mocking framework. Records what it was
// called with so tests can assert on the contract, not implementation.
function createFakeAiProvider(replyText) {
  return {
    calls: [],
    async generateReply({ instructions, message }) {
      this.calls.push({ instructions, message });
      return replyText;
    },
  };
}

describe('CookieManService', () => {
  it('sends the user message to the AI provider', async () => {
    const fakeProvider = createFakeAiProvider('a reply');
    const service = new CookieManService({ aiProvider: fakeProvider });

    await service.respond('Do you have any oatmeal raisin?');

    assert.equal(fakeProvider.calls.length, 1);
    assert.equal(fakeProvider.calls[0].message, 'Do you have any oatmeal raisin?');
  });

  it('supplies the centralized Cookie Man persona/instructions', async () => {
    const fakeProvider = createFakeAiProvider('a reply');
    const service = new CookieManService({ aiProvider: fakeProvider });

    await service.respond('hello');

    assert.equal(fakeProvider.calls[0].instructions, COOKIE_MAN_INSTRUCTIONS);
  });

  it('returns the provider response unchanged', async () => {
    const fakeProvider = createFakeAiProvider('The vault is sealed until Tuesday.');
    const service = new CookieManService({ aiProvider: fakeProvider });

    const result = await service.respond('hello');

    assert.equal(result, 'The vault is sealed until Tuesday.');
  });

  it('rejects blank input', async () => {
    const fakeProvider = createFakeAiProvider('a reply');
    const service = new CookieManService({ aiProvider: fakeProvider });

    await assert.rejects(() => service.respond(''));
    await assert.rejects(() => service.respond('   '));
    assert.equal(fakeProvider.calls.length, 0, 'provider should not be called for invalid input');
  });

  it('rejects non-string input', async () => {
    const fakeProvider = createFakeAiProvider('a reply');
    const service = new CookieManService({ aiProvider: fakeProvider });

    await assert.rejects(() => service.respond(undefined));
    await assert.rejects(() => service.respond(null));
    await assert.rejects(() => service.respond(42));
  });

  it('requires an aiProvider to be constructed', () => {
    assert.throws(() => new CookieManService({}));
  });
});
