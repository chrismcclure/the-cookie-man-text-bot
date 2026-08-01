// Single source of truth for which OpenAI model the app talks to. Change it
// here rather than scattering model names through providers/tests.
//
// gpt-5.6-luna is OpenAI's current fastest/most cost-efficient model
// (see https://developers.openai.com/api/docs/models). The Cookie Man's
// replies are short, SMS-style conversational text with no need for deep
// reasoning, tool use, or long-context handling, so Luna's latency/cost
// profile fits better than the flagship Sol or mid-tier Terra models.
// Overridable via env var for local experimentation without a code change.
export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
