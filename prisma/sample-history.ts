import type { Prisma } from "@prisma/client";

/**
 * Three years of invented brokerage activity for the demo workspace.
 *
 * It reads like a real business on purpose: Indian names in Latin, Hindi and
 * Marathi script, plots in real cities, and WhatsApp chats in English, Hindi,
 * Hinglish and Marathi, so the language support can be judged on real-looking
 * content. None of it is real, and the Insights page says so with a demo notice.
 *
 * Nobody can be reached by accident: phone numbers start +91 0, which no Indian
 * mobile number does, and emails use the reserved example.com domain.
 *
 * Deterministic: a fixed seed means every demo database looks the same, and the
 * tests can rely on it. Each client has a hidden seriousness that drives both
 * their behaviour and whether they book, which gives the model a pattern to find.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const CLIENT_COUNT = 420;
// Three years, so the yearly report compares two complete years.
const HISTORY_DAYS = 1100;
/** Active clients in recent weeks, so the demo has live leads to act on. */
const RECENT_LEAD_COUNT = 16;
const RECENT_BOOKING_COUNT = 11;

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Language = "en" | "hi" | "mr";
type Region = "north" | "west" | "south";

const NAMES: Record<Region, { first: string[]; last: string[] }> = {
  north: {
    first: ["Rahul", "Sunita", "Amit", "Pooja", "Vikas", "Neelam", "Manoj", "Kavita", "सुरेश", "अनीता", "राजेश", "प्रीति"],
    last: ["Sharma", "Verma", "Agarwal", "Yadav", "Saxena", "Mishra", "Chauhan", "Gupta"],
  },
  west: {
    first: ["Sachin", "Ashwini", "Prasad", "Manasi", "Rohit", "Snehal", "सुनील", "अश्विनी", "मंगेश", "वैशाली", "अजय", "प्रिया"],
    last: ["Patil", "Deshmukh", "Kulkarni", "Joshi", "Shinde", "Pawar", "Jadhav", "More"],
  },
  south: {
    first: ["Karthik", "Divya", "Arjun", "Meera", "Suresh", "Lakshmi", "Vinay", "Shruti", "Imran", "Ayesha", "Rohan", "Nisha"],
    last: ["Rao", "Nair", "Iyer", "Reddy", "Menon", "Shetty", "Khan", "Hegde"],
  },
};

/** Match the surname's script to the first name's, as a real contact would be saved. */
const DEVANAGARI_SURNAMES: Record<string, string> = {
  Sharma: "शर्मा", Verma: "वर्मा", Agarwal: "अग्रवाल", Yadav: "यादव", Saxena: "सक्सेना", Mishra: "मिश्रा",
  Chauhan: "चौहान", Gupta: "गुप्ता", Patil: "पाटील", Deshmukh: "देशमुख", Kulkarni: "कुलकर्णी", Joshi: "जोशी",
  Shinde: "शिंदे", Pawar: "पवार", Jadhav: "जाधव", More: "मोरे",
};

