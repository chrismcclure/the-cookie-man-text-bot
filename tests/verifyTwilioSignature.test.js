import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import twilio from 'twilio';

import { verifyTwilioSignature } from '../src/sms/verifyTwilioSignature.js';

// Uses the Twilio SDK's own signing function to generate test signatures,
// rather than reimplementing the HMAC algorithm ourselves — this tests our
// validation against Twilio's actual implementation, with no network call
// and no real Twilio credentials involved.
describe('verifyTwilioSignature', () => {
  const authToken = 'fake-test-auth-token-not-real';
  const url = 'https://example.test/sms';
  const params = { Body: 'hello', From: '+15551234567' };

  it('returns true for a correctly signed request', () => {
    const signature = twilio.getExpectedTwilioSignature(authToken, url, params);

    const result = verifyTwilioSignature({ authToken, signature, url, params });

    assert.equal(result, true);
  });

  it('returns false for a tampered/incorrect signature', () => {
    const wrongSignature = twilio.getExpectedTwilioSignature(authToken, url, { ...params, Body: 'something else' });

    const result = verifyTwilioSignature({ authToken, signature: wrongSignature, url, params });

    assert.equal(result, false);
  });

  it('requires an auth token rather than silently accepting the request', () => {
    const signature = twilio.getExpectedTwilioSignature(authToken, url, params);

    assert.throws(() => verifyTwilioSignature({ signature, url, params }));
  });
});
