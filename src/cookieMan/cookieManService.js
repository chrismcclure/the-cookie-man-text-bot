import { COOKIE_MAN_INSTRUCTIONS } from './cookieManPrompt.js';

// The aiProvider dependency only needs to satisfy this shape:
//   generateReply({ instructions, message }) => Promise<string>
// Keeping it duck-typed (rather than a class/interface) is enough to let
// tests substitute a fake and to swap the OpenAI implementation later.
export class CookieManService {
  #aiProvider;

  constructor({ aiProvider }) {
    if (!aiProvider) {
      throw new Error('CookieManService requires an aiProvider');
    }
    this.#aiProvider = aiProvider;
  }

  async respond(userMessage) {
    if (typeof userMessage !== 'string' || userMessage.trim() === '') {
      throw new Error('userMessage must be a non-empty string');
    }

    return this.#aiProvider.generateReply({
      instructions: COOKIE_MAN_INSTRUCTIONS,
      message: userMessage,
    });
  }
}
