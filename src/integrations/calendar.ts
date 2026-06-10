import crypto from "node:crypto";
import { google } from "googleapis";
import { env, flags } from "../config/env";
import type { Logger } from "../util/logger";

export interface CalendarEvent {
  eventId?: string;
  meetLink?: string;
  htmlLink?: string;
}

export interface CalendarPort {
  readonly mode: "live" | "stub";
  createEvent(opts: {
    calendarId?: string;
    summary: string;
    description: string;
    start: Date;
    end: Date;
  }): Promise<CalendarEvent>;
}

export function makeCalendar(log: Logger): CalendarPort {
  if (!flags.hasGoogleCalendar) {
    log.warn("Google Calendar creds missing — STUB mode (events only logged)");
    return stub(log);
  }
  return live(log);
}

function live(log: Logger): CalendarPort {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: env.GCAL_SA_EMAIL as string,
      private_key: (env.GCAL_SA_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  const calendar = google.calendar({ version: "v3", auth });

  return {
    mode: "live",
    async createEvent(o) {
      const calendarId = o.calendarId || env.GCAL_CALENDAR_ID;
      // NOTE: a plain service account (calendar merely shared with it) cannot invite
      // `attendees` without domain-wide delegation, so we omit attendees and instead
      // send the Meet/event link to the student over WhatsApp.
      const requestBody: Record<string, unknown> = {
        summary: o.summary,
        description: o.description,
        start: { dateTime: o.start.toISOString(), timeZone: env.TIMEZONE },
        end: { dateTime: o.end.toISOString(), timeZone: env.TIMEZONE },
      };
      if (env.GCAL_SEND_MEET_LINK) {
        requestBody.conferenceData = {
          createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } },
        };
      }
      try {
        const { data } = await calendar.events.insert({
          calendarId,
          conferenceDataVersion: env.GCAL_SEND_MEET_LINK ? 1 : 0,
          requestBody: requestBody as never,
        });
        const meetLink =
          data.hangoutLink ??
          data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ??
          undefined;
        return { eventId: data.id ?? undefined, meetLink: meetLink ?? undefined, htmlLink: data.htmlLink ?? undefined };
      } catch (e) {
        log.error("createEvent failed", String(e));
        return {};
      }
    },
  };
}

function stub(log: Logger): CalendarPort {
  return {
    mode: "stub",
    async createEvent(o) {
      log.info(`[STUB calendar] "${o.summary}" @ ${o.start.toISOString()}`);
      return { eventId: `stub_evt_${Date.now()}`, meetLink: "https://meet.google.com/stub-demo-link" };
    },
  };
}
