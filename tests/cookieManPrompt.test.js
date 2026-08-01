import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { COOKIE_MAN_INSTRUCTIONS } from '../src/cookieMan/cookieManPrompt.js';

// These tests intentionally check for a handful of thematically important
// keywords/phrases rather than asserting exact wording — the goal is to
// guard against regressing the persona's meaningful requirements (e.g.
// silently drifting back into generic-assistant tone) while still leaving
// room to freely tune the actual prose.
describe('COOKIE_MAN_INSTRUCTIONS persona', () => {
  it('is a non-empty string', () => {
    assert.equal(typeof COOKIE_MAN_INSTRUCTIONS, 'string');
    assert.ok(COOKIE_MAN_INSTRUCTIONS.trim().length > 0);
  });

  it('still centers the Cookie Man / Cookie Bureau world-building', () => {
    const lower = COOKIE_MAN_INSTRUCTIONS.toLowerCase();
    assert.ok(lower.includes('cookie man'));
    assert.ok(lower.includes('cookie bureau'));
  });

  it('explicitly steers away from a generic AI-assistant/customer-service tone', () => {
    const lower = COOKIE_MAN_INSTRUCTIONS.toLowerCase();
    assert.ok(
      lower.includes('not an assistant') || lower.includes('helpful ai') || lower.includes('customer service'),
      'persona should explicitly warn against sounding like a generic AI assistant',
    );
  });

  it('discourages numbered lists/bullets unless they are the joke', () => {
    const lower = COOKIE_MAN_INSTRUCTIONS.toLowerCase();
    assert.ok(lower.includes('numbered list') || lower.includes('bullet'));
  });

  it('asks for short, SMS-appropriate replies', () => {
    const lower = COOKIE_MAN_INSTRUCTIONS.toLowerCase();
    assert.ok(lower.includes('sms') || lower.includes('short'));
  });
});
