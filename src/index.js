import OpenAI from 'openai';

import { createApp } from './http/createApp.js';
import { CookieManService } from './cookieMan/cookieManService.js';
import { createStubAiProvider } from './aiProviders/stubAiProvider.js';
import { createOpenAiProvider } from './aiProviders/openaiProvider.js';
import { createTwilioRequestVerifier } from './sms/twilioRequestVerifier.js';

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Deciding *which* aiProvider to use based on the environment is composition
// wiring, not Cookie Man business logic — it belongs here, not inside
// CookieManService or the OpenAI provider itself.
function buildAiProvider() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (apiKey) {
    return createOpenAiProvider({ client: new OpenAI({ apiKey }) });
  }

  // Real OpenAI is required in production — fail loudly at startup rather
  // than silently serving fake replies and looking "working" when it isn't.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('OPENAI_API_KEY is required in production but was not set.');
  }

  console.warn(
    'OPENAI_API_KEY is not set — using the stub AI provider. Responses will ' +
      'NOT come from real OpenAI. Set OPENAI_API_KEY to use the real provider.',
  );
  return createStubAiProvider();
}

// Twilio signature verification is required for /sms to accept anything —
// there is no "skip validation" development mode. If either env var is
// missing, /sms simply rejects every request until both are configured
// (see createApp.js). This never blocks /chat, which doesn't touch Twilio.
function buildTwilioRequestVerifier() {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const webhookBaseUrl = process.env.TWILIO_WEBHOOK_BASE_URL;

  if (!authToken || !webhookBaseUrl) {
    console.warn(
      'TWILIO_AUTH_TOKEN and/or TWILIO_WEBHOOK_BASE_URL are not set — POST /sms will reject all requests ' +
        'until both are configured. (POST /chat is unaffected.)',
    );
    return undefined;
  }

  return createTwilioRequestVerifier({ authToken, webhookBaseUrl });
}

const aiProvider = buildAiProvider();
const cookieManService = new CookieManService({ aiProvider });
const verifyTwilioRequest = buildTwilioRequestVerifier();
const app = createApp({ cookieManService, verifyTwilioRequest });

app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});
