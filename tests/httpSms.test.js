import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../src/http/createApp.js';

// Same fake pattern used for /chat — records calls, never touches a real
// CookieManService or AI provider, so these tests make zero OpenAI calls.
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

// These tests are about /sms's transport/business logic (Body validation,
// TwiML shape, error handling) — not about Twilio signature verification,
// which has its own dedicated coverage in tests/httpSmsSignature.test.js
// and tests/twilioRequestVerifier.test.js. A verifier that always approves
// keeps that concern out of the way here.
function alwaysApprove() {
  return true;
}

async function startTestServer(cookieManService) {
  const app = createApp({ cookieManService, verifyTwilioRequest: alwaysApprove });
  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  const { port } = app.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => app.close(resolve)),
  };
}

// Twilio POSTs inbound SMS webhooks as application/x-www-form-urlencoded,
// not JSON — this helper mirrors that shape rather than fetch's default.
async function postSms(baseUrl, fields) {
  const body = new URLSearchParams(fields);
  const response = await fetch(`${baseUrl}/sms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const text = await response.text();
  return { status: response.status, contentType: response.headers.get('content-type'), text };
}

describe('POST /sms', () => {
  it('returns HTTP 200 for a valid Twilio-style payload', async () => {
    const service = createFakeCookieManService({ response: 'Have a cookie.' });
    const { baseUrl, close } = await startTestServer(service);
    try {
      const { status } = await postSms(baseUrl, {
        Body: 'Cookie Man, are you there?',
        From: '+15551234567',
        To: '+15557654321',
      });
      assert.equal(status, 200);
    } finally {
      await close();
    }
  });

  it('passes the inbound SMS Body to CookieManService, unchanged', async () => {
    const service = createFakeCookieManService();
    const { baseUrl, close } = await startTestServer(service);
    try {
      await postSms(baseUrl, { Body: 'Do you have oatmeal raisin?', From: '+15551234567' });
      assert.deepEqual(service.calls, ['Do you have oatmeal raisin?']);
    } finally {
      await close();
    }
  });

  it('returns the CookieManService response wrapped in valid TwiML', async () => {
    const service = createFakeCookieManService({ response: 'Have a cookie.' });
    const { baseUrl, close } = await startTestServer(service);
    try {
      const { text } = await postSms(baseUrl, { Body: 'hi' });
      assert.match(text, /<Response>/);
      assert.match(text, /<Message>Have a cookie\.<\/Message>/);
    } finally {
      await close();
    }
  });

  it('responds with an XML content type appropriate for TwiML', async () => {
    const service = createFakeCookieManService();
    const { baseUrl, close } = await startTestServer(service);
    try {
      const { contentType } = await postSms(baseUrl, { Body: 'hi' });
      assert.match(contentType ?? '', /xml/);
    } finally {
      await close();
    }
  });

  it('rejects a missing Body', async () => {
    const service = createFakeCookieManService();
    const { baseUrl, close } = await startTestServer(service);
    try {
      const { status } = await postSms(baseUrl, { From: '+15551234567' });
      assert.equal(status, 400);
      assert.equal(service.calls.length, 0, 'service should not be called for invalid input');
    } finally {
      await close();
    }
  });

  it('rejects a blank Body', async () => {
    const service = createFakeCookieManService();
    const { baseUrl, close } = await startTestServer(service);
    try {
      const { status } = await postSms(baseUrl, { Body: '   ' });
      assert.equal(status, 400);
      assert.equal(service.calls.length, 0, 'service should not be called for invalid input');
    } finally {
      await close();
    }
  });

  it('handles a CookieManService failure safely, without leaking the internal error', async () => {
    const secretDetail = 'sk-should-not-leak-9999';
    const service = createFakeCookieManService({ error: new Error(secretDetail) });
    const { baseUrl, close } = await startTestServer(service);
    try {
      const { status, text, contentType } = await postSms(baseUrl, { Body: 'hi' });
      assert.ok(!text.includes(secretDetail), 'response body must not include the internal error message');
      assert.ok(!text.includes('.js:'), 'response body must not include a stack trace');
      assert.ok(status < 500, 'should still hand the texter a reply rather than a bare 5xx');
      assert.match(contentType ?? '', /xml/);
      assert.match(text, /<Response>/);
    } finally {
      await close();
    }
  });
});
