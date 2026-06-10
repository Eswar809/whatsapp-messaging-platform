import { prisma } from "./client";
import { DeliveryStatus, FlowName, StudentStatus, TicketStatus } from "../config/constants";
import type {
  BookingStatus,
  BookingType,
  Difficulty,
  MessageChannel,
  MessageDirection,
  PaymentStatus,
} from "../config/constants";
import { daysAgo, minutesFromNow } from "../util/time";

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------
export const students = {
  byWaId: (waId: string) => prisma.student.findUnique({ where: { waId } }),
  byId: (id: string) => prisma.student.findUnique({ where: { id } }),

  upsertByWaId: (waId: string, patch?: { name?: string }) =>
    prisma.student.upsert({
      where: { waId },
      create: { waId, name: patch?.name ?? null },
      update: patch?.name ? { name: patch.name } : {},
    }),

  touchInbound: (id: string, at: Date) => prisma.student.update({ where: { id }, data: { lastInboundAt: at } }),
  touchOutbound: (id: string, at: Date) => prisma.student.update({ where: { id }, data: { lastOutboundAt: at } }),
  setStatus: (id: string, status: StudentStatus) => prisma.student.update({ where: { id }, data: { status } }),
  setOptIn: (id: string, optedIn: boolean) =>
    prisma.student.update({
      where: { id },
      data: { optedIn, ...(optedIn ? {} : { status: StudentStatus.OPTED_OUT }) },
    }),
  setCourseInterest: (id: string, slug: string) => prisma.student.update({ where: { id }, data: { courseInterest: slug } }),
  setEnrolled: (id: string, courseId: string) =>
    prisma.student.update({ where: { id }, data: { enrolledCourseId: courseId, status: StudentStatus.ENROLLED } }),

  listActiveOptedIn: () => prisma.student.findMany({ where: { optedIn: true, status: { not: StudentStatus.OPTED_OUT } } }),

  findStaleForReengage: (days: number) =>
    prisma.student.findMany({
      where: {
        optedIn: true,
        status: { not: StudentStatus.OPTED_OUT },
        lastInboundAt: { lt: daysAgo(days) },
        reengages: { none: { sentAt: { gte: daysAgo(days) } } },
      },
    }),

  manyByIds: async (ids: string[]) => {
    const rows = await prisma.student.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, waId: true },
    });
    return new Map(rows.map((r) => [r.id, r.name ?? r.waId] as const));
  },
};

// ---------------------------------------------------------------------------
// Conversation log (mentor context + AI history + idempotency)
// ---------------------------------------------------------------------------
export const conversation = {
  append: (data: {
    studentId: string;
    direction: MessageDirection;
    type: string;
    body: string;
    channel?: MessageChannel;
    waMessageId?: string;
  }) =>
    prisma.conversationMessage.create({
      data: {
        studentId: data.studentId,
        direction: data.direction,
        type: data.type,
        body: data.body.slice(0, 4000),
        channel: data.channel ?? null,
        waMessageId: data.waMessageId ?? null,
      },
    }),

  seenMessage: async (waMessageId: string) =>
    Boolean(await prisma.conversationMessage.findUnique({ where: { waMessageId } })),

  recent: (studentId: string, take = 8) =>
    prisma.conversationMessage
      .findMany({ where: { studentId }, orderBy: { createdAt: "desc" }, take })
      .then((rows) => rows.reverse()),
};

// ---------------------------------------------------------------------------
// Sessions (multi-step flow state)
// ---------------------------------------------------------------------------
export const sessions = {
  getActive: async (studentId: string) => {
    const s = await prisma.session.findUnique({ where: { studentId } });
    if (!s || s.flow === FlowName.NONE) return null;
    if (s.expiresAt && s.expiresAt.getTime() < Date.now()) {
      await sessions.clear(studentId);
      return null;
    }
    return s;
  },
  start: (studentId: string, flow: FlowName, step: string, scratch: Record<string, unknown> = {}) =>
    prisma.session.upsert({
      where: { studentId },
      create: { studentId, flow, step, scratch: JSON.stringify(scratch), expiresAt: minutesFromNow(30) },
      update: { flow, step, scratch: JSON.stringify(scratch), expiresAt: minutesFromNow(30) },
    }),
  update: (studentId: string, patch: { step?: string; scratch?: Record<string, unknown> }) =>
    prisma.session.update({
      where: { studentId },
      data: {
        ...(patch.step !== undefined ? { step: patch.step } : {}),
        ...(patch.scratch !== undefined ? { scratch: JSON.stringify(patch.scratch) } : {}),
        expiresAt: minutesFromNow(30),
      },
    }),
  clear: (studentId: string) =>
    prisma.session.upsert({
      where: { studentId },
      create: { studentId, flow: FlowName.NONE },
      update: { flow: FlowName.NONE, step: "", scratch: "{}", expiresAt: null },
    }),
};

