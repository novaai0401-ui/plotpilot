import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import {
  TkxButton,
  TkxCard,
  TkxCardBody,
  TkxCardHeader,
  TkxInput,
} from "@/components/tkx-dyn";
import { t } from "@/lib/i18n/server";

async function saveProfile(formData: FormData) {
  "use server";
  const { requireUser } = await import("@/lib/auth/session");
  const { prisma } = await import("@/lib/db/prisma");
  const { revalidatePath } = await import("next/cache");
  const { formatPhone } = await import("@/lib/utils");
  const user = await requireUser(["client"]);

  const name = String(formData.get("name") || "").trim();
  const phone = formatPhone(String(formData.get("phone") || ""));
  const email = String(formData.get("email") || "").trim() || null;

  await prisma.user.update({
    where: { id: user.id },
    data: { name: name || user.name, phone, email },
  });
  revalidatePath("/portal/profile");
}

export default async function ClientProfilePage() {
  const user = await requireUser(["client"]);
  const me = await prisma.user.findUnique({ where: { id: user.id } });

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-2xl font-bold">{t("public.portal.nav.profile")}</h1>
      <TkxCard variant="elevated" padding="lg">
        <TkxCardHeader
          title={t("public.portal.profile.detailsTitle")}
          subtitle={t("public.portal.profile.detailsSubtitle")}
        />
        <TkxCardBody>
          <form action={saveProfile} className="space-y-4">
            <TkxInput
              label={t("common.name")}
              name="name"
              defaultValue={me?.name}
              autoComplete="name"
              isRequired
            />
            <TkxInput
              label={t("common.phone")}
              name="phone"
              type="tel"
              defaultValue={me?.phone}
              autoComplete="tel"
              isRequired
              hint={t("public.portal.profile.phoneHint")}
            />
            <TkxInput
              label={t("common.email")}
              name="email"
              type="email"
              defaultValue={me?.email || ""}
              autoComplete="email"
            />
            <TkxButton
              type="submit"
              variant="solid"
              colorScheme="primary"
              isFullWidth
            >
              {t("common.save")}
            </TkxButton>
          </form>
        </TkxCardBody>
      </TkxCard>
    </div>
  );
}
