// Concise constructors for OutboundMessage so feature code stays readable.
import type { ListSection, OutboundMessage, ReplyButton, TemplateSpec } from "./types";

export const msg = {
  text: (body: string, template?: TemplateSpec): OutboundMessage => ({ kind: "text", body, ...(template ? { template } : {}) }),

  buttons: (
    body: string,
    buttons: ReplyButton[],
    opts?: { header?: string; footer?: string; template?: TemplateSpec },
  ): OutboundMessage => ({ kind: "buttons", body, buttons, ...opts }),

  list: (
    body: string,
    buttonLabel: string,
    sections: ListSection[],
    opts?: { header?: string; footer?: string; template?: TemplateSpec },
  ): OutboundMessage => ({ kind: "list", body, buttonLabel, sections, ...opts }),

  document: (o: { link?: string; mediaId?: string; filename: string; caption?: string }): OutboundMessage => ({
    kind: "document",
    ...o,
  }),

  image: (o: { link?: string; mediaId?: string; caption?: string }): OutboundMessage => ({ kind: "image", ...o }),

  template: (template: TemplateSpec): OutboundMessage => ({ kind: "template", template }),
};
