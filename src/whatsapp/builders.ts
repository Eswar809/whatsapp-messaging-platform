import { WA_LIMITS } from "../config/constants";
import type { OutboundMessage } from "./types";

const clamp = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/** Convert a high-level OutboundMessage into a Graph API request body (limits enforced). */
export function toGraphPayload(to: string, msg: OutboundMessage): Record<string, unknown> {
  const base = { messaging_product: "whatsapp", recipient_type: "individual", to };

  switch (msg.kind) {
    case "text":
      return { ...base, type: "text", text: { preview_url: true, body: clamp(msg.body, WA_LIMITS.TEXT) } };

    case "buttons":
      return {
        ...base,
        type: "interactive",
        interactive: {
          type: "button",
          ...(msg.header ? { header: { type: "text", text: clamp(msg.header, 60) } } : {}),
          body: { text: clamp(msg.body, WA_LIMITS.BODY_TEXT) },
          ...(msg.footer ? { footer: { text: clamp(msg.footer, 60) } } : {}),
          action: {
            buttons: msg.buttons.slice(0, WA_LIMITS.BUTTONS).map((b) => ({
              type: "reply",
              reply: { id: b.id.slice(0, WA_LIMITS.BUTTON_ID), title: clamp(b.title, WA_LIMITS.BUTTON_TITLE) },
            })),
          },
        },
      };

    case "list": {
      let budget = WA_LIMITS.LIST_ROWS;
      const sections = msg.sections
        .map((sec) => {
          const rows = sec.rows.slice(0, Math.max(0, budget)).map((r) => ({
            id: r.id.slice(0, WA_LIMITS.BUTTON_ID),
            title: clamp(r.title, WA_LIMITS.LIST_ROW_TITLE),
            ...(r.description ? { description: clamp(r.description, WA_LIMITS.LIST_ROW_DESC) } : {}),
          }));
          budget -= rows.length;
          return { ...(sec.title ? { title: clamp(sec.title, WA_LIMITS.LIST_ROW_TITLE) } : {}), rows };
        })
        .filter((s) => s.rows.length > 0);
      return {
        ...base,
        type: "interactive",
        interactive: {
          type: "list",
          ...(msg.header ? { header: { type: "text", text: clamp(msg.header, 60) } } : {}),
          body: { text: clamp(msg.body, WA_LIMITS.BODY_TEXT) },
          ...(msg.footer ? { footer: { text: clamp(msg.footer, 60) } } : {}),
          action: { button: clamp(msg.buttonLabel, WA_LIMITS.BUTTON_TITLE), sections },
        },
      };
    }

    case "document":
      return {
        ...base,
        type: "document",
        document: {
          ...(msg.mediaId ? { id: msg.mediaId } : { link: msg.link }),
          filename: msg.filename,
          ...(msg.caption ? { caption: msg.caption } : {}),
        },
      };

    case "image":
      return {
        ...base,
        type: "image",
        image: { ...(msg.mediaId ? { id: msg.mediaId } : { link: msg.link }), ...(msg.caption ? { caption: msg.caption } : {}) },
      };

    case "template":
      return {
        ...base,
        type: "template",
        template: {
          name: msg.template.name,
          language: { code: msg.template.lang },
          ...(msg.template.bodyParams && msg.template.bodyParams.length
            ? { components: [{ type: "body", parameters: msg.template.bodyParams.map((text) => ({ type: "text", text })) }] }
            : {}),
        },
      };
  }
}

/** Short human-readable summary of an outbound message (for stub logging). */
export function describeOutbound(msg: OutboundMessage): string {
  switch (msg.kind) {
    case "text":
      return `text: "${clamp(msg.body, 80)}"`;
    case "buttons":
      return `buttons [${msg.buttons.map((b) => b.title).join(" | ")}] :: "${clamp(msg.body, 60)}"`;
    case "list":
      return `list (${msg.sections.reduce((n, s) => n + s.rows.length, 0)} rows) :: "${clamp(msg.body, 60)}"`;
    case "document":
      return `document ${msg.filename} (${msg.mediaId ? "mediaId" : msg.link})`;
    case "image":
      return `image (${msg.mediaId ? "mediaId" : msg.link})`;
    case "template":
      return `template ${msg.template.name} [${(msg.template.bodyParams ?? []).join(", ")}]`;
  }
}