const PLOTS: Array<{
  title: string;
  description: string;
  location: string;
  city: string;
  region: Region;
  sizeSqft: number;
  priceInr: number;
}> = [
  { title: "200 sq yd corner plot, Jagatpura", description: "East-facing corner on a 40 ft road, in a gated JDA-approved colony. Near the ring road.", location: "Jagatpura, Jaipur", city: "Jaipur", region: "north", sizeSqft: 1800, priceInr: 6_200_000 },
  { title: "वैशाली नगर में 150 गज़ का प्लॉट", description: "30 फ़ीट चौड़ी सड़क, पानी और बिजली का कनेक्शन तैयार। बाज़ार और स्कूल पास में।", location: "Vaishali Nagar, Jaipur", city: "Jaipur", region: "north", sizeSqft: 1350, priceInr: 8_900_000 },
  { title: "Gomti Nagar Extension 1500 sq ft plot", description: "North-facing plot near the Shaheed Path, boundary wall done, registry ready.", location: "Gomti Nagar Extension, Lucknow", city: "Lucknow", region: "north", sizeSqft: 1500, priceInr: 7_500_000 },
  { title: "सुपर कॉरिडोर के पास 1200 वर्ग फ़ीट प्लॉट", description: "एयरपोर्ट से 15 मिनट, टाउनशिप के अंदर, 24 घंटे सुरक्षा।", location: "Super Corridor, Indore", city: "Indore", region: "north", sizeSqft: 1200, priceInr: 4_800_000 },
  { title: "वाघोलीत 2000 चौ. फूट एनए प्लॉट", description: "एनए मंजूर, 30 फूट रस्ता, पाणी व वीज उपलब्ध. आयटी पार्कपासून 20 मिनिटांवर.", location: "Wagholi, Pune", city: "Pune", region: "west", sizeSqft: 2000, priceInr: 5_600_000 },
  { title: "Hinjawadi Phase 3, 1500 sq ft gated plot", description: "PMRDA-approved layout, clubhouse and internal roads complete. Walkable to the IT park shuttle.", location: "Hinjawadi Phase 3, Pune", city: "Pune", region: "west", sizeSqft: 1500, priceInr: 8_400_000 },
  { title: "गंगापूर रोडजवळ 1800 चौ. फूट प्लॉट", description: "गोदावरीजवळ शांत परिसर, कोपऱ्याचा प्लॉट, बंगला बांधण्यासाठी योग्य.", location: "Gangapur Road, Nashik", city: "Nashik", region: "west", sizeSqft: 1800, priceInr: 6_700_000 },
  { title: "Whitefield 30x40 east-facing plot", description: "BDA-approved 1200 sq ft site, 5 minutes from the metro, all documents clear.", location: "Whitefield, Bengaluru", city: "Bengaluru", region: "south", sizeSqft: 1200, priceInr: 11_500_000 },
  { title: "Sarjapur Road 40x60 villa plot", description: "Gated community with park frontage. Suitable for a G+2 home.", location: "Sarjapur Road, Bengaluru", city: "Bengaluru", region: "south", sizeSqft: 2400, priceInr: 16_500_000 },
  // Never visited, so the "refresh this plot" suggestion has a target.
  { title: "बगरू में 1 बीघा कृषि भूमि", description: "मुख्य सड़क से 2 किमी अंदर। कागज़ात की जांच बाकी।", location: "Bagru, Jaipur", city: "Jaipur", region: "north", sizeSqft: 27_000, priceInr: 9_500_000 },
];
const SHOWN_PLOTS = PLOTS.slice(0, -1);

const LANGUAGE_MIX: Record<Region, Language[]> = {
  north: ["hi", "hi", "en"],
  west: ["mr", "mr", "en"],
  south: ["en", "en", "en"],
};

const CLIENT_MESSAGES: Record<Language, string[]> = {
  en: [
    "Is the price negotiable?",
    "Can you share the layout plan and the approval copy?",
    "We liked the plot. Discussing at home, will get back this week.",
    "What's the registry cost on top of this?",
    "Can we come on Sunday morning with my parents?",
    "Is bank loan available for this plot?",
  ],
  hi: [
    "क्या कीमत में कुछ कम हो सकता है?",
    "प्लॉट का नक्शा और कागज़ात भेज दीजिए।",
    "प्लॉट पसंद आया, घर में बात करके बताता हूं।",
    "रजिस्ट्री का खर्च कितना आएगा?",
    "Sunday ko family ke saath aa sakte hain kya?",
    "Bank loan mil jayega is plot pe?",
  ],
  mr: [
    "किंमत थोडी कमी होऊ शकते का?",
    "प्लॉटचा नकाशा आणि कागदपत्रे पाठवा.",
    "प्लॉट आवडला, घरी बोलून कळवतो.",
    "नोंदणीचा खर्च किती येईल?",
    "रविवारी सकाळी कुटुंबासोबत येऊ शकतो का?",
    "या प्लॉटसाठी बँक कर्ज मिळेल का?",
  ],
};

const AGENT_MESSAGES: Record<Language, string[]> = {
  en: [
    "Hi {name}, thanks for your time today. Sharing the layout plan shortly.",
    "Hi {name}, the owner is open to a small discount for a quick booking. Shall we talk?",
    "Reminder: site visit tomorrow at 11 am. I'll meet you at the gate.",
  ],
  hi: [
    "नमस्ते {name} जी, आज समय देने के लिए धन्यवाद। नक्शा अभी भेजता हूं।",
    "{name} जी, मालिक जल्दी बुकिंग पर थोड़ी छूट देने को तैयार हैं। बात करें?",
    "याद दिला रहा हूं, कल सुबह 11 बजे साइट विज़िट है। मैं गेट पर मिलूंगा।",
  ],
  mr: [
    "नमस्कार {name}, आज वेळ दिल्याबद्दल धन्यवाद. नकाशा लगेच पाठवतो.",
    "{name}, लवकर बुकिंग केल्यास मालक थोडी सूट द्यायला तयार आहेत. बोलूया का?",
    "आठवण: उद्या सकाळी 11 वाजता साइट भेट आहे. मी गेटवर भेटतो.",
  ],
};

