import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { DangerZone } from "./danger-zone";
import { t } from "@/lib/i18n/server";

/**
 * Account + organization deletion. broker_admin only.
 *
 * Splits into a server page (fetches the org slug + counts so the user knows
 * exactly what they're erasing) and a client component (handles the typed-
 * confirmation + POST to /api/account/delete).
 */
export default async function DangerZonePage() {
  const user = await requireUser(["broker_admin"]);
  const org = await prisma.organization.findUnique({
    where: { id: user.orgId },
    select: {
      slug: true,
      name: true,
      _count: {
        select: {
          users: true,
          plots: true,
          visits: true,
          designs: true,
        },
      },
    },
  });
  if (!org) {
    return (
      <main className="max-w-2xl mx-auto p-6">
        <p className="text-sm text-gray-600">{t("account.danger.notFound")}</p>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">{t("account.danger.title")}</h1>
        <p className="text-sm text-gray-600">{t("account.danger.intro")}</p>
      </header>

      <DangerZone
        orgSlug={org.slug}
        orgName={org.name}
        counts={{
          users: org._count.users,
          plots: org._count.plots,
          visits: org._count.visits,
          designs: org._count.designs,
        }}
      />
    </main>
  );
}
