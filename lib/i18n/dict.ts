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

import { MARATHI } from "./marathi";
import { ACCOUNT } from "./strings/account";
import { BROKER } from "./strings/broker";
import { COMMON } from "./strings/common";
import { DESIGN } from "./strings/design";
import { DESIGN_OUTPUT } from "./strings/design-output";
import { PUBLIC } from "./strings/public";

export const LOCALES = ["en", "hi", "mr"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  hi: "हिंदी",
  mr: "मराठी",
};

type Dict = Record<string, Partial<Record<Locale, string>>>;

export const dict: Dict = {
  // Sidebar nav
  "nav.overview": { en: "Overview", hi: "अवलोकन" },
  "nav.inbox": { en: "Inbox", hi: "इनबॉक्स" },
  "nav.clients": { en: "Clients", hi: "ग्राहक" },
  "nav.plots": { en: "Plots", hi: "प्लॉट" },
  "nav.invitations": { en: "Invitations", hi: "आमंत्रण" },
  "nav.visits": { en: "Visits", hi: "विज़िट" },
  "nav.messages": { en: "Messages", hi: "संदेश" },
  "nav.designs": { en: "Designs", hi: "डिज़ाइन" },
  "nav.analytics": { en: "Analytics", hi: "विश्लेषण" },
  "nav.insights": { en: "AI insights", hi: "AI इनसाइट्स" },
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
    en: "Send personal signup links via WhatsApp. Clients onboard themselves.",
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

  // AI insights: page
  "insights.title": { en: "AI insights", hi: "AI इनसाइट्स" },
  "insights.demoNotice": {
    en: "Demo workspace. These clients, plots and conversations are made up to show how the product works.",
    hi: "यह डेमो वर्कस्पेस है। ये ग्राहक, प्लॉट और बातचीत काल्पनिक हैं और उत्पाद को समझाने के लिए बनाए गए हैं।",
  },
  "insights.period.week": { en: "Weekly", hi: "साप्ताहिक" },
  "insights.period.month": { en: "Monthly", hi: "मासिक" },
  "insights.period.year": { en: "Yearly", hi: "वार्षिक" },
  "insights.periodNav": { en: "Report period", hi: "रिपोर्ट की अवधि" },
  "insights.summary": { en: "Summary", hi: "सारांश" },
  "insights.keyFigures": { en: "Key figures", hi: "मुख्य आंकड़े" },
  "insights.nextSteps": { en: "Suggested next steps", hi: "सुझाए गए अगले कदम" },
  "insights.leadScores": { en: "Lead scores", hi: "लीड स्कोर" },
  "insights.noLeads": { en: "No open leads yet.", hi: "अभी कोई खुली लीड नहीं है।" },
  "insights.modelTrained": {
    en: "Trained on {count} finished outcomes from your own clients.",
    hi: "आपके अपने ग्राहकों के {count} पूरे हो चुके नतीजों पर प्रशिक्षित।",
  },
  "insights.modelAccuracy": {
    en: "Correct on {accuracy}% of the newest outcomes, against {baseline}% for always guessing the commonest result.",
    hi: "नए नतीजों में {accuracy}% सही, जबकि हर बार सबसे आम नतीजा चुनने पर {baseline}% सही होता।",
  },
  "insights.modelStarter": {
    en: "Using starter rules until there are {needed} finished outcomes, with both bookings and losses ({count} so far). Record visit outcomes to help it learn.",
    hi: "जब तक बुकिंग और छूटी हुई लीड मिलाकर {needed} नतीजे नहीं हो जाते, शुरुआती नियम इस्तेमाल होंगे (अभी {count})। इसे सीखने में मदद के लिए विज़िट के नतीजे दर्ज करें।",
  },
  "insights.funnel": { en: "Funnel", hi: "फ़नल" },
  "insights.funnelRate": { en: "{rate}% of previous stage", hi: "पिछले चरण का {rate}%" },
  "insights.funnelNote": {
    en: "Counts of what happened in this period, not one group of clients followed through.",
    hi: "ये इस अवधि की कुल गिनती है, किसी एक ग्राहक समूह का सफ़र नहीं।",
  },
  "insights.trend": { en: "Activity trend", hi: "गतिविधि का रुझान" },
  "insights.noActivity": { en: "No activity in this period.", hi: "इस अवधि में कोई गतिविधि नहीं हुई।" },
  "insights.team": { en: "Team", hi: "टीम" },
  "insights.noTeam": { en: "No team activity in this period.", hi: "इस अवधि में टीम की कोई गतिविधि नहीं हुई।" },
  "insights.topPlots": { en: "Top plots", hi: "शीर्ष प्लॉट" },
  "insights.noPlots": { en: "No plot visits in this period.", hi: "इस अवधि में कोई प्लॉट विज़िट नहीं हुई।" },
  "insights.sections": {
    en: "Most used sections ({count} active staff)",
    hi: "सबसे ज़्यादा इस्तेमाल हुए सेक्शन ({count} सक्रिय स्टाफ़)",
  },
  "insights.col.agent": { en: "Agent", hi: "एजेंट" },
  "insights.col.plot": { en: "Plot", hi: "प्लॉट" },
  "insights.col.section": { en: "Section", hi: "सेक्शन" },
  "insights.col.views": { en: "Views", hi: "देखा गया" },
  "insights.col.visits": { en: "Visits", hi: "विज़िट" },
  "insights.col.noShows": { en: "No-shows", hi: "नहीं आए" },
  "insights.col.booked": { en: "Booked", hi: "बुक हुए" },
  "insights.vsPrevious": { en: "{change}% vs previous", hi: "पिछली अवधि से {change}%" },
  "insights.was": { en: "was {value}", hi: "पहले {value}" },
  "insights.chart.visits": { en: "Visits", hi: "विज़िट" },
  "insights.chart.bookings": { en: "Bookings", hi: "बुकिंग" },
  "insights.chart.messages": { en: "Messages", hi: "संदेश" },
  "insights.band.hot": { en: "hot", hi: "गर्म" },
  "insights.band.warm": { en: "warm", hi: "सामान्य" },
  "insights.band.cold": { en: "cold", hi: "ठंडी" },

  // AI insights: figures
  "insights.kpi.bookings": { en: "Bookings", hi: "बुकिंग" },
  "insights.kpi.visitsHeld": { en: "Visits held", hi: "हुई विज़िट" },
  "insights.kpi.noShowRate": { en: "No-show rate", hi: "न आने की दर" },
  "insights.kpi.invitesSent": { en: "Clients invited", hi: "आमंत्रित ग्राहक" },
  "insights.kpi.clientsJoined": { en: "Clients joined", hi: "जुड़े ग्राहक" },
  "insights.kpi.inquiries": { en: "Client replies", hi: "ग्राहकों के जवाब" },
  "insights.kpi.messagesSent": { en: "Messages sent", hi: "भेजे गए संदेश" },
  "insights.kpi.messagesPrepared": { en: "WhatsApp links opened", hi: "खोले गए व्हाट्सएप लिंक" },
  "insights.kpi.designs": { en: "Designs generated", hi: "बने डिज़ाइन" },
  "insights.stage.invited": { en: "Invited", hi: "आमंत्रित" },
  "insights.stage.joined": { en: "Joined", hi: "जुड़े" },
  "insights.stage.visited": { en: "Visited", hi: "विज़िट की" },
  "insights.stage.booked": { en: "Booked", hi: "बुक किया" },

  // AI insights: why a lead scored as it did
  "insights.reason.visitsCompleted.good": { en: "Has completed site visits", hi: "साइट विज़िट कर चुके हैं" },
  "insights.reason.visitsCompleted.bad": { en: "No site visits yet", hi: "अभी कोई साइट विज़िट नहीं" },
  "insights.reason.noShows.good": { en: "Keeps appointments", hi: "समय पर आते हैं" },
  "insights.reason.noShows.bad": { en: "Has missed visits", hi: "विज़िट पर नहीं आए" },
  "insights.reason.recentReplies.good": { en: "Replied recently", hi: "हाल में जवाब दिया" },
  "insights.reason.recentReplies.bad": { en: "Not replying", hi: "जवाब नहीं दे रहे" },
  "insights.reason.staleness.good": { en: "In recent contact", hi: "हाल में संपर्क हुआ" },
  "insights.reason.staleness.bad": { en: "No recent contact", hi: "हाल में संपर्क नहीं हुआ" },
  "insights.reason.hasPreferences.good": { en: "Shared what they want", hi: "अपनी पसंद बताई है" },
  "insights.reason.hasPreferences.bad": { en: "Preferences unknown", hi: "पसंद पता नहीं" },
  "insights.reason.showedInterest.good": { en: "Marked interested after a visit", hi: "विज़िट के बाद रुचि दिखाई" },
  "insights.reason.showedInterest.bad": { en: "Interest not confirmed", hi: "रुचि की पुष्टि नहीं" },
  "insights.reason.declined.good": { en: "Has not declined", hi: "मना नहीं किया" },
  "insights.reason.declined.bad": { en: "Declined a plot", hi: "प्लॉट के लिए मना किया" },

  // AI insights: suggestions
  "insights.sug.call_hot_lead.title": { en: "Call {name} today", hi: "आज {name} को कॉल करें" },
  "insights.sug.call_hot_lead.body": {
    en: "Lead score {score}, but no contact for {days} days.",
    hi: "लीड स्कोर {score} है, लेकिन {days} दिन से संपर्क नहीं हुआ।",
  },
  "insights.sug.revive_warm_lead.title": { en: "Check in with {name}", hi: "{name} से हालचाल लें" },
  "insights.sug.revive_warm_lead.body": {
    en: "Warm lead (score {score}), quiet for {days} days.",
    hi: "अच्छी लीड (स्कोर {score}), {days} दिन से कोई बात नहीं।",
  },
  "insights.sug.record_outcome.title": { en: "Record how {name}'s visit went", hi: "{name} की विज़िट का नतीजा दर्ज करें" },
  "insights.sug.record_outcome.body": {
    en: "{plot}, {days} day(s) ago. Outcomes are what the lead scores learn from.",
    hi: "{plot}, {days} दिन पहले। लीड स्कोर इन्हीं नतीजों से सीखते हैं।",
  },
  "insights.sug.refresh_plot.title": { en: "Refresh \"{plot}\"", hi: "\"{plot}\" को अपडेट करें" },
  "insights.sug.refresh_plot.body": {
    en: "Listed {days} days with no visits in the last 30. Review the price, photos or description.",
    hi: "{days} दिन से सूचीबद्ध है और पिछले 30 दिनों में कोई विज़िट नहीं। कीमत, फ़ोटो या विवरण देखें।",
  },
  "insights.sug.reduce_no_shows.title": { en: "Cut down on missed visits", hi: "छूटी हुई विज़िट कम करें" },
  "insights.sug.reduce_no_shows.body": {
    en: "{rate}% of visits in the last 90 days were no-shows. Confirm by WhatsApp the evening before.",
    hi: "पिछले 90 दिनों की {rate}% विज़िट पर ग्राहक नहीं आए। एक शाम पहले व्हाट्सएप पर पुष्टि करें।",
  },
  "insights.filter.all": { en: "All", hi: "सभी" },
  "insights.scoreAria": { en: "Lead score {score}", hi: "लीड स्कोर {score}" },
  "insights.thanks": { en: "Thanks, I'll learn from that.", hi: "धन्यवाद, मैं इससे सीखूंगा।" },
  "insights.teach.prompt": { en: "What was your question about?", hi: "आपका सवाल किस बारे में था?" },
  "insights.teach.learned": {
    en: "Got it. I'll recognise this kind of question next time.",
    hi: "समझ गया। अगली बार ऐसा सवाल पहचान लूंगा।",
  },
  "insights.topic.leads": { en: "Leads", hi: "लीड" },
  "insights.topic.plots": { en: "Plots", hi: "प्लॉट" },
  "insights.topic.agents": { en: "Team", hi: "टीम" },
  "insights.topic.actions": { en: "What to do next", hi: "आगे क्या करें" },
  "insights.topic.performance": { en: "Performance", hi: "प्रदर्शन" },
  "insights.done": { en: "Done", hi: "हो गया" },
  "insights.notUseful": { en: "Not useful", hi: "काम का नहीं" },
  "insights.noSuggestions": { en: "Nothing needs attention right now.", hi: "अभी किसी बात पर ध्यान देने की ज़रूरत नहीं है।" },
  "insights.saveFailed": { en: "Couldn't save that. Try again.", hi: "सहेजा नहीं जा सका। फिर से कोशिश करें।" },

  // AI insights: ask box
  "insights.ask.title": { en: "Ask about your business", hi: "अपने कारोबार के बारे में पूछें" },
  "insights.ask.placeholder": {
    en: "Ask in English, Hindi or Marathi",
    hi: "हिंदी, मराठी या अंग्रेज़ी में पूछें",
  },
  "insights.ask.label": { en: "Your question", hi: "आपका सवाल" },
  "insights.ask.button": { en: "Ask", hi: "पूछें" },
  "insights.ask.thinking": { en: "Thinking...", hi: "सोच रहा है..." },
  "insights.ask.failed": { en: "Couldn't get an answer. Try again.", hi: "जवाब नहीं मिल सका। फिर से कोशिश करें।" },
  "insights.ask.example1": { en: "Which leads should I call first?", hi: "पहले किस ग्राहक को कॉल करूं?" },
  "insights.ask.example2": { en: "How did we do?", hi: "इस बार कैसा रहा?" },
  "insights.ask.example3": { en: "Which plots are getting visits?", hi: "किन प्लॉट पर विज़िट हो रही हैं?" },

  // AI insights: written answers
  "insights.narr.empty": { en: "No recorded activity for {label}.", hi: "{label} में कोई गतिविधि दर्ज नहीं हुई।" },
  "insights.narr.headline": {
    en: "{label}: {bookings} {bookingWord}{bookingDelta} from {visits} {visitWord} held{visitDelta}.",
    hi: "{label}: {visits} {visitWord}{visitDelta} से {bookings} {bookingWord}{bookingDelta}।",
  },
  "insights.narr.booking.one": { en: "booking", hi: "बुकिंग" },
  "insights.narr.booking.other": { en: "bookings", hi: "बुकिंग" },
  "insights.narr.visit.one": { en: "visit", hi: "विज़िट" },
  "insights.narr.visit.other": { en: "visits", hi: "विज़िट" },
  "insights.narr.up": { en: " (up {change}% on the previous period)", hi: " (पिछली अवधि से {change}% ज़्यादा)" },
  "insights.narr.down": { en: " (down {change}% on the previous period)", hi: " (पिछली अवधि से {change}% कम)" },
  "insights.narr.same": { en: " (unchanged on the previous period)", hi: " (पिछली अवधि जितनी ही)" },
  "insights.narr.noShow": { en: "No-show rate was {rate}%.", hi: "न आने की दर {rate}% रही।" },
  "insights.narr.topPlot": {
    en: "Busiest plot: {plot} with {visits} visit(s).",
    hi: "सबसे ज़्यादा विज़िट: {plot} ({visits})।",
  },
  "insights.narr.topAgent": {
    en: "Top agent: {name} with {bookings} booking(s).",
    hi: "शीर्ष एजेंट: {name} ({bookings} बुकिंग)।",
  },
  "insights.answer.noLeads": { en: "No open leads to rank yet.", hi: "अभी रैंक करने के लिए कोई खुली लीड नहीं है।" },
  "insights.answer.leads": { en: "Your strongest open leads: {list}.", hi: "आपकी सबसे मज़बूत लीड: {list}।" },
  "insights.answer.leadItem": { en: "{name}: score {score}, {band}{why}", hi: "{name}: स्कोर {score}, {band}{why}" },
  "insights.answer.plots": { en: "For {label}, top plots: {list}.", hi: "{label} के शीर्ष प्लॉट: {list}।" },
  "insights.answer.plotItem": {
    en: "{title} ({visits} visits, {bookings} booked)",
    hi: "{title} ({visits} विज़िट, {bookings} बुकिंग)",
  },
  "insights.answer.noPlots": { en: "No plot visits were recorded for {label}.", hi: "{label} में कोई प्लॉट विज़िट दर्ज नहीं हुई।" },
  "insights.answer.agents": { en: "For {label}: {list}.", hi: "{label}: {list}।" },
  "insights.answer.agentItem": {
    en: "{name} held {visits} visits and closed {bookings} booking(s)",
    hi: "{name}: {visits} विज़िट और {bookings} बुकिंग",
  },
  "insights.answer.noAgents": { en: "No agent activity was recorded for {label}.", hi: "{label} में एजेंट की कोई गतिविधि दर्ज नहीं हुई।" },
  "insights.answer.actions": { en: "Start with: {list}.", hi: "यहां से शुरू करें: {list}।" },
  "insights.answer.noActions": {
    en: "Nothing urgent right now. New suggestions appear as activity comes in.",
    hi: "अभी कुछ ज़रूरी नहीं है। गतिविधि बढ़ने पर नए सुझाव दिखेंगे।",
  },
  "insights.answer.performance": { en: "For {label}: {list}.", hi: "{label}: {list}।" },
  "insights.answer.unknown": {
    en: "I can answer questions about your leads, plots, team, performance and what to do next.",
    hi: "मैं आपकी लीड, प्लॉट, टीम, प्रदर्शन और अगले कदमों के बारे में बता सकता हूं।",
  },

  // AI insights: visit outcome and settings
  "visit.outcome.title": { en: "How did it go?", hi: "विज़िट कैसी रही?" },
  "visit.outcome.help": { en: "Lead scores learn from these outcomes.", hi: "लीड स्कोर इन्हीं नतीजों से सीखते हैं।" },
  "visit.outcome.recorded": { en: "Recorded: {outcome}.", hi: "दर्ज किया गया: {outcome}।" },
  "visit.outcome.interested": { en: "Interested", hi: "रुचि है" },
  "visit.outcome.not_interested": { en: "Not interested", hi: "रुचि नहीं" },
  "visit.outcome.booked": { en: "Booked", hi: "बुक हुआ" },
  "settings.insights.title": { en: "AI insights", hi: "AI इनसाइट्स" },
  "settings.insights.tracking": {
    en: "Track which dashboard sections my staff use",
    hi: "ट्रैक करें कि मेरा स्टाफ़ डैशबोर्ड के कौन से सेक्शन इस्तेमाल करता है",
  },
  "settings.insights.notice": {
    en: "Stores who opened which section and when, for 180 days, to show usage in your reports. It never records which client or plot was opened. Clients and website visitors are not tracked. Tell your staff before turning this on.",
    hi: "रिपोर्ट में उपयोग दिखाने के लिए 180 दिनों तक यह जानकारी रखी जाती है कि किसने कौन सा सेक्शन कब खोला। यह दर्ज नहीं होता कि कौन सा ग्राहक या प्लॉट खोला गया। ग्राहकों और वेबसाइट पर आने वालों को ट्रैक नहीं किया जाता। इसे चालू करने से पहले अपने स्टाफ़ को बताएं।",
  },
};

for (const [key, text] of Object.entries(MARATHI)) {
  if (dict[key]) dict[key].mr = text;
}
Object.assign(dict, COMMON, BROKER, ACCOUNT, DESIGN, DESIGN_OUTPUT, PUBLIC);

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

/** `translate` for strings with `{placeholders}`. */
export function format(key: string, locale: Locale, vars: Record<string, string | number>): string {
  return translate(key, locale).replace(/\{(\w+)\}/g, (match, name) =>
    name in vars ? String(vars[name]) : match
  );
}
