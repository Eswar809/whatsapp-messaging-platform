import type { GeminiClient } from "./client";
import { intentSchema, intentSystem, triageSchema, triageSystem } from "./prompts";
import type { Difficulty } from "../config/constants";
import { AI_INTENTS, type Intent } from "../core/intents";

export interface DoubtClass {
  subject: string;
  difficulty: Difficulty;
  isComplex: boolean;
  summary: string;
}

export async function classifyDoubt(ai: GeminiClient, text: string): Promise<DoubtClass> {
  return ai.generateJson<DoubtClass>({
    system: triageSystem,
    prompt: `Student doubt: "${text}"`,
    schema: triageSchema,
    fallback: { subject: "General", difficulty: "MEDIUM", isComplex: false, summary: text.slice(0, 140) },
  });
}

export async function classifyIntent(ai: GeminiClient, text: string): Promise<{ intent: Intent; confidence: number }> {
  const res = await ai.generateJson<{ intent: string; confidence: number }>({
    system: intentSystem,
    prompt: `Message: "${text}"`,
    schema: intentSchema,
    fallback: { intent: "FAQ", confidence: 0 },
  });
  const intent = (AI_INTENTS as readonly string[]).includes(res.intent) ? (res.intent as Intent) : "UNKNOWN";
  return { intent, confidence: typeof res.confidence === "number" ? res.confidence : 0 };
}
