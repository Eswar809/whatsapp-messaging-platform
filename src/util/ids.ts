// Single source of truth for interactive button/list ids.
// Grammar: `domain:action:arg1:arg2...` — args MUST be colon-free tokens
// (slugs, cuids, numeric indices). For things containing colons (e.g. ISO
// timestamps) store them in session scratch and reference by index instead.

import { WA_LIMITS } from "../config/constants";

export interface Action {
  domain: string;
  action: string;
  args: string[];
}

export function encodeAction(domain: string, action: string, ...args: (string | number)[]): string {
  return [domain, action, ...args.map(String)].join(":").slice(0, WA_LIMITS.BUTTON_ID);
}

export function parseAction(id: string): Action {
  const [domain = "", action = "", ...args] = id.split(":");
  return { domain, action, args };
}

export const matches = (a: Action, domain: string, action?: string) =>
  a.domain === domain && (action === undefined || a.action === action);
