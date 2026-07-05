import type { Feature } from "./plans"

/** Human-readable SK labels for gated features (shared: landing, billing UI, paywall). */
export const FEATURE_LABELS: Record<Feature, string> = {
  aiCapture: "AI vyťaženie dokladov",
  nlInvoice: "Fakturácia vetou",
  assistant: "AI asistent",
  smartReminders: "Inteligentné upomienky",
  forecast: "Prognózy cash-flow",
  anomaly: "Detekcia anomálií",
  multiUser: "Viac používateľov",
  peppolSend: "Odosielanie e-faktúr (Peppol)",
  advancedReports: "Pokročilé reporty",
  api: "Prístup k API",
}

export function featureLabel(feature: string): string {
  return FEATURE_LABELS[feature as Feature] ?? feature
}
