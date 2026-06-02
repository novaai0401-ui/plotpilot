import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { DesignViewer } from "@/components/architect/design-viewer";
import { getSessionUser } from "@/lib/auth/session";

/**
 * Public-by-id viewer for a generated design. Access policy:
 *  - public_lead designs: visible to anyone with the id (it's a long cuid; obscurity ≈ token).
 *  - org-scoped designs: visible only to members of the owning org.
 */
export default async function DesignViewPage({ params }: { params: { id: string } }) {
  const design = await prisma.buildingDesign.findUnique({ where: { id: params.id } });
  if (!design) notFound();

  if (design.orgId) {
    const user = await getSessionUser();
    if (!user || user.orgId !== design.orgId) notFound();
  }

  const brief = design.brief as any;
  const svgs = (design.floorPlansSvg as any) || [];

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Your design is ready</h1>
            <p className="text-gray-500 text-sm mt-1">
              Generated {new Date(design.createdAt).toLocaleString()} · ID {design.id.slice(0, 8)}
            </p>
          </div>
          <Link href="/" className="text-sm text-brand hover:underline">
            ← Home
          </Link>
        </div>
        {design.status !== "ready" ? (
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded text-sm">
            This design is still {design.status}…
          </div>
        ) : (
          <DesignViewer
            designId={design.id}
            brief={brief}
            narrative={design.narrative}
            floorPlansSvg={svgs}
            renderImageUrl={design.renderImageUrl}
          />
        )}
      </div>
    </main>
  );
}
