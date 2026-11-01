import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import { planCaps } from "@/lib/plans";
import { WhatsAppTestButton } from "@/components/settings/whatsapp-test-button";
import { developerToolsEnabled } from "@/lib/developer-tools";
import { translate } from "@/lib/i18n/dict";
import { getLocale, t } from "@/lib/i18n/server";
import { formatInr } from "@/lib/i18n/format";

async function saveSettings(formData: FormData) {
  "use server";
  const { requireUser } = await import("@/lib/auth/session");
  const { prisma } = await import("@/lib/db/prisma");
  const { revalidatePath } = await import("next/cache");
  const { encryptString } = await import("@/lib/crypto/encrypt");
  const user = await requireUser(["broker_admin"]); // only owner can edit settings

  const whatsappMode = String(formData.get("whatsappMode")) as any;
  const orgName = String(formData.get("orgName") || "");
  const phoneNumberId = String(formData.get("phoneNumberId") || "") || null;
  const rawAccessToken = String(formData.get("accessToken") || "");
  // Encrypt at rest. Empty = clear; "******" sentinel = keep existing (avoids re-encrypting masked value).
  const accessToken = !rawAccessToken
    ? null
    : rawAccessToken === "******"
    ? undefined // sentinel for "don't change"
    : encryptString(rawAccessToken);
  const inviteTemplate = String(formData.get("inviteTemplate") || "") || null;
  const reminderTemplate = String(formData.get("reminderTemplate") || "") || null;

  // Geo
  const serviceCity = String(formData.get("serviceCity") || "") || null;
  const serviceRadiusKm = Number(formData.get("serviceRadiusKm") || 25) || 25;

  // Notification prefs
  const notifyOnPublicLead = formData.get("notifyOnPublicLead") === "on";
  const notifyViaInApp = formData.get("notifyViaInApp") === "on";
  const notifyViaEmail = formData.get("notifyViaEmail") === "on";
  const notifyViaWhatsApp = formData.get("notifyViaWhatsApp") === "on";
  const behaviorTrackingEnabled = formData.get("behaviorTrackingEnabled") === "on";

  // Strip "keep existing" sentinel before writing
  const tokenUpdate = accessToken === undefined ? {} : { accessToken };
  const tokenCreate = accessToken === undefined ? {} : { accessToken };

  await prisma.organization.update({
    where: { id: user.orgId },
    data: {
      name: orgName || undefined,
      whatsappMode,
      serviceCity,
      serviceRadiusKm,
      notifyOnPublicLead,
      notifyViaInApp,
      notifyViaEmail,
      notifyViaWhatsApp,
      behaviorTrackingEnabled,
      whatsappConfig: {
        upsert: {
          create: { phoneNumberId, inviteTemplate, reminderTemplate, ...tokenCreate },
          update: { phoneNumberId, inviteTemplate, reminderTemplate, ...tokenUpdate },
        },
      },
    },
  });
  revalidatePath("/dashboard/settings");
}