const FEEDBACK: Record<Language, { good: string[]; poor: string[] }> = {
  en: {
    good: ["Liked the location and the road width. Wants to bring family.", "Very keen. Asked about loan and registry timelines."],
    poor: ["Felt the price was high for the area.", "Prefers something closer to the highway."],
  },
  hi: {
    good: ["लोकेशन और सड़क पसंद आई। परिवार को दिखाना चाहते हैं।", "काफ़ी रुचि है। लोन और रजिस्ट्री के बारे में पूछा।"],
    poor: ["इलाके के हिसाब से कीमत ज़्यादा लगी।", "हाईवे के पास कुछ चाहते हैं।"],
  },
  mr: {
    good: ["ठिकाण आणि रस्ता आवडला. कुटुंबाला दाखवायचे आहे.", "खूप उत्सुक आहेत. कर्ज आणि नोंदणीबद्दल विचारले."],
    poor: ["परिसराच्या मानाने किंमत जास्त वाटली.", "महामार्गाजवळ काहीतरी हवे आहे."],
  },
};

const NOTES: Record<Language, string[]> = {
  en: ["Salaried couple, building for parents.", "NRI buyer, decides over video call.", "Investor, wants resale within 3 years."],
  hi: ["नौकरीपेशा परिवार, अपना घर बनाना चाहते हैं।", "निवेश के लिए देख रहे हैं।", "बेटे के नाम पर लेना चाहते हैं।"],
  mr: ["नोकरदार कुटुंब, स्वतःचे घर बांधायचे आहे.", "गुंतवणुकीसाठी पाहत आहेत.", "आई-वडिलांसाठी बंगला बांधायचा आहे."],
};

export type SampleHistory = {
  plots: Prisma.PlotCreateManyInput[];
  clients: Prisma.UserCreateManyInput[];
  visits: Prisma.VisitCreateManyInput[];
  messages: Prisma.MessageCreateManyInput[];
  events: Prisma.AnalyticsEventCreateManyInput[];
  activity: Prisma.StaffActivityCreateManyInput[];
  invitations: Prisma.InvitationCreateManyInput[];
};

