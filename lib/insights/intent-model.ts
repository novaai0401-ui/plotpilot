import type { Locale } from "@/lib/i18n/dict";

/**
 * Small question classifier that runs inside the app, with no outside service.
 *
 * It's a naive Bayes model: it starts from the example phrases below, in
 * English, Hindi, Marathi and romanized Hindi/Marathi, and it learns from each
 * org's corrections. When it can't place a question, the user picks the topic
 * and that phrase becomes training data, so the next similar question works.
 *
 * What it is NOT: a language model. It sorts a question into one of five topics
 * so we can answer from computed figures. Free-form replies need the LLM.
 */

export const TOPICS = ["leads", "plots", "agents", "actions", "performance"] as const;
export type Topic = (typeof TOPICS)[number];
export type Intent = Topic | "unknown";

const SEED_PHRASES: Record<Topic, string[]> = {
  leads: [
    "which leads are strongest",
    "best clients buyers customers prospects",
    "show my hot leads",
    "who is my best client",
    "कौन से ग्राहक सबसे अच्छे हैं",
    "मेरी लीड दिखाओ ग्राहक खरीदार",
    "कोणते ग्राहक चांगले आहेत",
    "माझे ग्राहक लीड खरेदीदार दाखवा",
    "kaun sa grahak lead dikhao",
    "konte grahak lead dakhva",
  ],
  plots: [
    "top plots listings property land",
    "which plot is getting visits",
    "show plots",
    "किन प्लॉट पर विज़िट हो रही हैं",
    "कौन सा प्लॉट जमीन ज़मीन",
    "कोणते प्लॉट जमीन भूखंड",
    "plot jamin zameen kaun sa",
  ],
  agents: [
    "how is my team agents staff doing",
    "which agent broker is best",
    "team team team performance of agents",
    "मेरी टीम एजेंट स्टाफ़ कैसा है",
    "सबसे अच्छा एजेंट टीम",
    "माझी टीम एजंट कर्मचारी",
    "सर्वात चांगला एजंट टीम",
    "team agent kaisa",
  ],
  actions: [
    "what should I do next",
    "what should i focus on today",
    "suggest recommend priority should should",
    "आज क्या करूं सुझाव",
    "मुझे क्या करना चाहिए अगला कदम",
    "आज काय करू सल्ला",
    "मी काय करावे पुढे",
    "kya karu aaj sujhav",
    "kay karu aaj",
  ],
  performance: [
    "how did we do last month",
    "how was this week report",
    "bookings sales visits this year performance",
    "report of the month",
    "इस बार कैसा रहा रिपोर्ट",
    "इस महीने की बुकिंग बिक्री",
    "या महिन्यात कसे झाले अहवाल",
    "बुकिंग विक्री रिपोर्ट महिना",
    "kaisa raha report booking",
    "kase zale report booking",
  ],
};

/** Common words that say nothing about the topic. */
const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "of", "to", "in", "on", "my", "our", "me", "i", "we", "s",
  "what", "which", "who", "this", "that", "do", "did", "for", "and", "about",
  "क्या", "कौन", "है", "हैं", "का", "की", "के", "को", "में", "पर", "से", "मेरा", "मेरी", "मेरे", "और",
  "काय", "आहे", "आहेत", "चा", "ची", "चे", "ला", "माझा", "माझी", "माझे", "आणि",
]);

/** Learned phrases count for more than one seed line, so a correction takes effect. */
const LEARNED_WEIGHT = 4;
const MIN_PREFIX_LENGTH = 3;

export type LearnedPhrase = { question: string; intent: string };

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{M}]+/gu) ?? []).filter((t) => !STOP_WORDS.has(t));
}

export type IntentModel = {
  counts: Record<Topic, Map<string, number>>;
  totals: Record<Topic, number>;
  vocabulary: string[];
};

export function buildIntentModel(learned: LearnedPhrase[] = []): IntentModel {
  const counts = Object.fromEntries(TOPICS.map((t) => [t, new Map<string, number>()])) as IntentModel["counts"];
  const totals = Object.fromEntries(TOPICS.map((t) => [t, 0])) as IntentModel["totals"];
  const vocabulary = new Set<string>();

  const add = (topic: Topic, phrase: string, weight: number) => {
    for (const token of tokenize(phrase)) {
      counts[topic].set(token, (counts[topic].get(token) ?? 0) + weight);
      totals[topic] += weight;
      vocabulary.add(token);
    }
  };

  for (const topic of TOPICS) for (const phrase of SEED_PHRASES[topic]) add(topic, phrase, 1);
  for (const { question, intent } of learned) {
    if ((TOPICS as readonly string[]).includes(intent)) add(intent as Topic, question, LEARNED_WEIGHT);
  }
  // Longest first, so "ग्राहकों" resolves to the most specific known word.
  return { counts, totals, vocabulary: Array.from(vocabulary).sort((a, b) => b.length - a.length) };
}

/** Map a word to one the model knows. Indian languages inflect by suffix, so match on the stem. */
function resolveToken(token: string, model: IntentModel): string | null {
  for (const word of model.vocabulary) {
    if (word === token) return word;
    if (word.length >= MIN_PREFIX_LENGTH && token.startsWith(word)) return word;
  }
  return null;
}

export function classifyIntent(question: string, model: IntentModel): Intent {
  const known = tokenize(question)
    .map((t) => resolveToken(t, model))
    .filter((t): t is string => t !== null);
  if (known.length === 0) return "unknown";

  const size = model.vocabulary.length;
  let best: Intent = "unknown";
  let bestScore = -Infinity;
  for (const topic of TOPICS) {
    const score = known.reduce(
      (sum, token) => sum + Math.log(((model.counts[topic].get(token) ?? 0) + 0.1) / (model.totals[topic] + 0.1 * size)),
      0
    );
    if (score > bestScore) {
      bestScore = score;
      best = topic;
    }
  }
  return best;
}

const DEVANAGARI = /[ऀ-ॿ]/;
const MARATHI_WORDS = /(^|\s)(आहे|आहेत|काय|कोणते|कोणता|कसे|कसा|माझे|माझी|आम्ही|मला|किती|करू|दाखवा|झाले|महिन्यात|सर्वात)(?=\s|[?।.,!]|$)/gu;
const HINDI_WORDS = /(^|\s)(है|हैं|क्या|कौन|किन|कैसा|कैसे|मेरा|मेरी|मुझे|हम|कितने|करूं|दिखाओ|रहा|महीने|सबसे)(?=\s|[?।.,!]|$)/gu;
const ROMAN_HINDI = /\b(kya|kaun|kaisa|kaise|hai|hain|karu|dikhao|raha|mujhe|grahak|kitne|kitni|meri|mera|mere)\b/i;
const ROMAN_MARATHI = /\b(kay|konte|kase|aahe|ahet|dakhva|zale|mala|kiti)\b/i;

/**
 * Which language to answer in. Hindi and Marathi share a script, so tell them
 * apart by common words, and fall back to the viewer's language on a tie.
 */
export function detectLanguage(question: string, uiLocale: Locale): Locale {
  if (DEVANAGARI.test(question)) {
    const marathi = question.match(MARATHI_WORDS)?.length ?? 0;
    const hindi = question.match(HINDI_WORDS)?.length ?? 0;
    if (marathi !== hindi) return marathi > hindi ? "mr" : "hi";
    return uiLocale === "mr" ? "mr" : "hi";
  }
  if (ROMAN_MARATHI.test(question)) return "mr";
  if (ROMAN_HINDI.test(question)) return "hi";
  return "en";
}
