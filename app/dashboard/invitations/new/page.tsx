import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatPhone } from "@/lib/utils";

async function createInvitation(formData: FormData) {
  "use server";
  const { requireUser, BROKER_ROLES } = await import("@/lib/auth/session");
  const { prisma } = await import("@/lib/db/prisma");
  const { redirect } = await import("next/navigation");
  const { randomBytes } = await import("crypto");
  const { formatPhone } = await import("@/lib/utils");
  const user = await requireUser(BROKER_ROLES);

  const clientName = String(formData.get("clientName") || "");
  const rawPhone = String(formData.get("clientPhone") || "");
  if (!rawPhone) throw new Error("phone required");

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

  await prisma.invitation.create({
    data: {
      orgId: user.orgId,
      sentById: user.id,
      clientName: clientName || null,
      clientPhone: formatPhone(rawPhone),
      clientEmail: String(formData.get("clientEmail") || "") || null,
      plotId: String(formData.get("plotId") || "") || null,
      token,
      expiresAt,
    },
  });
  await prisma.analyticsEvent.create({
    data: { orgId: user.orgId, type: "invitation.sent", actorId: user.id },
  });
  redirect("/dashboard/invitations");
}

export default async function NewInvitationPage() {
  const user = await requireUser(BROKER_ROLES);
  const plots = await prisma.plot.findMany({
    where: { orgId: user.orgId, status: "available" },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Invite a new client</h1>
      <p className="text-sm text-gray-500">
        We&apos;ll generate a tokenized signup link. You can send it via WhatsApp from the
        invitations list.
      </p>
      <form action={createInvitation} className="space-y-3 bg-white border rounded-lg p-6">
        <div>
          <label className="block text-sm font-medium mb-1">Client name</label>
          <input name="clientName" className="w-full border rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Phone (with country code) *</label>
          <input
            name="clientPhone"
            required
            placeholder="+919876543210"
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input name="clientEmail" type="email" className="w-full border rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Plot of interest (optional)</label>
          <select name="plotId" className="w-full border rounded px-3 py-2 text-sm">
            <option value="">—</option>
            {plots.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} — {p.location}
              </option>
            ))}
          </select>
        </div>
        <button className="bg-brand text-white px-4 py-2 rounded text-sm">Create invitation</button>
      </form>
    </div>
  );
}
