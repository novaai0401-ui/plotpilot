import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
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

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/dashboard/visits" className="text-sm text-gray-500 hover:underline">
        ← Back to visits
      </Link>
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">{visit.plot.title}</h1>
          <div className="text-gray-500">
            with {visit.client.name} ({visit.client.phone}) ·{" "}
            {new Date(visit.scheduledAt).toLocaleString()}
          </div>
        </div>
        <a
          href={buildWaMeUrl(visit.client.phone, `Hi ${visit.client.name}, regarding your visit to ${visit.plot.title}: `)}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-green-600 text-white px-4 py-2 rounded text-sm"
        >
          WhatsApp client
        </a>
      </div>

      <div className="bg-white border rounded-lg p-4 text-sm">
        <div><strong>Status:</strong> {visit.status}</div>
        {visit.notes && <div className="mt-2"><strong>Notes:</strong> {visit.notes}</div>}
        {visit.feedback && <div className="mt-2"><strong>Feedback:</strong> {visit.feedback}</div>}
      </div>

      {visit.status === "scheduled" && (
        <form action={markVisit} className="bg-white border rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-sm">Update status</h3>
          <input type="hidden" name="id" value={visit.id} />
          <textarea
            name="feedback"
            rows={3}
            placeholder="Post-visit feedback (optional)"
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button name="status" value="completed" className="bg-brand text-white px-3 py-1.5 rounded text-sm">
              Mark completed
            </button>
            <button name="status" value="cancelled" className="bg-gray-200 px-3 py-1.5 rounded text-sm">
              Cancel
            </button>
            <button name="status" value="no_show" className="bg-gray-200 px-3 py-1.5 rounded text-sm">
              No-show
            </button>
          </div>
        </form>
      )}

      <section>
        <h2 className="font-semibold mb-2">Send message to client</h2>
        <MessageComposer
          recipientId={visit.client.id}
          recipientName={visit.client.name}
          recipientPhone={visit.client.phone}
          visitId={visit.id}
          defaultBody={`Hi ${visit.client.name}, thanks for visiting ${visit.plot.title}. Any questions?`}
        />
      </section>

      <section>
        <h2 className="font-semibold mb-2">Message history</h2>
        <div className="bg-white border rounded-lg divide-y">
          {visit.messages.length === 0 && (
            <div className="p-4 text-sm text-gray-500">No messages yet.</div>
          )}
          {visit.messages.map((m) => (
            <div key={m.id} className="p-3 text-sm">
              <div className="text-xs text-gray-500">
                {m.channel} · {m.status} · {new Date(m.createdAt).toLocaleString()}
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
