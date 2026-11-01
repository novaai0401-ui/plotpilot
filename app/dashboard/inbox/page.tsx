import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { InboxList, type InboxRow } from "@/components/inbox/inbox-list";
import { getLocale, t } from "@/lib/i18n/server";
import { periodLabel, type PeriodKind } from "@/lib/insights/periods";

type ReportMeta = { report?: PeriodKind; start?: string; end?: string };

export default async function InboxPage() {
  const user = await requireUser([...BROKER_ROLES, "super_admin"]);
  const locale = getLocale();
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  // Serialize Date -> string for client component
  const items: InboxRow[] = notifications.map((n) => {
    // Stored rows are English; report notices are rebuilt in the viewer's language.
    const meta = n.metadata as ReportMeta | null;
    const report =
      meta?.report && meta.start && meta.end
        ? {
            title: t(`common.report.${meta.report}`, {
              label: periodLabel(meta.report, { start: new Date(meta.start), end: new Date(meta.end) }, locale),
            }),
            body: t("common.report.body"),
          }
        : null;
    return {
      id: n.id,
      title: report?.title ?? n.title,
      body: report?.body ?? n.body,
      link: n.link,
      type: n.type,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
    };
  });

  return <InboxList items={items} unreadCount={unreadCount} />;
}
