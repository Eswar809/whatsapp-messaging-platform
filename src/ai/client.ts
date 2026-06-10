import { GoogleGenAI } from "@google/genai";
import { env, flags } from "../config/env";
import { createLogger, type Logger } from "../util/logger";

export interface ChatTurn {
  role: "user" | "model";
  text: string;
}
export interface GenTextOpts {
  system?: string;
  prompt: string;
  history?: ChatTurn[];
  maxTokens?: number;
}
export interface GenJsonOpts<T> {
  system?: string;
  prompt: string;
  schema: unknown;
  fallback: T;
  maxTokens?: number;
}

export interface GeminiClient {
  readonly mode: "live" | "stub";
  generateText(opts: GenTextOpts): Promise<string>;
  generateJson<T>(opts: GenJsonOpts<T>): Promise<T>;
}

export function makeGeminiClient(log: Logger = createLogger("ai")): GeminiClient {
  return flags.hasGemini ? liveClient(log) : stubClient(log);
}

function liveClient(log: Logger): GeminiClient {
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY as string });
  const model = env.GEMINI_MODEL;

  return {
    mode: "live",
    async generateText({ system, prompt, history, maxTokens }) {
      try {
        const contents =
          history && history.length
            ? [...history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })), { role: "user", parts: [{ text: prompt }] }]
            : prompt;
        const res = await ai.models.generateContent({
          model,
          contents,
          config: { ...(system ? { systemInstruction: system } : {}), maxOutputTokens: maxTokens ?? 700 },
        });
        return res.text ?? "";
      } catch (e) {
        log.error("generateText failed", String(e));
        return "";
      }
    },

    async generateJson<T>({ system, prompt, schema, fallback, maxTokens }: GenJsonOpts<T>): Promise<T> {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            ...(system ? { systemInstruction: system } : {}),
            responseMimeType: "application/json",
            responseSchema: schema as never,
            maxOutputTokens: maxTokens ?? 400,
          },
        });
        const text = res.text;
        if (!text) return fallback;
        return JSON.parse(text) as T;
      } catch (e) {
        log.error("generateJson failed", String(e));
        return fallback;
      }
    },
  };
}

function stubClient(log: Logger): GeminiClient {
  return {
    mode: "stub",
    async generateText({ prompt }) {
      log.info(`[STUB ai.generateText] "${prompt.slice(0, 60)}..."`);
      return "Thanks for reaching out! 🙏 Our team will help you with that shortly. Meanwhile you can ask about fees, batches, faculty or timings — or type *menu* to see all options.";
    },
    async generateJson<T>({ fallback }: GenJsonOpts<T>): Promise<T> {
      return fallback;
    },
  };
}
