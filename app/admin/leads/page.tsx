import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ClaimLeadButton } from "@/components/architect/claim-lead-button";

export default async function PublicLeadsPage() {
  await requireUser(["super_admin"]);
  const leads = await prisma.buildingDesign.findMany({
    where: { source: "public_lead" },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { claimedByOrg: true },
  });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Public-lead designs</h1>
      <p className="text-sm text-gray-400">
        Anonymous visitors who completed the public /design flow. Claim a lead to assign it
        to your org and auto-send a WhatsApp invite.
      </p>
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-700 text-left text-xs uppercase text-gray-300">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Email</th>
              <th className="p-3">Type</th>
              <th className="p-3">Email status</th>
              <th className="p-3">Claim</th>
              <th className="p-3">Created</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => {
              const req = l.requirements as any;
              return (
                <tr key={l.id} className="border-t border-gray-700 hover:bg-gray-700/50">
                  <td className="p-3">{l.leadName || "—"}</td>
                  <td className="p-3">{l.leadPhone || "—"}</td>
                  <td className="p-3 text-gray-400">{l.leadEmail || "—"}</td>
                  <td className="p-3 text-gray-400">{req?.projectType}</td>
                  <td className="p-3 text-xs">
                    {l.followupEmailClickedAt ? (
                      <span className="text-teal-400">clicked</span>
                    ) : l.followupEmailOpenedAt ? (
                      <span className="text-blue-400">opened</span>
                    ) : l.followupEmailSentAt ? (
                      <span className="text-gray-400">sent</span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                    {l.followupEmailVariant && (
                      <span className="ml-1 text-[10px] text-gray-500">({l.followupEmailVariant})</span>
                    )}
                  </td>
                  <td className="p-3">
                    {l.claimedByOrgId ? (
                      <span className="text-xs text-green-400">
                        {l.claimedByOrg?.name || "claimed"}
                      </span>
                    ) : (
                      <ClaimLeadButton designId={l.id} />
                    )}
                  </td>
                  <td className="p-3 text-gray-400">{new Date(l.createdAt).toLocaleString()}</td>
                  <td className="p-3">
                    <Link href={`/designs/${l.id}`} className="text-teal-400 hover:underline text-xs">View</Link>
                  </td>
                </tr>
              );
            })}
            {leads.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-gray-400">No public leads yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
