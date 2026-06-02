/**
 * Translation dictionary.
 *
 * Keys are stable identifiers. Values are { locale → string }.
 * Adding a new locale = add the locale code to `LOCALES`, add translations
 * here (English fallback used for missing keys).
 *
 * Why a homegrown dictionary instead of next-intl / formatjs:
 *   - We translate ~30 strings, not 30,000. Library overhead would dwarf the dict.
 *   - No need for ICU message format yet (no plurals/dates/gender).
 *   - Cookie-driven locale picking — no URL routing rewrite needed.
 *
 * When we hit ~200 strings or need ICU, swap this file for next-intl. The `t()`
 * API surface is intentionally similar so the swap is mechanical.
 */

export const LOCALES = ["en", "hi"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  hi: "हिंदी",
};

type Dict = Record<string, Partial<Record<Locale, string>>>;

export const dict: Dict = {
  // Sidebar nav
  "nav.overview": { en: "Overview", hi: "अवलोकन" },
  "nav.inbox": { en: "Inbox", hi: "इनबॉक्स" },
  "nav.clients": { en: "Clients", hi: "ग्राहक" },
  "nav.plots": { en: "Plots", hi: "प्लॉट" },
  "nav.invitations": { en: "Invitations", hi: "आमंत्रण" },
  "nav.visits": { en: "Visits", hi: "दौरे" },
  "nav.messages": { en: "Messages", hi: "संदेश" },
  "nav.designs": { en: "Designs", hi: "डिज़ाइन" },
  "nav.analytics": { en: "Analytics", hi: "विश्लेषण" },
  "nav.auditLog": { en: "Audit log", hi: "ऑडिट लॉग" },
  "nav.team": { en: "Team", hi: "टीम" },
  "nav.usage": { en: "Usage & billing", hi: "उपयोग और बिलिंग" },
  "nav.settings": { en: "Settings", hi: "सेटिंग्स" },

  // Landing page
  "landing.headline": {
    en: "Run your brokerage like a pro.",
    hi: "अपनी ब्रोकरेज को पेशेवर तरीके से चलाएं।",
  },
  "landing.subhead": {
    en:
      "Invite clients, schedule plot visits, message on WhatsApp, and see what's working — all from one dashboard. Built for plot & land brokers.",
    hi:
      "ग्राहकों को आमंत्रित करें, प्लॉट विज़िट शेड्यूल करें, व्हाट्सएप पर संदेश भेजें — सब एक डैशबोर्ड से।",
  },
  "landing.cta.startFree": { en: "Start your free org", hi: "मुफ्त शुरू करें" },
  "landing.cta.tryArchitect": { en: "Try the AI architect →", hi: "AI आर्किटेक्ट आज़माएं →" },
  "landing.cta.login": { en: "Login", hi: "लॉगिन" },
  "landing.feature.invite.title": { en: "Invite & onboard", hi: "आमंत्रित करें और जोड़ें" },
  "landing.feature.invite.desc": {
    en: "Send tokenized signup links via WhatsApp. Clients onboard themselves.",
    hi: "व्हाट्सएप के माध्यम से साइनअप लिंक भेजें। ग्राहक स्वयं जुड़ते हैं।",
  },
  "landing.feature.schedule.title": { en: "Schedule visits", hi: "विज़िट शेड्यूल करें" },
  "landing.feature.schedule.desc": {
    en: "Calendar view of plot visits. Auto-reminders to clients.",
    hi: "प्लॉट विज़िट का कैलेंडर दृश्य। ग्राहकों को स्वचालित अनुस्मारक।",
  },
  "landing.feature.whatsapp.title": { en: "WhatsApp built-in", hi: "व्हाट्सएप अंतर्निहित" },
  "landing.feature.whatsapp.desc": {
    en: "Deep-link or Business API. Configurable per organization.",
    hi: "डीप-लिंक या बिज़नेस API. प्रत्येक संगठन के लिए कॉन्फ़िगर करने योग्य।",
  },

  // Login form
  "login.title": { en: "Login", hi: "लॉगिन" },
  "login.subtitle": { en: "Welcome back to PlotBroker.", hi: "PlotBroker में पुनः स्वागत है।" },
  "login.email": { en: "Email", hi: "ईमेल" },
  "login.password": { en: "Password", hi: "पासवर्ड" },
  "login.signIn": { en: "Sign in", hi: "साइन इन करें" },
  "login.signingIn": { en: "Signing in...", hi: "साइन इन हो रहा है..." },
  "login.noOrg": { en: "Don't have an org?", hi: "संगठन नहीं है?" },
  "login.startFree": { en: "Start free", hi: "मुफ्त शुरू करें" },

  // Common
  "common.language": { en: "Language", hi: "भाषा" },
  "common.signOut": { en: "Sign out", hi: "साइन आउट" },
};

export type TranslationKey = keyof typeof dict;

/**
 * Look up a translation. Falls back to the English version, then to the key
 * itself if no English exists (so a missing key surfaces visibly in dev).
 */
export function translate(key: string, locale: Locale): string {
  const entry = dict[key];
  if (!entry) return key;
  return entry[locale] ?? entry.en ?? key;
}
