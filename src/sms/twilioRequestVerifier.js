import { verifyTwilioSignature } from './verifyTwilioSignature.js';

const SIGNATURE_HEADER = 'x-twilio-signature';

// Builds a request-level Twilio signature verifier: given the raw inbound
// request and the parsed form params, decides whether this looks like a
// genuine Twilio webhook call. This bundles together the pieces the HTTP
// transport shouldn't need to know about — which header carries the
// signature, and how to reconstruct the *public* URL Twilio believes it
// called.
//
// That last part matters once this app sits behind a tunnel/proxy: Twilio
// signs the public URL (e.g. https://something.example/sms), but the
// request physically arrives here as plain HTTP on localhost:PORT. Using
// `req`'s own host/protocol to rebuild the URL would produce the *wrong*
// URL and every signature would fail to validate. Instead we combine the
// request path with an explicitly configured `webhookBaseUrl` — the one
// public address Twilio is actually configured to call — rather than
// trusting `X-Forwarded-*` headers, which would mean blindly trusting
// whatever a reverse proxy (or a request pretending to be one) claims.
export function createTwilioRequestVerifier({ authToken, webhookBaseUrl }) {
  if (!authToken) {
    throw new Error('createTwilioRequestVerifier requires a Twilio auth token');
  }
  if (!webhookBaseUrl) {
    throw new Error('createTwilioRequestVerifier requires a public webhook base URL (TWILIO_WEBHOOK_BASE_URL)');
  }

  return function verifyTwilioRequest({ req, params }) {
    const signature = req.headers[SIGNATURE_HEADER];
    if (!signature) {
      return false;
    }

    const url = new URL(req.url, webhookBaseUrl).toString();
    return verifyTwilioSignature({ authToken, signature, url, params });
  };
}
