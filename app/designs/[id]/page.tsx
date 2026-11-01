import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { DesignViewer } from "@/components/architect/design-viewer";
import { designForLocale } from "@/lib/architect/localize";
import { getSessionUser } from "@/lib/auth/session";
import { t, getLocale } from "@/lib/i18n/server";
import { formatDateTime } from "@/lib/i18n/format";

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

  const view =
    design.status === "ready"
      ? designForLocale(
          {
            requirements: design.requirements as any,
            brief: design.brief as any,
            narrative: design.narrative,
          },
          getLocale()
        )
      : null;

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">{t("design.page.ready")}</h1>
            <p className="text-gray-500 text-sm mt-1">
              {t("design.page.generated", {
                date: formatDateTime(design.createdAt, getLocale()),
                id: design.id.slice(0, 8),
              })}
            </p>
          </div>
          <Link href="/" className="text-sm text-brand hover:underline">
            ← {t("design.page.home")}
          </Link>
        </div>
        {!view ? (
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded text-sm">
            {t(`design.page.notReady.${design.status}`)}
          </div>
        ) : (
          <DesignViewer
            designId={design.id}
            brief={view.brief}
            narrative={view.narrative}
            floorPlansSvg={view.floorPlansSvg}
            renderImageUrl={design.renderImageUrl}
          />
        )}
      </div>
    </main>
  );
}
