// Intent taxonomy + cheap deterministic keyword matching. The AI classifier
// (ai/triage.ts) is only consulted when keyword matching is inconclusive.

export const INTENTS = [
  "GREETING",
  "FAQ",
  "BROCHURE",
  "BOOK_DEMO",
  "ENROL",
  "DOUBT",
  "MENTOR",
  "MCQ_INFO",
  "LEADERBOARD",
  "MENU",
  "STOP",
  "START",
  "UNKNOWN",
] as const;
export type Intent = (typeof INTENTS)[number];

// Subset the AI is allowed to choose from (deterministic ones excluded).
export const AI_INTENTS = [
  "GREETING",
  "FAQ",
  "BROCHURE",
  "BOOK_DEMO",
  "ENROL",
  "DOUBT",
  "MENTOR",
  "MCQ_INFO",
  "LEADERBOARD",
  "UNKNOWN",
] as const;

const RULES: [RegExp, Intent][] = [
  [/\b(stop|unsubscribe|opt\s?out)\b/i, "STOP"],
  [/\b(start|subscribe|opt\s?in)\b/i, "START"],
  [/\b(menu|options|main menu|start over|home)\b/i, "MENU"],
  [/\b(hi|hii+|hey|hello|namaste|namaskaram|good (morning|evening|afternoon))\b/i, "GREETING"],
  [/\b(brochure|pdf|prospectus|details|syllabus|course details)\b/i, "BROCHURE"],
  [/\b(book|demo|trial|free class|free session|sample class)\b/i, "BOOK_DEMO"],
  [/\b(enrol|enroll|admission|admissions|join|register|registration|pay|payment|fees? link)\b/i, "ENROL"],
  [/\b(rank|ranking|leaderboard|my score|my points|top scorer)\b/i, "LEADERBOARD"],
  [/\b(mcq|quiz|practice question|daily question|today'?s question)\b/i, "MCQ_INFO"],
  [/\b(mentor|faculty|teacher|sir|madam|talk to|speak to|call me|human|agent|counsell?or)\b/i, "MENTOR"],
  [/\b(doubt|explain|how (do|to)|solve|i don'?t understand|clarify|confused)\b/i, "DOUBT"],
  [/\b(fee|fees|price|cost|charges|timing|timings|schedule|batch|faculty|location|address)\b/i, "FAQ"],
];

export function keywordIntent(text: string): Intent | null {
  const t = text.trim();
  if (!t) return null;
  for (const [re, intent] of RULES) if (re.test(t)) return intent;
  return null;
}
