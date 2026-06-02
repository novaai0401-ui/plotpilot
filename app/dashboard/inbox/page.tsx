import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { InboxList, type InboxRow } from "@/components/inbox/inbox-list";

export default async function InboxPage() {
  const user = await requireUser([...BROKER_ROLES, "super_admin"]);
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  // Serialize Date -> string for client component
  const items: InboxRow[] = notifications.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    link: n.link,
    type: n.type,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  }));

  return <InboxList items={items} unreadCount={unreadCount} />;
}
