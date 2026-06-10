// ---------------------------------------------------------------------------
// Inbound (raw Meta webhook payload)
// ---------------------------------------------------------------------------

export interface WAWebhookBody {
  object?: string;
  entry?: WAEntry[];
}
export interface WAEntry {
  id?: string;
  changes?: WAChange[];
}
export interface WAChange {
  field?: string;
  value?: WAValue;
}
export interface WAValue {
  messaging_product?: string;
  metadata?: { display_phone_number?: string; phone_number_id?: string };
  contacts?: WAContact[];
  messages?: WAMessage[];
  statuses?: WAStatus[];
}
export interface WAContact {
  profile?: { name?: string };
  wa_id?: string;
}
export interface WAMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  button?: { text?: string; payload?: string }; // template quick-reply
  interactive?: {
    type: "button_reply" | "list_reply";
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  image?: { id?: string; caption?: string };
  document?: { id?: string; filename?: string; caption?: string };
  audio?: { id?: string };
  video?: { id?: string; caption?: string };
}
export interface WAStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed" | string;
  timestamp: string;
  recipient_id: string;
  errors?: { code?: number; title?: string; message?: string }[];
}

// ---------------------------------------------------------------------------
// Normalised inbound used across the app
// ---------------------------------------------------------------------------

export type InboundKind = "text" | "interactive" | "media" | "other";

export interface ParsedInbound {
  waId: string;
  name?: string;
  messageId: string;
  timestamp: Date;
  kind: InboundKind;
  text?: string; // text body, or interactive reply title (for logging)
  replyId?: string; // interactive button/list id, or template button payload
  raw: WAMessage;
}

// ---------------------------------------------------------------------------
// Outbound
// ---------------------------------------------------------------------------

export interface TemplateSpec {
  name: string;
  lang: string;
  bodyParams?: string[];
}
export interface ReplyButton {
  id: string;
  title: string;
}
export interface ListRow {
  id: string;
  title: string;
  description?: string;
}
export interface ListSection {
  title?: string;
  rows: ListRow[];
}

// `template` on free-form kinds is the fallback used if sent outside the 24h window.
export type OutboundMessage =
  | { kind: "text"; body: string; template?: TemplateSpec }
  | { kind: "buttons"; body: string; buttons: ReplyButton[]; header?: string; footer?: string; template?: TemplateSpec }
  | { kind: "list"; body: string; buttonLabel: string; sections: ListSection[]; header?: string; footer?: string; template?: TemplateSpec }
  | { kind: "document"; link?: string; mediaId?: string; filename: string; caption?: string; template?: TemplateSpec }
  | { kind: "image"; link?: string; mediaId?: string; caption?: string; template?: TemplateSpec }
  | { kind: "template"; template: TemplateSpec };

export interface SendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
}
