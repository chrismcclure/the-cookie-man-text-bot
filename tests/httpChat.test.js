import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../src/http/createApp.js';

// A local fake — same pattern as the CookieManService tests. Records calls
// so tests can assert on the HTTP↔service contract without touching a real
// CookieManService or AI provider.
function createFakeCookieManService({ response = 'a reply', error } = {}) {
  return {
    calls: [],
    async respond(message) {
      this.calls.push(message);
      if (error) {
        throw error;
      }
      return response;
    },
  };
}

async function startTestServer(cookieManService) {
  const app = createApp({ cookieManService });
  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  const { port } = app.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => app.close(resolve)),
  };
}

async function postChat(baseUrl, body) {
  const response = await fetch(`${baseUrl}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Some responses under test are intentionally not JSON-shaped.
  }
  return { status: response.status, json, text };
}

describe('POST /chat', () => {
  it('returns HTTP 200 for a valid message', async () => {
    const service = createFakeCookieManService({ response: 'Have a cookie.' });
    const { baseUrl, close } = await startTestServer(service);
    try {
      const { status } = await postChat(baseUrl, { message: 'Hello Cookie Man' });
      assert.equal(status, 200);
    } finally {
      await close();
    }
  });

  it('returns the CookieManService response in the JSON body', async () => {
    const service = createFakeCookieManService({ response: 'Have a cookie.' });
    const { baseUrl, close } = await startTestServer(service);
    try {
      const { json } = await postChat(baseUrl, { message: 'Hello Cookie Man' });
      assert.deepEqual(json, { response: 'Have a cookie.' });
    } finally {
      await close();
    }
  });

  it('passes the incoming message through to CookieManService unchanged', async () => {
    const service = createFakeCookieManService();
    const { baseUrl, close } = await startTestServer(service);
    try {
      await postChat(baseUrl, { message: 'Do you have oatmeal raisin?' });
      assert.deepEqual(service.calls, ['Do you have oatmeal raisin?']);
    } finally {
      await close();
    }
  });

  it('returns HTTP 400 when message is missing', async () => {
    const service = createFakeCookieManService();
    const { baseUrl, close } = await startTestServer(service);
    try {
      const { status } = await postChat(baseUrl, {});
      assert.equal(status, 400);
      assert.equal(service.calls.length, 0, 'service should not be called for invalid input');
    } finally {
      await close();
    }
  });

  it('returns HTTP 400 when message is blank', async () => {
    const service = createFakeCookieManService();
    const { baseUrl, close } = await startTestServer(service);
    try {
      const { status } = await postChat(baseUrl, { message: '   ' });
      assert.equal(status, 400);
      assert.equal(service.calls.length, 0, 'service should not be called for invalid input');
    } finally {
      await close();
    }
  });

  it('returns HTTP 400 when message is not a string', async () => {
    const service = createFakeCookieManService();
    const { baseUrl, close } = await startTestServer(service);
    try {
      const { status } = await postChat(baseUrl, { message: 42 });
      assert.equal(status, 400);
      assert.equal(service.calls.length, 0, 'service should not be called for invalid input');
    } finally {
      await close();
    }
  });

  it('returns a 5xx response when CookieManService throws unexpectedly', async () => {
    const service = createFakeCookieManService({ error: new Error('sk-should-not-leak-1234') });
    const { baseUrl, close } = await startTestServer(service);
    try {
      const { status } = await postChat(baseUrl, { message: 'Hello' });
      assert.ok(status >= 500 && status < 600, `expected a 5xx status, got ${status}`);
    } finally {
      await close();
    }
  });

  it('does not leak the internal error message or stack trace to the caller', async () => {
    const secretDetail = 'sk-should-not-leak-1234';
    const service = createFakeCookieManService({ error: new Error(secretDetail) });
    const { baseUrl, close } = await startTestServer(service);
    try {
      const { text } = await postChat(baseUrl, { message: 'Hello' });
      assert.ok(!text.includes(secretDetail), 'response body must not include the internal error message');
      assert.ok(!text.includes('.js:'), 'response body must not include a stack trace');
    } finally {
      await close();
    }
  });
});
