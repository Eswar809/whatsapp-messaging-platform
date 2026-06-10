// Domain "enums" as TS unions (SQLite/Prisma can't use enum types) + shared constants.

export const StudentStatus = {
  LEAD: "LEAD",
  PROSPECT: "PROSPECT",
  ACTIVE: "ACTIVE",
  ENROLLED: "ENROLLED",
  DORMANT: "DORMANT",
  OPTED_OUT: "OPTED_OUT",
} as const;
export type StudentStatus = (typeof StudentStatus)[keyof typeof StudentStatus];

export const MessageDirection = { INBOUND: "INBOUND", OUTBOUND: "OUTBOUND" } as const;
export type MessageDirection = (typeof MessageDirection)[keyof typeof MessageDirection];

// How an OUTBOUND message went out: inside 24h window (free-form) vs approved template.
export const MessageChannel = { SESSION: "SESSION", TEMPLATE: "TEMPLATE" } as const;
export type MessageChannel = (typeof MessageChannel)[keyof typeof MessageChannel];

export const Difficulty = { EASY: "EASY", MEDIUM: "MEDIUM", HARD: "HARD" } as const;
export type Difficulty = (typeof Difficulty)[keyof typeof Difficulty];

export const TicketStatus = { OPEN: "OPEN", ASSIGNED: "ASSIGNED", RESOLVED: "RESOLVED" } as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const BookingType = { DEMO: "DEMO", ONE_TO_ONE: "ONE_TO_ONE" } as const;
export type BookingType = (typeof BookingType)[keyof typeof BookingType];

export const BookingStatus = {
  REQUESTED: "REQUESTED",
  CONFIRMED: "CONFIRMED",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED",
} as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export const PaymentStatus = {
  CREATED: "CREATED",
  PENDING: "PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
  EXPIRED: "EXPIRED",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const FlowName = { NONE: "NONE", BOOKING: "BOOKING", ENROL: "ENROL" } as const;
export type FlowName = (typeof FlowName)[keyof typeof FlowName];

export const DeliveryStatus = { SENT: "SENT", FAILED: "FAILED", SKIPPED: "SKIPPED" } as const;
export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];

// Scoring: points per MCQ by difficulty.
export const POINTS: Record<Difficulty, number> = { EASY: 5, MEDIUM: 10, HARD: 15 };

// WhatsApp Cloud API limits (used by message builders).
export const WA_LIMITS = {
  BUTTONS: 3,
  LIST_ROWS: 10,
  BUTTON_TITLE: 20,
  LIST_ROW_TITLE: 24,
  LIST_ROW_DESC: 72,
  BODY_TEXT: 1024,
  TEXT: 4096,
  BUTTON_ID: 256,
} as const;

export const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 60 * 1000; // multi-step flow abandonment timeout

// Interactive button-id domains (see util/ids.ts for grammar `domain:action:...args`).
export const D = {
  MENU: "menu",
  FAQ: "faq",
  BROCHURE: "brochure",
  BOOK: "book",
  ENROL: "enrol",
  MCQ: "mcq",
  MENTOR: "mentor",
  BOARD: "board",
} as const;
