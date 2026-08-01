import twilio from 'twilio';

// Wraps Twilio's own request-signature verification (HMAC-SHA1 over the
// webhook URL + sorted params, keyed by the Twilio Auth Token). This is a
// pure, local computation — no network call to Twilio is involved, which is
// what makes it possible to unit test with fabricated signatures/tokens.
//
// Deliberately NOT wired into the /sms route yet: this module exists so
// signature verification can be added to `createApp.js` as a small,
// independently-testable step before the integration is production-ready,
// without entangling it with the transport tests added in this slice.
export function verifyTwilioSignature({ authToken, signature, url, params }) {
  if (!authToken) {
    throw new Error('verifyTwilioSignature requires a Twilio auth token');
  }

  return twilio.validateRequest(authToken, signature, url, params);
}
