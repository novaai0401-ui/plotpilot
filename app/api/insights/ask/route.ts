import { NextRequest, NextResponse } from "next/server";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { answerQuestion } from "@/lib/insights/service";
import type { PeriodKind } from "@/lib/insights/periods";

export const dynamic = "force-dynamic";

const PERIODS: PeriodKind[] = ["week", "month", "year"];
const MAX_QUESTION_CHARS = 500;

/**
 * POST /api/insights/ask
 * Body: { question: string, period?: "week" | "month" | "year" }
 *
 * Answers from the caller's own org figures only. Spend is capped by the org's
 * monthly LLM budget; this limit just stops one user draining it.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(BROKER_ROLES);
  const body = await req.json().catch(() => ({}));
  const question = String(body.question || "").trim().slice(0, MAX_QUESTION_CHARS);
  if (!question) {
    return NextResponse.json({ error: "Ask a question first." }, { status: 400 });
  }

  const rl = await checkRateLimit(user.id, {
    prefix: "insights_ask_user",
    max: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many questions. Try again in a while." }, { status: 429 });
  }

  const period = PERIODS.includes(body.period) ? (body.period as PeriodKind) : "month";
  return NextResponse.json(await answerQuestion(user.orgId, question, period, new Date(), getLocale()));
}
