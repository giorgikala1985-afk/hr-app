const { GoogleGenerativeAI } = require('@google/generative-ai');

// Overridable via env in case a newer/cheaper model name becomes available
// without needing a code change.
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

// Returns null (not a thrown error) when no key is configured, so callers can
// give a clear "not configured" message instead of a confusing SDK error.
function getGeminiModel(options = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: MODEL_NAME, ...options });
}

// Models are instructed to return bare JSON, but sometimes wrap it in a
// markdown code fence anyway — strip that before JSON.parse.
function stripJsonFences(text) {
  return text.trim().replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
}

module.exports = { getGeminiModel, stripJsonFences, MODEL_NAME };
