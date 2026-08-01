import http from 'node:http';
import twilio from 'twilio';

const { MessagingResponse } = twilio.twiml;

// Untrusted request bodies must never be read unbounded before parsing.
const MAX_BODY_BYTES = 10_000;

// Thin HTTP transport: parse/validate the request, call the injected
// CookieManService, translate the result back into a response. No Cookie
// Man personality, no OpenAI/Twilio knowledge, no provider construction —
// those all live behind `cookieManService`, which the caller supplies.
//
// `verifyTwilioRequest` is an optional injected dependency (see
// src/sms/twilioRequestVerifier.js) used to authenticate inbound /sms
// webhooks. If it's not supplied, /sms fails closed — every request is
// rejected. There is no "skip validation" mode: a missing verifier means
// we have no safe way to tell a genuine Twilio webhook from anyone else's
// POST request, so the only secure default is to reject.
export function createApp({ cookieManService, verifyTwilioRequest }) {
  return http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/chat') {
      handleChat(req, res, cookieManService).catch((err) => {
        console.error('Unhandled error while handling POST /chat', err);
        sendJson(res, 500, { error: 'Internal server error' });
      });
      return;
    }

    if (req.method === 'POST' && req.url === '/sms') {
      handleSms(req, res, cookieManService, verifyTwilioRequest).catch((err) => {
        console.error('Unhandled error while handling POST /sms', err);
        // Twilio only delivers a reply to the texter if we hand back valid
        // TwiML — a bare 5xx here would just leave them with silence.
        sendTwiml(res, buildTwimlMessage('The Cookie Man is temporarily unavailable. Try again shortly.'));
      });
      return;
    }

    if (req.url === '/health') {
      sendJson(res, 200, { status: 'ok' });
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hello from The Cookie Man Text Bot!');
  });
}

async function handleChat(req, res, cookieManService) {
  let payload;
  try {
    payload = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: 'Request body must be valid JSON' });
    return;
  }

  const message = payload?.message;
  if (typeof message !== 'string' || message.trim() === '') {
    sendJson(res, 400, { error: 'message is required and must be a non-empty string' });
    return;
  }

  try {
    const response = await cookieManService.respond(message);
    sendJson(res, 200, { response });
  } catch (err) {
    // Never forward the raw exception/stack — it could contain provider
    // details, prompts, or other internals callers have no business seeing.
    console.error('CookieManService failed to respond', err);
    sendJson(res, 500, { error: 'The Cookie Man is temporarily unavailable' });
  }
}

// Twilio's inbound SMS webhook: form-encoded fields, "Body" holds the
// message text. We reply with TwiML so Twilio sends that reply straight
// back to the original sender — no outbound REST API call needed for v1.
async function handleSms(req, res, cookieManService, verifyTwilioRequest) {
  let formParams;
  try {
    formParams = await readFormBody(req);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Request body must be valid application/x-www-form-urlencoded data');
    return;
  }

  const params = Object.fromEntries(formParams);

  // Signature verification happens before we look at, validate, or act on
  // anything in the payload — an unauthenticated caller shouldn't be able
  // to reach CookieManService (or even trigger a "Body is required"
  // response) at all.
  const isGenuineTwilioRequest = typeof verifyTwilioRequest === 'function' && verifyTwilioRequest({ req, params });
  if (!isGenuineTwilioRequest) {
    // Deliberately vague: never reveal whether the signature was missing,
    // malformed, or simply wrong — that distinction is only useful to an
    // attacker probing for a forgeable request.
    console.warn('Rejected POST /sms: missing or invalid Twilio signature');
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  const body = params.Body;
  if (typeof body !== 'string' || body.trim() === '') {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Body is required and must be a non-empty string');
    return;
  }

  try {
    const cookieManReply = await cookieManService.respond(body);
    sendTwiml(res, buildTwimlMessage(cookieManReply));
  } catch (err) {
    // Never forward the raw exception/stack — same reasoning as /chat.
    console.error('CookieManService failed to respond to SMS', err);
    sendTwiml(res, buildTwimlMessage('The Cookie Man is temporarily unavailable. Try again shortly.'));
  }
}

function buildTwimlMessage(text) {
  const twimlResponse = new MessagingResponse();
  twimlResponse.message(text);
  return twimlResponse.toString();
}

function sendTwiml(res, xml) {
  res.writeHead(200, { 'Content-Type': 'text/xml' });
  res.end(xml);
}

function readFormBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      resolve(new URLSearchParams(raw));
    });

    req.on('error', reject);
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (raw === '') {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });

    req.on('error', reject);
  });
}

function sendJson(res, statusCode, body) {
  const json = JSON.stringify(body);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(json);
}
