import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ChatTurn, GeminiClient } from "./client";
import { faqSystem } from "./prompts";
import { env } from "../config/env";
import { courses } from "../db/repo";
import { formatINR } from "../util/money";
import { createLogger } from "../util/logger";

const log = createLogger("ai:faq");

interface FaqFile {
  about?: string;
  facts?: string[];
  qa?: { q: string; a: string }[];
}

let faqFile: FaqFile = {};
try {
  faqFile = JSON.parse(readFileSync(fileURLToPath(new URL("../data/faq.json", import.meta.url)), "utf8")) as FaqFile;
} catch {
  log.warn("data/faq.json not found — FAQ grounding limited to course data");
}

async function buildGrounding(): Promise<string> {
  const lines: string[] = [];
  if (faqFile.about) lines.push(faqFile.about);
  for (const f of faqFile.facts ?? []) lines.push("• " + f);

  const list = await courses.listActive();
  if (list.length) {
    lines.push("\nCOURSES OFFERED:");
    for (const c of list) {
      const bits = [`Fee ${formatINR(c.feeInPaise)}`];
      if (c.batchInfo) bits.push(c.batchInfo);
      if (c.facultyName) bits.push("Faculty: " + c.facultyName);
      lines.push(`• ${c.name} — ${bits.join(", ")}`);
    }
  }

  if (faqFile.qa?.length) {
    lines.push("\nFREQUENTLY ASKED:");
    for (const qa of faqFile.qa) lines.push(`Q: ${qa.q}\nA: ${qa.a}`);
  }
  return lines.join("\n");
}

export interface FaqAnswer {
  answer: string;
  needsHuman: boolean;
}

export async function answerFaq(ai: GeminiClient, question: string, history: ChatTurn[] = []): Promise<FaqAnswer> {
  const grounding = await buildGrounding();
  const raw = (await ai.generateText({ system: faqSystem(env.INSTITUTE_NAME, grounding), prompt: question, history })).trim();
  if (!raw || raw.toUpperCase().includes("ESCALATE")) return { answer: "", needsHuman: true };
  return { answer: raw, needsHuman: false };
}
