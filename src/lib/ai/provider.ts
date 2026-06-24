import "server-only"

import { google } from "@ai-sdk/google"

/**
 * AI provider resolution. Default model is a cheap multimodal Gemini (serves both
 * document OCR and reasoning). The model is swappable via env so a Claude/other
 * provider can be wired later (§4 provider abstraction) without touching callers.
 */
export const AI_MODEL = process.env.AI_MODEL ?? "gemini-2.5-flash"

/** True when an AI key is configured; AI features degrade gracefully otherwise. */
export function hasAiKey(): boolean {
  return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY)
}

/** The configured language model instance for AI SDK calls. */
export function aiModel() {
  return google(AI_MODEL)
}
