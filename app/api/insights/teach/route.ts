import { NextRequest, NextResponse } from "next/server";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { TOPICS, type Topic } from "@/lib/insights/intent-model";
import type { PeriodKind } from "@/lib/insights/periods";
import { teachIntent } from "@/lib/insights/service";

export const dynamic = "force-dynamic";

const PERIODS: PeriodKind[] = ["week", "month", "year"];
const MAX_QUESTION_CHARS = 500;

/**
 * POST /api/insights/teach
 * Body: { question: string, topic: Topic, period?: "week" | "month" | "year" }
 *
 * The user tells us what an unrecognised question was about. The phrase trains
 * this org's question model, and the reply answers on that topic.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(BROKER_ROLES);
  const body = await req.json().catch(() => ({}));
  const question = String(body.question || "").trim().slice(0, MAX_QUESTION_CHARS);
  if (!question || !TOPICS.includes(body.topic)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const rl = await checkRateLimit(user.id, {
    prefix: "insights_teach_user",
    max: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests. Try again in a while." }, { status: 429 });
  }

  const period = PERIODS.includes(body.period) ? (body.period as PeriodKind) : "month";
  return NextResponse.json(
    await teachIntent(user.orgId, question, body.topic as Topic, period, new Date(), getLocale())
  );
}
