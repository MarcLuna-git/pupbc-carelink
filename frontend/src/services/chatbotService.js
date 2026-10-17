import api from './api';

// The backend caps history at chatbot.max_history (10). Keep the same ceiling
// here so the widget never sends a payload the API will reject.
const MAX_HISTORY = 10;

// A chatbot reply waits on the student's record plus a Gemini call, so it can
// legitimately run well past the shared 15s instance timeout in api.js. Give
// this one request a longer budget so a slow (but healthy) reply is not
// mistaken for a connection failure.
const REQUEST_TIMEOUT_MS = 60000;

const chatbotService = {
  /**
   * Send one message plus the recent conversation to the clinic assistant.
   *
   * @param {string} message
   * @param {Array<{role: 'user'|'assistant', text: string, suggestions?: string[]}>} history
   * @returns {Promise<{reply: string, degraded: boolean, suggestions: string[], symptom: object|null, triage: object|null, recommendation: string|null}>}
   */
  async sendMessage(message, history = []) {
    const response = await api.post(
      '/student/chatbot/message',
      {
        message,
        history: history.slice(-MAX_HISTORY),
      },
      { timeout: REQUEST_TIMEOUT_MS }
    );

    const body = response.data;
    const suggestions = Array.isArray(body?.data?.suggestions)
      ? body.data.suggestions.filter((item) => typeof item === 'string' && item.trim() !== '')
      : [];

    return {
      reply: body?.data?.reply ?? '',
      degraded: Boolean(body?.data?.degraded),
      suggestions,
      // Symptom categorization + triage (null when the message was not about
      // the student's own symptoms, or when the reply was degraded).
      symptom: body?.data?.symptom ?? null,
      triage: body?.data?.triage ?? null,
      recommendation: body?.data?.recommendation ?? null,
    };
  },
};

export default chatbotService;