export default async function SettingsPage() {
  const user = await requireUser(BROKER_ROLES);
  const org = await prisma.organization.findUnique({
    where: { id: user.orgId },
    include: { whatsappConfig: true },
  });
  const readOnly = user.role !== "broker_admin";
  const caps = planCaps(org?.plan ?? "free");
  const showDeveloperTools = developerToolsEnabled();
  const locale = getLocale();
  const [developerIntro, developerBetween, developerRest] = t("account.settings.developerBody").split(
    /\{clientId\}|\{clientSecret\}/
  );

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">{t("nav.settings")}</h1>
      {readOnly && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded">
          {t("account.settings.readOnly")}
        </div>
      )}

      <form action={saveSettings} className="bg-white border rounded-lg p-6 space-y-4">
        <section>
          <h2 className="font-semibold mb-2">{t("common.organization")}</h2>
          <label className="block text-sm font-medium mb-1">{t("common.name")}</label>
          <input
            name="orgName"
            defaultValue={org?.name}
            disabled={readOnly}
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <div className="mt-3 p-3 bg-gray-50 rounded text-xs text-gray-600">
            <strong>{t("account.settings.currentPlan", { plan: t(`account.plan.${org?.plan ?? "free"}`) })}</strong> ·{" "}
            {caps.priceInr === 0
              ? t("common.free")
              : t("account.billing.perMonth", { price: formatInr(caps.priceInr, locale) })}
            <br />
            {t("account.settings.includes", {
              narrative: t(caps.llmNarrative ? "account.settings.aiNarrativeYes" : "account.settings.rulesOnly"),
              render: t(caps.aiRender ? "account.settings.aiRenderYes" : "account.settings.noAiRender"),
              designs: caps.monthlyDesignsCap,
              alerts: caps.monthlyLeadAlertsCap,
            })}
          </div>
        </section>

        <section className="border-t pt-4">
          <h2 className="font-semibold mb-2">{t("account.settings.serviceArea")}</h2>
          <p className="text-xs text-gray-500 mb-3">{t("account.settings.serviceAreaHelp")}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">{t("account.settings.primaryCity")}</label>
              <input
                name="serviceCity"
                defaultValue={org?.serviceCity || ""}
                placeholder={t("account.settings.cityPlaceholder")}
                disabled={readOnly}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("account.settings.radius")}</label>
              <input
                type="number"
                name="serviceRadiusKm"
                defaultValue={org?.serviceRadiusKm || 25}
                min={1}
                max={500}
                disabled={readOnly}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
        </section>

        <section className="border-t pt-4">
          <h2 className="font-semibold mb-2">{translate("settings.insights.title", locale)}</h2>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="behaviorTrackingEnabled"
              defaultChecked={org?.behaviorTrackingEnabled}
              disabled={readOnly}
              className="mt-0.5"
            />
            <span>{translate("settings.insights.tracking", locale)}</span>
          </label>
          <p className="text-xs text-gray-500 mt-2">{translate("settings.insights.notice", locale)}</p>
        </section>

        <section className="border-t pt-4">
          <h2 className="font-semibold mb-2">{t("account.settings.notifications")}</h2>
          <p className="text-xs text-gray-500 mb-3">{t("account.settings.notificationsHelp")}</p>
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="notifyOnPublicLead" defaultChecked={org?.notifyOnPublicLead} disabled={readOnly} />
              {t("account.settings.notifyPublicLead")}
            </label>
            <label className="flex items-center gap-2 ml-6">
              <input type="checkbox" name="notifyViaInApp" defaultChecked={org?.notifyViaInApp ?? true} disabled={readOnly} />
              {t("account.settings.inAppInbox")} <span className="text-gray-400 text-xs">— {t("account.settings.freeNote")}</span>
            </label>
            <label className="flex items-center gap-2 ml-6">
              <input type="checkbox" name="notifyViaEmail" defaultChecked={org?.notifyViaEmail ?? true} disabled={readOnly} />
              {t("common.email")} <span className="text-gray-400 text-xs">— {t("account.settings.emailCostNote")}</span>
            </label>
            <label className="flex items-center gap-2 ml-6">
              <input type="checkbox" name="notifyViaWhatsApp" defaultChecked={org?.notifyViaWhatsApp ?? false} disabled={readOnly || !caps.whatsappBusinessApi} />
              {t("channel.whatsapp_deeplink")} <span className="text-gray-400 text-xs">— {t(caps.whatsappBusinessApi ? "account.settings.whatsappCostNote" : "account.settings.upgradeToEnterprise")}</span>
            </label>
          </div>
        </section>

        {!showDeveloperTools && (
          // Keep the saved WhatsApp setup intact while its controls are hidden.
          <>
            <input type="hidden" name="whatsappMode" value={org?.whatsappMode} />
            <input type="hidden" name="phoneNumberId" value={org?.whatsappConfig?.phoneNumberId || ""} />
            <input type="hidden" name="accessToken" value={org?.whatsappConfig?.accessToken ? "******" : ""} />
          </>
        )}

        {showDeveloperTools && (
        <>
        <section className="border-t pt-4">
          <h2 className="font-semibold mb-2">WhatsApp</h2>
          <p className="text-xs text-gray-500 mb-3">
            <strong>Deep link:</strong> free, opens WhatsApp with pre-filled message — broker clicks
            Send. <strong>Business API:</strong> automated sends (requires Meta Business approval and
            paid messages). <strong>Hybrid:</strong> broker picks per message.
          </p>
          <label className="block text-sm font-medium mb-1">Mode</label>
          <select
            name="whatsappMode"
            defaultValue={org?.whatsappMode}
            disabled={readOnly}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            <option value="deeplink">Deep link (free, manual click)</option>
            <option value="business_api">Business API (automated, costs apply)</option>
            <option value="hybrid">Hybrid (choose per message)</option>
          </select>
        </section>

        <section className="border-t pt-4">
          <h2 className="font-semibold mb-2">WhatsApp Business credentials</h2>
          <p className="text-xs text-gray-500 mb-3">
            Only needed if Mode is Business API or Hybrid. There's no one-click OAuth flow — Meta
            doesn't expose one to third parties without BSP partner status. Follow these steps once:
          </p>
          <ol className="text-xs text-gray-700 list-decimal pl-5 mb-3 space-y-1 bg-gray-50 p-3 rounded border">
            <li>
              Go to <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="text-brand underline">Meta for Developers → My Apps</a> → Create app → <strong>"Business"</strong>.
            </li>
            <li>
              Add the <strong>WhatsApp</strong> product to your app. Meta will assign a test phone number.
            </li>
            <li>
              Open <em>API Setup</em>. Copy the <strong>Phone number ID</strong> (a long integer) and the <strong>Temporary access token</strong> (lasts 24h — fine for testing).
            </li>
            <li>
              For production: <em>App Settings → Basic → System Users</em> → create a system user, generate a <strong>permanent access token</strong> with the <code>whatsapp_business_messaging</code> scope.
            </li>
            <li>
              Paste both below and click <strong>Test connection</strong> — we'll probe Meta's <code>/me</code> endpoint to verify before saving (no message sent, no charge).
            </li>
          </ol>
          <label className="block text-sm font-medium mb-1">Phone number ID</label>
          <input
            name="phoneNumberId"
            defaultValue={org?.whatsappConfig?.phoneNumberId || ""}
            placeholder="e.g. 123456789012345"
            disabled={readOnly}
            className="w-full border rounded px-3 py-2 text-sm mb-3 font-mono"
          />
          <label className="block text-sm font-medium mb-1">Access token</label>
          <input
            name="accessToken"
            type="password"
            defaultValue={org?.whatsappConfig?.accessToken ? "******" : ""}
            placeholder="EAA…"
            disabled={readOnly}
            className="w-full border rounded px-3 py-2 text-sm font-mono"
          />
          <p className="text-xs text-gray-500 mt-1">
            Stored encrypted at rest (AES-256-GCM). Leave as ****** to keep current; clear the field to remove.
          </p>
          {!readOnly && <WhatsAppTestButton />}
        </section>
        </>
        )}

        <section className="border-t pt-4">
          <h2 className="font-semibold mb-2">{t("account.settings.templates")}</h2>
          <p className="text-xs text-gray-500 mb-3">
            {t("account.settings.templateVariables")} <code>{"{name}"}</code> <code>{"{broker}"}</code> <code>{"{org}"}</code>{" "}
            <code>{"{link}"}</code> <code>{"{plot}"}</code> <code>{"{time}"}</code>
          </p>
          <label className="block text-sm font-medium mb-1">{t("account.settings.inviteTemplate")}</label>
          <textarea
            name="inviteTemplate"
            rows={2}
            defaultValue={org?.whatsappConfig?.inviteTemplate || ""}
            disabled={readOnly}
            className="w-full border rounded px-3 py-2 text-sm mb-3"
          />
          <label className="block text-sm font-medium mb-1">{t("account.settings.reminderTemplate")}</label>
          <textarea
            name="reminderTemplate"
            rows={2}
            defaultValue={org?.whatsappConfig?.reminderTemplate || ""}
            disabled={readOnly}
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </section>

        {!readOnly && (
          <button className="bg-brand text-white px-4 py-2 rounded text-sm">{t("account.settings.save")}</button>
        )}
      </form>

      <section className="bg-white border rounded-lg p-6">
        <h2 className="font-semibold mb-2">{t("account.settings.exportTitle")}</h2>
        <p className="text-sm text-gray-600 mb-3">{t("account.settings.exportBody")}</p>
        <a
          href="/dashboard/settings/data-export"
          className="inline-block text-sm px-4 py-2 border rounded hover:bg-gray-50"
        >
          {t("account.settings.exportOpen")}
        </a>
      </section>

      {showDeveloperTools && (
        <section className="bg-white border rounded-lg p-6">
          <h2 className="font-semibold mb-2">{t("account.settings.authorizedApps")}</h2>
          <p className="text-sm text-gray-600 mb-3">{t("account.settings.authorizedAppsBody")}</p>
          <a
            href="/dashboard/settings/integrations"
            className="inline-block text-sm px-4 py-2 border rounded hover:bg-gray-50"
          >
            {t("account.settings.authorizedAppsOpen")}
          </a>
        </section>
      )}

      {showDeveloperTools && !readOnly && (
        <section className="bg-white border rounded-lg p-6">
          <h2 className="font-semibold mb-2">{t("account.settings.developerTitle")}</h2>
          <p className="text-sm text-gray-600 mb-3">
            {developerIntro}
            <code>client_id</code>
            {developerBetween}
            <code>client_secret</code>
            {developerRest}
          </p>
          <a
            href="/dashboard/settings/developer"
            className="inline-block text-sm px-4 py-2 border rounded hover:bg-gray-50"
          >
            {t("account.settings.developerOpen")}
          </a>
        </section>
      )}

      {!readOnly && (
        <section className="bg-white border border-red-200 rounded-lg p-6">
          <h2 className="font-semibold mb-2 text-red-900">{t("account.danger.title")}</h2>
          <p className="text-sm text-gray-600 mb-3">{t("account.settings.dangerBody")}</p>
          <a
            href="/dashboard/settings/danger"
            className="inline-block text-sm px-4 py-2 border border-red-300 text-red-700 rounded hover:bg-red-50"
          >
            {t("account.settings.dangerOpen")}
          </a>
        </section>
      )}
    </div>
  );
}
