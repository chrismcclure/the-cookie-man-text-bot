import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import twilio from 'twilio';

import { createApp } from '../src/http/createApp.js';
import { createTwilioRequestVerifier } from '../src/sms/twilioRequestVerifier.js';

function createFakeCookieManService({ response = 'a reply' } = {}) {
  return {
    calls: [],
    async respond(message) {
      this.calls.push(message);
      return response;
    },
  };
}

async function startTestServer({ cookieManService, verifyTwilioRequest }) {
  const app = createApp({ cookieManService, verifyTwilioRequest });
  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  const { port } = app.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => app.close(resolve)),
  };
}

async function postSms(baseUrl, fields, headers = {}) {
  const body = new URLSearchParams(fields);
  const response = await fetch(`${baseUrl}/sms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
    body: body.toString(),
  });
  const text = await response.text();
  return { status: response.status, text };
}

describe('POST /sms Twilio signature enforcement', () => {
  it('accepts a request the injected verifier approves, and invokes CookieManService', async () => {
    const service = createFakeCookieManService({ response: 'Have a cookie.' });
    const { baseUrl, close } = await startTestServer({
      cookieManService: service,
      verifyTwilioRequest: () => true,
    });
    try {
      const { status, text } = await postSms(
        baseUrl,
        { Body: 'hi' },
        { 'X-Twilio-Signature': 'irrelevant-because-the-fake-verifier-always-approves' },
      );
      assert.equal(status, 200);
      assert.deepEqual(service.calls, ['hi']);
      assert.match(text, /Have a cookie\./);
    } finally {
      await close();
    }
  });

  it('rejects a request the injected verifier disapproves, and never invokes CookieManService', async () => {
    const service = createFakeCookieManService();
    const { baseUrl, close } = await startTestServer({
      cookieManService: service,
      verifyTwilioRequest: () => false,
    });
    try {
      const { status, text } = await postSms(baseUrl, { Body: 'hi' }, { 'X-Twilio-Signature': 'wrong-signature' });
      assert.ok(status >= 400 && status < 500, `expected a 4xx status, got ${status}`);
      assert.equal(service.calls.length, 0, 'CookieManService must not be invoked for an invalid signature');
      assert.ok(!text.toLowerCase().includes('signature'), 'response must not reveal validation internals');
    } finally {
      await close();
    }
  });

  it('rejects a request with no X-Twilio-Signature header, and never invokes CookieManService', async () => {
    const service = createFakeCookieManService();
    const { baseUrl, close } = await startTestServer({
      cookieManService: service,
      verifyTwilioRequest: () => false,
    });
    try {
      const { status } = await postSms(baseUrl, { Body: 'hi' }); // no signature header sent at all
      assert.ok(status >= 400 && status < 500, `expected a 4xx status, got ${status}`);
      assert.equal(service.calls.length, 0, 'CookieManService must not be invoked when the signature is missing');
    } finally {
      await close();
    }
  });

  it('fails closed (rejects everything) when no verifier is configured at all — no dev-mode bypass', async () => {
    const service = createFakeCookieManService();
    const { baseUrl, close } = await startTestServer({ cookieManService: service, verifyTwilioRequest: undefined });
    try {
      const { status } = await postSms(baseUrl, { Body: 'hi' }, { 'X-Twilio-Signature': 'anything' });
      assert.ok(status >= 400 && status < 500, `expected a 4xx status, got ${status}`);
      assert.equal(service.calls.length, 0);
    } finally {
      await close();
    }
  });

  it(
    'accepts a genuinely Twilio-signed request end-to-end, using the configured public webhook URL ' +
      'rather than the physical host/port the test server happens to listen on',
    async () => {
      const service = createFakeCookieManService({ response: 'The vault is sealed until Tuesday.' });
      const authToken = 'fake-test-auth-token-not-real';
      const webhookBaseUrl = 'https://example.test'; // deliberately not the test server's real address
      const verifyTwilioRequest = createTwilioRequestVerifier({ authToken, webhookBaseUrl });
      const { baseUrl, close } = await startTestServer({ cookieManService: service, verifyTwilioRequest });

      const params = { Body: 'Cookie Man, are you there?' };
      const signature = twilio.getExpectedTwilioSignature(authToken, `${webhookBaseUrl}/sms`, params);

      try {
        const { status, text } = await postSms(baseUrl, params, { 'X-Twilio-Signature': signature });
        assert.equal(status, 200);
        assert.deepEqual(service.calls, ['Cookie Man, are you there?']);
        assert.match(text, /The vault is sealed until Tuesday\./);
      } finally {
        await close();
      }
    },
  );
});
