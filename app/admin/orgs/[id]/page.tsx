import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

async function updateOrg(formData: FormData) {
  "use server";
  const { requireUser } = await import("@/lib/auth/session");
  const { prisma } = await import("@/lib/db/prisma");
  const { redirect } = await import("next/navigation");
  await requireUser(["super_admin"]);

  const id = String(formData.get("id"));
  const plan = String(formData.get("plan")) as any;
  const name = String(formData.get("name") || "");
  await prisma.organization.update({
    where: { id },
    data: { plan, name: name || undefined },
  });
  redirect(`/admin/orgs/${id}`);
}

async function deleteOrg(formData: FormData) {
  "use server";
  const { requireUser } = await import("@/lib/auth/session");
  const { prisma } = await import("@/lib/db/prisma");
  const { redirect } = await import("next/navigation");
  await requireUser(["super_admin"]);
  const id = String(formData.get("id"));
  await prisma.organization.delete({ where: { id } });
  redirect(`/admin/orgs`);
}

export default async function OrgDetailPage({ params }: { params: { id: string } }) {
  await requireUser(["super_admin"]);
  const org = await prisma.organization.findUnique({
    where: { id: params.id },
    include: {
      users: { orderBy: { createdAt: "asc" }, take: 20 },
      _count: { select: { plots: true, visits: true, messages: true, invitations: true } },
    },
  });
  if (!org) notFound();

  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/admin/orgs" className="text-sm text-gray-400 hover:underline">
        ← Back to organizations
      </Link>
      <h1 className="text-2xl font-bold">{org.name}</h1>

      <div className="grid grid-cols-4 gap-3">
        {[
          { l: "Users", v: org.users.length },
          { l: "Plots", v: org._count.plots },
          { l: "Visits", v: org._count.visits },
          { l: "Messages", v: org._count.messages },
        ].map((s) => (
          <div key={s.l} className="bg-gray-800 border border-gray-700 rounded p-3 text-sm">
            <div className="text-xs text-gray-400 uppercase">{s.l}</div>
            <div className="text-xl font-bold">{s.v}</div>
          </div>
        ))}
      </div>

      <form action={updateOrg} className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
        <h2 className="font-semibold text-sm">Edit organization</h2>
        <input type="hidden" name="id" value={org.id} />
        <div>
          <label className="block text-xs uppercase text-gray-400 mb-1">Name</label>
          <input
            name="name"
            defaultValue={org.name}
            className="w-full border border-gray-600 bg-gray-900 rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs uppercase text-gray-400 mb-1">Plan</label>
          <select
            name="plan"
            defaultValue={org.plan}
            className="w-full border border-gray-600 bg-gray-900 rounded px-3 py-2 text-sm"
          >
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        <button className="bg-teal-600 px-4 py-2 rounded text-sm">Save</button>
      </form>

      <section>
        <h2 className="font-semibold mb-2 text-sm">Users (first 20)</h2>
        <div className="bg-gray-800 border border-gray-700 rounded-lg divide-y divide-gray-700">
          {org.users.map((u) => (
            <div key={u.id} className="p-3 text-sm flex justify-between">
              <span>
                <strong>{u.name}</strong>{" "}
                <span className="text-gray-400">· {u.phone}</span>
              </span>
              <span className="text-xs text-gray-400">{u.role}</span>
            </div>
          ))}
        </div>
      </section>

      <form
        action={deleteOrg}
        className="bg-red-950/50 border border-red-800 rounded-lg p-4 text-sm"
      >
        <input type="hidden" name="id" value={org.id} />
        <div className="font-semibold text-red-300">Danger zone</div>
        <p className="text-red-200/70 text-xs mt-1">
          Permanently delete this organization and all related data (cascades on FK).
        </p>
        <button className="mt-3 bg-red-700 hover:bg-red-600 px-3 py-1.5 rounded text-xs">
          Delete organization
        </button>
      </form>
    </div>
  );
}
