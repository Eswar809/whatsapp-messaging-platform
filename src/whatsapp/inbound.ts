import type { ParsedInbound, WAMessage, WAStatus, WAWebhookBody } from "./types";

/** Flatten a raw webhook body into normalised inbound messages + delivery statuses. */
export function parseWebhook(body: WAWebhookBody): { inbound: ParsedInbound[]; statuses: WAStatus[] } {
  const inbound: ParsedInbound[] = [];
  const statuses: WAStatus[] = [];

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value;
      if (!v) continue;

      for (const s of v.statuses ?? []) statuses.push(s);

      const nameByWaId = new Map<string, string>();
      for (const c of v.contacts ?? []) {
        if (c.wa_id && c.profile?.name) nameByWaId.set(c.wa_id, c.profile.name);
      }

      for (const m of v.messages ?? []) {
        inbound.push(normalize(m, nameByWaId.get(m.from)));
      }
    }
  }

  return { inbound, statuses };
}

function normalize(m: WAMessage, name?: string): ParsedInbound {
  const base = {
    waId: m.from,
    name: name || undefined,
    messageId: m.id,
    timestamp: new Date(Number(m.timestamp) * 1000),
    raw: m,
  };

  switch (m.type) {
    case "text":
      return { ...base, kind: "text", text: m.text?.body ?? "" };
    case "interactive": {
      const r = m.interactive?.button_reply ?? m.interactive?.list_reply;
      return { ...base, kind: "interactive", replyId: r?.id, text: r?.title };
    }
    case "button": // quick-reply button on an approved template
      return { ...base, kind: "interactive", replyId: m.button?.payload, text: m.button?.text };
    case "image":
    case "document":
    case "audio":
    case "video":
      return { ...base, kind: "media", text: m.image?.caption ?? m.document?.caption ?? m.video?.caption };
    default:
      return { ...base, kind: "other" };
  }
}
