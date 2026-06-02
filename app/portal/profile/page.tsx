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
      <h1 className="text-2xl font-bold">Profile</h1>
      <TkxCard variant="elevated" padding="lg">
        <TkxCardHeader
          title="Your details"
          subtitle="Your broker uses these to reach you about visits and listings."
        />
        <TkxCardBody>
          <form action={saveProfile} className="space-y-4">
            <TkxInput
              label="Name"
              name="name"
              defaultValue={me?.name}
              autoComplete="name"
              isRequired
            />
            <TkxInput
              label="Phone"
              name="phone"
              type="tel"
              defaultValue={me?.phone}
              autoComplete="tel"
              isRequired
              hint="Include country code (e.g. +91…) for WhatsApp deep-links."
            />
            <TkxInput
              label="Email"
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
              Save
            </TkxButton>
          </form>
        </TkxCardBody>
      </TkxCard>
    </div>
  );
}
