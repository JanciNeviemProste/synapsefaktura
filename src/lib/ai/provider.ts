import "server-only"

import { google } from "@ai-sdk/google"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"

/**
 * AI provider resolution (§4 provider abstraction). Two supported backends,
 * resolved by which key is present — OpenRouter wins when both are set:
 *  - OPENROUTER_API_KEY → OpenRouter (model ids like "google/gemini-2.5-flash")
 *  - GOOGLE_GENERATIVE_AI_API_KEY → Google direct (model ids like "gemini-2.5-flash")
 * Default models are cheap multimodal Gemini variants so document OCR works on
 * both backends. Override via AI_MODEL (use the id format of the active backend).
 */
const OPENROUTER_DEFAULT_MODEL = "google/gemini-2.5-flash"
const GOOGLE_DEFAULT_MODEL = "gemini-2.5-flash"

function hasOpenRouter(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY)
}

export const AI_MODEL =
  process.env.AI_MODEL ??
  (process.env.OPENROUTER_API_KEY
    ? OPENROUTER_DEFAULT_MODEL
    : GOOGLE_DEFAULT_MODEL)

/** Which backend `aiModel()` will use — provider options are keyed by it. */
export function aiBackend(): "openrouter" | "google" {
  return hasOpenRouter() ? "openrouter" : "google"
}

/** True when an AI key is configured; AI features degrade gracefully otherwise. */
export function hasAiKey(): boolean {
  return hasOpenRouter() || Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY)
}

/** The configured language model instance for AI SDK calls. */
export function aiModel() {
  if (hasOpenRouter()) {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    })
    return openrouter(AI_MODEL)
  }
  return google(AI_MODEL)
}
