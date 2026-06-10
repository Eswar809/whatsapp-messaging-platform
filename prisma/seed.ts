import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const load = <T>(name: string): T =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../src/data/${name}`, import.meta.url)), "utf8")) as T;

interface CourseSeed {
  slug: string;
  name: string;
  feeInPaise: number;
  description?: string;
  batchInfo?: string;
  facultyName?: string;
  brochureUrl?: string | null;
  priceList?: string;
}
interface MentorSeed { name: string; waNumber: string; subjects: string; calendarId?: string | null }
interface McqSeed { subject: string; difficulty?: string; question: string; options: string[]; correctIndex: number; explanation: string }

async function main() {
  const courses = load<CourseSeed[]>("courses.json");
  for (const c of courses) {
    const data = {
      name: c.name,
      feeInPaise: c.feeInPaise,
      description: c.description ?? null,
      batchInfo: c.batchInfo ?? null,
      facultyName: c.facultyName ?? null,
    };
    const course = await prisma.course.upsert({ where: { slug: c.slug }, create: { slug: c.slug, ...data }, update: data });
    const existing = await prisma.brochure.findFirst({ where: { courseId: course.id } });
    if (!existing) {
      await prisma.brochure.create({
        data: { courseId: course.id, title: `${c.name} Brochure`, link: c.brochureUrl ?? null, priceList: c.priceList ?? null },
      });
    }
  }
  console.log(`✔ courses: ${courses.length}`);

  if ((await prisma.mentor.count()) === 0) {
    const mentors = load<MentorSeed[]>("mentors.json");
    for (const m of mentors) {
      await prisma.mentor.create({ data: { name: m.name, waNumber: m.waNumber, subjects: m.subjects, calendarId: m.calendarId ?? null } });
    }
    console.log(`✔ mentors: ${mentors.length}`);
  } else {
    console.log("• mentors already present — skipped");
  }

  if ((await prisma.mcqQuestion.count()) === 0) {
    const mcqs = load<McqSeed[]>("mcq.seed.json");
    for (const q of mcqs) {
      await prisma.mcqQuestion.create({
        data: {
          subject: q.subject,
          difficulty: q.difficulty ?? "MEDIUM",
          question: q.question,
          options: JSON.stringify(q.options),
          correctIndex: q.correctIndex,
          explanation: q.explanation,
        },
      });
    }
    console.log(`✔ MCQ questions: ${mcqs.length}`);
  } else {
    console.log("• MCQ questions already present — skipped");
  }

  console.log("✅ Seed complete");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
