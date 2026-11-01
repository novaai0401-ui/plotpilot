import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { format } from "@/lib/i18n/dict";
import { formatDateTime } from "@/lib/i18n/format";
import { getLocale, t } from "@/lib/i18n/server";
import { buildWaMeUrl } from "@/lib/whatsapp";
import { MessageComposer } from "@/components/message-composer";

async function markVisit(formData: FormData) {
  "use server";
  const { requireUser, BROKER_ROLES } = await import("@/lib/auth/session");
  const { prisma } = await import("@/lib/db/prisma");
  const { redirect } = await import("next/navigation");
  const user = await requireUser(BROKER_ROLES);
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as any;

  const v = await prisma.visit.findFirst({ where: { id, orgId: user.orgId } });
  if (!v) return;
  await prisma.visit.update({
    where: { id },
    data: { status, feedback: String(formData.get("feedback") || "") || v.feedback },
  });
  await prisma.analyticsEvent.create({
    data: { orgId: user.orgId, type: `visit.${status}`, actorId: user.id, metadata: { visitId: id } },
  });
  redirect(`/dashboard/visits/${id}`);
}

const OUTCOMES = ["interested", "not_interested", "booked"] as const;

async function recordOutcome(formData: FormData) {
  "use server";
  const { requireUser, BROKER_ROLES } = await import("@/lib/auth/session");
  const { prisma } = await import("@/lib/db/prisma");
  const { revalidatePath } = await import("next/cache");
  const user = await requireUser(BROKER_ROLES);
  const id = String(formData.get("id"));
  const outcome = OUTCOMES.find((o) => o === formData.get("outcome"));
  if (!outcome) return;

  const v = await prisma.visit.findFirst({ where: { id, orgId: user.orgId, status: "completed" } });
  if (!v) return;
  await prisma.visit.update({ where: { id }, data: { outcome, outcomeAt: new Date() } });
  await prisma.analyticsEvent.create({
    data: { orgId: user.orgId, type: `visit.${outcome}`, actorId: user.id, metadata: { visitId: id } },
  });
  revalidatePath(`/dashboard/visits/${id}`);
}

export default async function VisitDetail({ params }: { params: { id: string } }) {
  const user = await requireUser(BROKER_ROLES);
  const visit = await prisma.visit.findFirst({
    where: { id: params.id, orgId: user.orgId },
    include: {
      plot: true,
      client: true,
      agent: true,
      messages: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!visit) notFound();
  const locale = getLocale();

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/dashboard/visits" className="text-sm text-gray-500 hover:underline">
        {t("broker.visits.back")}
      </Link>
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">{visit.plot.title}</h1>
          <div className="text-gray-500">
            {t("broker.visits.withClient", { name: visit.client.name })} ({visit.client.phone}) ·{" "}
            {formatDateTime(visit.scheduledAt, locale)}
          </div>
        </div>
        <a
          href={buildWaMeUrl(visit.client.phone, t("broker.visits.waRegarding", { name: visit.client.name, plot: visit.plot.title }))}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-green-600 text-white px-4 py-2 rounded text-sm"
        >
          {t("broker.visits.whatsappClient")}
        </a>
      </div>

      <div className="bg-white border rounded-lg p-4 text-sm">
        <div><strong>{t("common.status")}:</strong> {t(`status.visit.${visit.status}`)}</div>
        {visit.notes && <div className="mt-2"><strong>{t("common.notes")}:</strong> {visit.notes}</div>}
        {visit.feedback && <div className="mt-2"><strong>{t("broker.visits.feedback")}:</strong> {visit.feedback}</div>}
      </div>

      {visit.status === "scheduled" && (
        <form action={markVisit} className="bg-white border rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-sm">{t("broker.visits.updateStatus")}</h3>
          <input type="hidden" name="id" value={visit.id} />
          <textarea
            name="feedback"
            rows={3}
            placeholder={t("broker.visits.feedbackPlaceholder")}
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button name="status" value="completed" className="bg-brand text-white px-3 py-1.5 rounded text-sm">
              {t("broker.visits.markCompleted")}
            </button>
            <button name="status" value="cancelled" className="bg-gray-200 px-3 py-1.5 rounded text-sm">
              {t("common.cancel")}
            </button>
            <button name="status" value="no_show" className="bg-gray-200 px-3 py-1.5 rounded text-sm">
              {t("status.visit.no_show")}
            </button>
          </div>
        </form>
      )}

      {visit.status === "completed" && (
        <form action={recordOutcome} className="bg-white border rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-sm">{t("visit.outcome.title")}</h3>
          <p className="text-xs text-gray-500">
            {t("visit.outcome.help")}
            {visit.outcome &&
              ` ${format("visit.outcome.recorded", getLocale(), { outcome: t(`visit.outcome.${visit.outcome}`) })}`}
          </p>
          <input type="hidden" name="id" value={visit.id} />
          <div className="flex flex-wrap gap-2">
            {OUTCOMES.map((o) => (
              <button
                key={o}
                name="outcome"
                value={o}
                aria-pressed={visit.outcome === o}
                className={`px-3 py-1.5 rounded text-sm ${
                  visit.outcome === o ? "bg-brand text-white" : "bg-gray-200"
                }`}
              >
                {t(`visit.outcome.${o}`)}
              </button>
            ))}
          </div>
        </form>
      )}

      <section>
        <h2 className="font-semibold mb-2">{t("broker.visits.sendMessage")}</h2>
        <MessageComposer
          recipientId={visit.client.id}
          recipientName={visit.client.name}
          recipientPhone={visit.client.phone}
          visitId={visit.id}
          defaultBody={t("broker.visits.waThanks", { name: visit.client.name, plot: visit.plot.title })}
        />
      </section>

      <section>
        <h2 className="font-semibold mb-2">{t("broker.visits.messageHistory")}</h2>
        <div className="bg-white border rounded-lg divide-y">
          {visit.messages.length === 0 && (
            <div className="p-4 text-sm text-gray-500">{t("broker.noMessages")}</div>
          )}
          {visit.messages.map((m) => (
            <div key={m.id} className="p-3 text-sm">
              <div className="text-xs text-gray-500">
                {t(`channel.${m.channel}`)} · {t(`status.message.${m.status}`)} · {formatDateTime(m.createdAt, locale)}
              </div>
              <div className="mt-1">{m.body}</div>
              {m.errorMessage && (
                <div className="text-xs text-red-600 mt-1">{m.errorMessage}</div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
