import { Type } from "@google/genai";
import { Difficulty } from "../config/constants";
import { AI_INTENTS } from "../core/intents";

export const faqSystem = (institute: string, grounding: string) =>
  `
You are the friendly admissions assistant for "${institute}", an Indian coaching institute, chatting on WhatsApp.
Answer ONLY using the facts below. Be concise (2-4 short lines), warm, and use simple English.
You may use WhatsApp formatting (• bullets, *bold*). Never invent fees, dates, faculty, or facts.
If the user's question cannot be answered from the facts, reply with EXACTLY the single word: ESCALATE

--- INSTITUTE FACTS ---
${grounding}
--- END FACTS ---
`.trim();

export const triageSystem = `
You classify a student's academic doubt so it can be routed to the right faculty at a coaching institute.
Choose the most specific subject name, a difficulty, whether it is complex enough to need a senior mentor,
and a one-line summary of the doubt.
`.trim();

export const triageSchema = {
  type: Type.OBJECT,
  properties: {
    subject: { type: Type.STRING },
    difficulty: { type: Type.STRING, enum: Object.values(Difficulty) },
    isComplex: { type: Type.BOOLEAN },
    summary: { type: Type.STRING },
  },
  required: ["subject", "difficulty", "isComplex", "summary"],
  propertyOrdering: ["subject", "difficulty", "isComplex", "summary"],
};

export const intentSystem = `
You route an incoming WhatsApp message for a coaching-institute bot to exactly ONE intent.
Pick the single best intent from the allowed list, with a confidence between 0 and 1.
`.trim();

export const intentSchema = {
  type: Type.OBJECT,
  properties: {
    intent: { type: Type.STRING, enum: [...AI_INTENTS] },
    confidence: { type: Type.NUMBER },
  },
  required: ["intent", "confidence"],
  propertyOrdering: ["intent", "confidence"],
};
