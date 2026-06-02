import { redirect } from "next/navigation";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

async function createPlot(formData: FormData) {
  "use server";
  const { requireUser, BROKER_ROLES } = await import("@/lib/auth/session");
  const { prisma } = await import("@/lib/db/prisma");
  const { redirect } = await import("next/navigation");
  const user = await requireUser(BROKER_ROLES);

  const title = String(formData.get("title") || "");
  const location = String(formData.get("location") || "");
  if (!title || !location) throw new Error("title and location required");

  const sizeSqft = Number(formData.get("sizeSqft") || 0) || null;
  const priceInr = Number(formData.get("priceInr") || 0) || null;
  const description = String(formData.get("description") || "") || null;
  const city = String(formData.get("city") || "") || null;

  await prisma.plot.create({
    data: { orgId: user.orgId, title, location, city, sizeSqft, priceInr, description, photos: [] },
  });
  await prisma.analyticsEvent.create({
    data: { orgId: user.orgId, type: "plot.created", actorId: user.id },
  });
  redirect("/dashboard/plots");
}

export default async function NewPlotPage() {
  await requireUser(BROKER_ROLES);
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Add a new plot</h1>
      <form action={createPlot} className="space-y-3 bg-white border rounded-lg p-6">
        <div>
          <label className="block text-sm font-medium mb-1">Title *</label>
          <input name="title" required className="w-full border rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Location *</label>
          <input name="location" required className="w-full border rounded px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">City</label>
            <input name="city" className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Size (sqft)</label>
            <input name="sizeSqft" type="number" className="w-full border rounded px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Price (INR)</label>
          <input name="priceInr" type="number" className="w-full border rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea name="description" rows={3} className="w-full border rounded px-3 py-2 text-sm" />
        </div>
        <button className="bg-brand text-white px-4 py-2 rounded text-sm">Create plot</button>
      </form>
    </div>
  );
}