export function buildSampleHistory(orgId: string, agentIds: string[], now: Date): SampleHistory {
  const rand = seededRandom(20261101);
  const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
  const ago = (days: number) => new Date(now.getTime() - days * DAY_MS);
  const after = (d: Date, days: number) => new Date(d.getTime() + days * DAY_MS);
  const isPast = (d: Date) => d.getTime() < now.getTime();

  const history: SampleHistory = {
    plots: [],
    clients: [],
    visits: [],
    messages: [],
    events: [],
    activity: [],
    invitations: [],
  };

  PLOTS.forEach((plot, i) => {
    const { region, ...fields } = plot;
    history.plots.push({ id: `sample-plot-${i}`, orgId, ...fields, photos: [], createdAt: ago(HISTORY_DAYS + 10) });
  });

  const regionPlots = (region: Region) =>
    SHOWN_PLOTS.map((p, i) => ({ p, i })).filter(({ p }) => p.region === region);

  const usedNames = new Set<string>();
  function makeName(region: Region): string {
    const pool = NAMES[region];
    // Long-past clients may share a name, as real ones do. A few tries keeps
    // repeats rare without looping forever once the pool runs out.
    let name = "";
    for (let attempt = 0; attempt < 20; attempt++) {
      const first = pick(pool.first);
      const last = pick(pool.last);
      const surname = /[ऀ-ॿ]/.test(first) ? DEVANAGARI_SURNAMES[last] ?? last : last;
      name = `${first} ${surname}`;
      if (!usedNames.has(name)) break;
    }
    usedNames.add(name);
    return name;
  }

  function addClient(n: number, region: Region, language: Language, joined: Date, agentId: string, withPreferences: boolean) {
    const id = `sample-client-${n}`;
    const name = makeName(region);
    const home = pick(regionPlots(region)).p;
    history.clients.push({
      id,
      authId: `sample-client-auth-${n}`,
      orgId,
      role: "client",
      name,
      email: `client${n}@example.com`,
      phone: `+9100000${String(n).padStart(5, "0")}`,
      ownerAgentId: agentId,
      preferences: withPreferences
        ? {
            location: home.location,
            sizeSqftMin: Math.round(home.sizeSqft * 0.8),
            sizeSqftMax: Math.round(home.sizeSqft * 1.3),
            budgetInrMin: Math.round(home.priceInr * 0.7),
            budgetInrMax: Math.round(home.priceInr * 1.15),
            facings: pick([["E"], ["N", "E"], ["E", "NE"]]),
            mustHaves: pick([["gated"], ["clear title"], ["corner"]]),
            notes: pick(NOTES[language]),
          }
        : undefined,
      createdAt: joined,
    });
    return { id, firstName: name.split(" ")[0] };
  }

  function addMessage(senderId: string, recipientId: string, at: Date, inbound: boolean, body: string) {
    if (!isPast(at)) return;
    history.messages.push({
      orgId,
      senderId,
      recipientId,
      channel: inbound ? "whatsapp_api" : "whatsapp_deeplink",
      body,
      status: inbound ? "delivered" : "queued",
      sentAt: at,
      createdAt: at,
    });
    history.events.push({
      orgId,
      type: inbound ? "message.received" : "message.sent",
      actorId: senderId,
      createdAt: at,
      metadata: inbound ? undefined : { channel: "whatsapp_deeplink" },
    });
  }

  const agentMessage = (language: Language, firstName: string) =>
    pick(AGENT_MESSAGES[language]).replace("{name}", firstName);

  for (let i = 0; i < CLIENT_COUNT; i++) {
    const agentId = pick(agentIds);
    const region = pick(["north", "north", "west", "west", "south"] as const);
    const language = pick(LANGUAGE_MIX[region]);
    // Oldest clients first, with the last few arriving in recent weeks.
    const joinedDaysAgo = Math.max(2, Math.round(HISTORY_DAYS * (1 - i / CLIENT_COUNT)) - between(0, 6));
    const joined = ago(joinedDaysAgo);
    const seriousness = rand();
    const { id, firstName } = addClient(i, region, language, joined, agentId, rand() < 0.3 + seriousness * 0.6);

    history.events.push(
      { orgId, type: "invitation.sent", actorId: agentId, createdAt: after(joined, -between(1, 3)) },
      { orgId, type: "invitation.accepted", actorId: id, createdAt: joined }
    );

    addMessage(agentId, id, after(joined, 1), false, agentMessage(language, firstName));
    for (let r = 0; r < Math.round(seriousness * 4); r++) {
      addMessage(id, agentId, after(joined, between(1, 12)), true, pick(CLIENT_MESSAGES[language]));
    }

    const visitCount = Math.round(seriousness * 2.6 + rand());
    let cursor = joined;
    let closed = false;
    for (let v = 0; v < visitCount && !closed; v++) {
      cursor = after(cursor, between(4, 20));
      const { i: plotIndex } = pick(regionPlots(region));
      const scheduledAt = cursor;
      const past = isPast(scheduledAt);
      const showed = rand() < 0.6 + seriousness * 0.35;
      const status = !past ? "scheduled" : showed ? "completed" : "no_show";

      let outcome: "interested" | "not_interested" | "booked" | undefined;
      let outcomeAt: Date | undefined;
      if (status === "completed") {
        const at = after(scheduledAt, between(1, 4));
        // Leave the newest visits undecided, so "record the outcome" has examples.
        if (at.getTime() < now.getTime() - 3 * DAY_MS) {
          const roll = rand();
          const bookedChance = seriousness * seriousness * (v > 0 ? 0.95 : 0.3);
          outcome =
            roll < bookedChance ? "booked" : roll < bookedChance + seriousness * 0.45 ? "interested" : "not_interested";
          outcomeAt = at;
          closed = outcome !== "interested";
        }
      }

      const visitId = `sample-visit-${i}-${v}`;
      history.visits.push({
        id: visitId,
        orgId,
        plotId: `sample-plot-${plotIndex}`,
        clientId: id,
        agentId,
        scheduledAt,
        status,
        outcome,
        outcomeAt,
        rating: status === "completed" && outcome ? (outcome === "not_interested" ? between(2, 3) : between(4, 5)) : undefined,
        feedback:
          status === "completed" && outcome
            ? pick(FEEDBACK[language][outcome === "not_interested" ? "poor" : "good"])
            : undefined,
        createdAt: after(scheduledAt, -between(2, 5)),
      });
      if (past) {
        history.events.push({ orgId, type: `visit.${status}`, actorId: agentId, createdAt: scheduledAt, metadata: { visitId } });
      }
      if (outcome && outcomeAt) {
        history.events.push({ orgId, type: `visit.${outcome}`, actorId: agentId, createdAt: outcomeAt, metadata: { visitId } });
      }
      addMessage(agentId, id, after(scheduledAt, 1), false, agentMessage(language, firstName));
    }
  }

  // Live pipeline. Four shapes, so leads don't all look alike or share one reason.
  usedNames.clear(); // These appear side by side on the Insights page.
  for (let i = 0; i < RECENT_LEAD_COUNT; i++) {
    const n = CLIENT_COUNT + i;
    const agentId = agentIds[i % agentIds.length];
    const region = (["north", "west", "south"] as const)[i % 3];
    const language = LANGUAGE_MIX[region][i % 2];
    const shape = i % 4; // 0 very keen, 1 keen, 2 cooling, 3 enquired but not visited
    const joined = ago(between(30, 55));
    const { id, firstName } = addClient(n, region, language, joined, agentId, shape !== 1);

    const lastTouchDaysAgo = [between(4, 9), between(5, 11), between(16, 24), between(15, 22)][shape];
    const visitDays = [[lastTouchDaysAgo + 8, lastTouchDaysAgo], [lastTouchDaysAgo], [lastTouchDaysAgo], []][shape];
    const options = regionPlots(region);

    visitDays.forEach((daysAgo, v) => {
      const scheduledAt = ago(daysAgo);
      const visitId = `sample-visit-${n}-${v}`;
      history.visits.push({
        id: visitId,
        orgId,
        plotId: `sample-plot-${options[i % options.length].i}`,
        clientId: id,
        agentId,
        scheduledAt,
        status: "completed",
        outcome: "interested",
        outcomeAt: after(scheduledAt, 1),
        rating: between(4, 5),
        feedback: pick(FEEDBACK[language].good),
        createdAt: after(scheduledAt, -3),
      });
      history.events.push({ orgId, type: "visit.completed", actorId: agentId, createdAt: scheduledAt, metadata: { visitId } });
    });

    for (let r = 0; r < [4, 3, 1, 3][shape]; r++) {
      addMessage(id, agentId, ago(lastTouchDaysAgo + r + 1), true, pick(CLIENT_MESSAGES[language]));
    }
  }

  // A steady run of recent bookings, so reports never open on an unlucky zero.
  for (let i = 0; i < RECENT_BOOKING_COUNT; i++) {
    const n = CLIENT_COUNT + RECENT_LEAD_COUNT + i;
    const agentId = agentIds[i % agentIds.length];
    const region = (["west", "north", "south"] as const)[i % 3];
    const language = LANGUAGE_MIX[region][0];
    const bookedAt = ago(3 + i * 6);
    const scheduledAt = after(bookedAt, -2);
    const { id, firstName } = addClient(n, region, language, after(bookedAt, -between(20, 40)), agentId, true);
    const options = regionPlots(region);
    const visitId = `sample-visit-${n}-0`;

    addMessage(id, agentId, after(scheduledAt, -3), true, pick(CLIENT_MESSAGES[language]));
    addMessage(agentId, id, after(scheduledAt, 1), false, agentMessage(language, firstName));
    history.visits.push({
      id: visitId,
      orgId,
      plotId: `sample-plot-${options[i % options.length].i}`,
      clientId: id,
      agentId,
      scheduledAt,
      status: "completed",
      outcome: "booked",
      outcomeAt: bookedAt,
      rating: 5,
      feedback: pick(FEEDBACK[language].good),
      createdAt: after(scheduledAt, -3),
    });
    history.events.push(
      { orgId, type: "visit.completed", actorId: agentId, createdAt: scheduledAt, metadata: { visitId } },
      { orgId, type: "visit.booked", actorId: agentId, createdAt: bookedAt, metadata: { visitId } }
    );
  }

  for (let i = 0; i < 6; i++) {
    const region = (["north", "west", "south"] as const)[i % 3];
    const name = makeName(region);
    const sent = ago(between(1, 9));
    history.invitations.push({
      id: `sample-invite-${i}`,
      orgId,
      sentById: agentIds[i % agentIds.length],
      clientName: name,
      clientPhone: `+9100001${String(i).padStart(5, "0")}`,
      token: `sample-invite-token-${i}`,
      expiresAt: after(sent, 14),
      createdAt: sent,
    });
  }

  const sections = ["/dashboard", "/dashboard/clients", "/dashboard/visits", "/dashboard/plots", "/dashboard/insights"];
  for (let d = 1; d <= 170; d++) {
    for (const userId of agentIds) {
      for (let n = between(0, 4); n > 0; n--) {
        history.activity.push({ orgId, userId, path: pick(sections), createdAt: ago(d) });
      }
    }
  }

  return history;
}
