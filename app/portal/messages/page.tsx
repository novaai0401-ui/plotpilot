import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { TkxCard, TkxCardBody, TkxEmpty } from "@/components/tkx-dyn";
import { formatDateTime } from "@/lib/i18n/format";
import { t, getLocale } from "@/lib/i18n/server";

export default async function ClientMessagesPage() {
  const user = await requireUser(["client"]);
  const locale = getLocale();
  const messages = await prisma.message.findMany({
    where: { OR: [{ recipientId: user.id }, { senderId: user.id }] },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { sender: true, recipient: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("nav.messages")}</h1>
      <TkxCard variant="outlined" padding="none">
        <TkxCardBody>
          {messages.length === 0 ? (
            <TkxEmpty description={t("public.portal.messages.empty")} />
          ) : (
            <div className="divide-y">
              {messages.map((m) => {
                const mine = m.senderId === user.id;
                return (
                  <div
                    key={m.id}
                    className={
                      "px-4 py-3 text-sm " + (mine ? "bg-gray-50/60" : "")
                    }
                  >
                    <div className="text-xs text-gray-500">
                      {mine ? t("public.portal.messages.youSender") : m.sender.name} →{" "}
                      {mine ? m.recipient.name : t("public.portal.messages.youRecipient")} ·{" "}
                      {formatDateTime(m.createdAt, locale)}
                    </div>
                    <div className="mt-1 whitespace-pre-wrap">{m.body}</div>
                  </div>
                );
              })}
            </div>
          )}
        </TkxCardBody>
      </TkxCard>
    </div>
  );
}