// ---------------------------------------------------------------------------
// MCQ
// ---------------------------------------------------------------------------
export const mcq = {
  nextUnseen: (studentId: string) =>
    prisma.mcqQuestion.findFirst({ where: { active: true, deliveries: { none: { studentId } } }, orderBy: { id: "asc" } }),
  questionById: (id: string) => prisma.mcqQuestion.findUnique({ where: { id } }),
  recordDelivery: (studentId: string, questionId: string, status: DeliveryStatus) =>
    prisma.mcqDelivery.upsert({
      where: { studentId_questionId: { studentId, questionId } },
      create: { studentId, questionId, status },
      update: { status },
    }),
  getDelivery: (studentId: string, questionId: string) =>
    prisma.mcqDelivery.findUnique({ where: { studentId_questionId: { studentId, questionId } } }),
  attemptByDelivery: (deliveryId: string) => prisma.mcqAttempt.findUnique({ where: { deliveryId } }),
  pendingDelivery: (studentId: string) =>
    prisma.mcqDelivery.findFirst({
      where: { studentId, attempt: { is: null } },
      orderBy: { sentAt: "desc" },
      include: { question: true },
    }),
  recordAttempt: (data: {
    deliveryId: string;
    studentId: string;
    questionId: string;
    chosenIndex: number;
    correct: boolean;
    points: number;
    isoYearWeek: string;
  }) => prisma.mcqAttempt.create({ data }),
};

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------
export const leaderboard = {
  standings: async (isoYearWeek: string) => {
    const rows = await prisma.mcqAttempt.groupBy({
      by: ["studentId"],
      where: { isoYearWeek },
      _sum: { points: true },
      orderBy: { _sum: { points: "desc" } },
    });
    return rows.map((r, i) => ({ rank: i + 1, studentId: r.studentId, points: r._sum.points ?? 0 }));
  },
  snapshotWeek: (isoYearWeek: string, rows: { studentId: string; rank: number; points: number }[]) =>
    prisma.$transaction(
      rows.map((r) =>
        prisma.leaderboardSnapshot.upsert({
          where: { isoYearWeek_studentId: { isoYearWeek, studentId: r.studentId } },
          create: { isoYearWeek, studentId: r.studentId, rank: r.rank, points: r.points },
          update: { rank: r.rank, points: r.points },
        }),
      ),
    ),
};

// ---------------------------------------------------------------------------
// Catalogue: courses / brochures / mentors
// ---------------------------------------------------------------------------
export const courses = {
  listActive: () => prisma.course.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  bySlug: (slug: string) => prisma.course.findUnique({ where: { slug } }),
  byId: (id: string) => prisma.course.findUnique({ where: { id } }),
};

export const brochures = {
  forCourse: (courseId: string) => prisma.brochure.findFirst({ where: { courseId } }),
};

export const mentors = {
  listActive: () => prisma.mentor.findMany({ where: { active: true } }),
  forSubject: async (subject: string) => {
    const all = await prisma.mentor.findMany({ where: { active: true } });
    const s = subject.toLowerCase().trim();
    const match = all.find((m) =>
      m.subjects
        .toLowerCase()
        .split(",")
        .map((x) => x.trim())
        .some((sub) => sub.length > 0 && (s.includes(sub) || sub.includes(s))),
    );
    return match ?? all[0] ?? null;
  },
};

// ---------------------------------------------------------------------------
// Tickets / bookings / payments
// ---------------------------------------------------------------------------
export const tickets = {
  create: (data: {
    studentId: string;
    subject: string;
    difficulty: Difficulty;
    question: string;
    mentorId?: string;
    status?: TicketStatus;
  }) =>
    prisma.doubtTicket.create({
      data: {
        studentId: data.studentId,
        subject: data.subject,
        difficulty: data.difficulty,
        question: data.question,
        mentorId: data.mentorId ?? null,
        status: data.status ?? TicketStatus.OPEN,
      },
    }),
};

export const bookings = {
  create: (data: {
    studentId: string;
    mentorId?: string;
    type: BookingType;
    status: BookingStatus;
    slotStart: Date;
    slotEnd: Date;
    calendarEventId?: string;
    meetLink?: string;
  }) =>
    prisma.booking.create({
      data: {
        studentId: data.studentId,
        mentorId: data.mentorId ?? null,
        type: data.type,
        status: data.status,
        slotStart: data.slotStart,
        slotEnd: data.slotEnd,
        calendarEventId: data.calendarEventId ?? null,
        meetLink: data.meetLink ?? null,
      },
    }),
};

export const payments = {
  create: (data: {
    studentId: string;
    courseId?: string;
    amountInPaise: number;
    status?: PaymentStatus;
    razorpayLinkId?: string;
    shortUrl?: string;
  }) =>
    prisma.payment.create({
      data: {
        studentId: data.studentId,
        courseId: data.courseId ?? null,
        amountInPaise: data.amountInPaise,
        status: data.status ?? "CREATED",
        razorpayLinkId: data.razorpayLinkId ?? null,
        shortUrl: data.shortUrl ?? null,
      },
    }),
  byLinkId: (razorpayLinkId: string) => prisma.payment.findUnique({ where: { razorpayLinkId } }),
  updateStatusByLinkId: (razorpayLinkId: string, status: PaymentStatus, paidAt?: Date) =>
    prisma.payment.updateMany({ where: { razorpayLinkId }, data: { status, ...(paidAt ? { paidAt } : {}) } }),
};

// ---------------------------------------------------------------------------
// Broadcasts / re-engagement
// ---------------------------------------------------------------------------
export const broadcasts = {
  createJob: (data: { type?: string; templateName: string; note?: string }) =>
    prisma.broadcastJob.create({
      data: { type: data.type ?? "RESULT_BLAST", templateName: data.templateName, note: data.note ?? null },
    }),
  addRecipient: (data: { jobId: string; studentId: string; status: DeliveryStatus; error?: string }) =>
    prisma.broadcastRecipient.upsert({
      where: { jobId_studentId: { jobId: data.jobId, studentId: data.studentId } },
      create: { jobId: data.jobId, studentId: data.studentId, status: data.status, error: data.error ?? null },
      update: { status: data.status, error: data.error ?? null },
    }),
};

export const reengagement = {
  log: (studentId: string, status: DeliveryStatus) => prisma.reengagementLog.create({ data: { studentId, status } }),
};
