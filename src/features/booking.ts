import type { Session } from "@prisma/client";
import type { Ctx } from "../core/bot";
import type { Action } from "../util/ids";
import { encodeAction } from "../util/ids";
import { msg } from "../whatsapp/msg";
import { BookingStatus, BookingType, D, FlowName } from "../config/constants";
import { bookings, mentors, sessions } from "../db/repo";
import { formatSlot, formatSlotShort } from "../util/time";

interface Slot {
  start: string;
  end: string;
}
interface BookingScratch {
  type?: BookingType;
  slots?: Slot[];
  chosen?: Slot;
}

const safeParse = (s: string): BookingScratch => {
  try {
    return JSON.parse(s) as BookingScratch;
  } catch {
    return {};
  }
};

/** Next 3 slots: tomorrow..+3 days at 5:00 PM IST (17:00 IST = 11:30 UTC), 30 min each. */
function buildSlots(): { start: Date; end: Date }[] {
  const out: { start: Date; end: Date }[] = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + i);
    d.setUTCHours(11, 30, 0, 0);
    out.push({ start: new Date(d), end: new Date(d.getTime() + 30 * 60_000) });
  }
  return out;
}

export async function startBooking(ctx: Ctx, type: BookingType = BookingType.DEMO) {
  const slots = buildSlots();
  await sessions.start(ctx.student.id, FlowName.BOOKING, "PICK_SLOT", {
    type,
    slots: slots.map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString() })),
  });
  return ctx.reply(
    msg.buttons(
      `Great! Let's book your ${type === BookingType.ONE_TO_ONE ? "1:1 session" : "free demo class"}. 🎬\nPick a slot that works for you:`,
      slots.map((s, i) => ({ id: encodeAction(D.BOOK, "slot", i), title: formatSlotShort(s.start) })),
    ),
  );
}

export async function onBookingAction(ctx: Ctx, action: Action) {
  if (action.action === "start") {
    const type = action.args[0] === BookingType.ONE_TO_ONE ? BookingType.ONE_TO_ONE : BookingType.DEMO;
    return startBooking(ctx, type);
  }

  const session = await sessions.getActive(ctx.student.id);
  const scratch = session ? safeParse(session.scratch) : {};
  const type = scratch.type ?? BookingType.DEMO;

  if (action.action === "slot") {
    const idx = Number(action.args[0]);
    const slot = scratch.slots?.[idx];
    if (!slot) return startBooking(ctx, type); // stale buttons -> restart
    await sessions.update(ctx.student.id, { step: "CONFIRM", scratch: { ...scratch, chosen: slot } });
    return ctx.reply(
      msg.buttons(
        `Please confirm your ${type === BookingType.ONE_TO_ONE ? "1:1 session" : "demo class"}:\n\n🗓️ *${formatSlot(new Date(slot.start), new Date(slot.end))}*`,
        [
          { id: encodeAction(D.BOOK, "confirm"), title: "✅ Confirm" },
          { id: encodeAction(D.BOOK, "cancel"), title: "❌ Cancel" },
        ],
      ),
    );
  }

  if (action.action === "cancel") {
    await sessions.clear(ctx.student.id);
    return ctx.reply(msg.text("No problem — cancelled. Type *menu* whenever you're ready. 😊"));
  }

  if (action.action === "confirm") {
    const chosen = scratch.chosen;
    if (!chosen) return startBooking(ctx, type);
    const start = new Date(chosen.start);
    const end = new Date(chosen.end);
    const mentor = (await mentors.listActive())[0] ?? null;

    const evt = await ctx.bot.calendar.createEvent({
      calendarId: mentor?.calendarId ?? undefined,
      summary: `${type === BookingType.ONE_TO_ONE ? "1:1 Session" : "Demo Class"} — ${ctx.student.name ?? ctx.student.waId}`,
      description: `Booked via WhatsApp bot.\nStudent: ${ctx.student.name ?? "—"} (+${ctx.student.waId})\nCourse interest: ${ctx.student.courseInterest ?? "n/a"}`,
      start,
      end,
    });

    await bookings.create({
      studentId: ctx.student.id,
      mentorId: mentor?.id,
      type,
      status: evt.eventId ? BookingStatus.CONFIRMED : BookingStatus.REQUESTED,
      slotStart: start,
      slotEnd: end,
      calendarEventId: evt.eventId,
      meetLink: evt.meetLink,
    });
    await sessions.clear(ctx.student.id);

    const lines = [
      `✅ *Booked!* Your ${type === BookingType.ONE_TO_ONE ? "1:1 session" : "demo class"} is confirmed for:`,
      `🗓️ *${formatSlot(start, end)}*`,
    ];
    if (evt.meetLink) lines.push(`\n🔗 Join here: ${evt.meetLink}`);
    if (mentor) lines.push(`\n👤 With: *${mentor.name}*`);
    lines.push("\nSee you there! Type *menu* for more.");
    return ctx.reply(msg.text(lines.join("\n")));
  }

  return startBooking(ctx, type);
}

export async function onBookingText(ctx: Ctx, _session: Session) {
  return ctx.reply(msg.text("Please tap a slot button above to continue, or type *cancel* to exit. 🙂"));
}
