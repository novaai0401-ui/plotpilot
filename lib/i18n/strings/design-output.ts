import type { StringTable } from "./types";

/**
 * Text the rules engine writes into a design. Saved designs keep their English
 * text, and `localizeBrief` matches it against the `en` templates below, so each
 * `en` value must stay identical to the string in lib/architect/rules.ts.
 */
export const DESIGN_OUTPUT: StringTable = {
  // Rooms
  "designOut.room.living": { en: "Living room", hi: "बैठक कक्ष", mr: "दिवाणखाना" },
  "designOut.room.dining": { en: "Dining", hi: "भोजन कक्ष", mr: "जेवणाची खोली" },
  "designOut.room.kitchen": { en: "Kitchen", hi: "रसोई", mr: "स्वयंपाकघर" },
  "designOut.room.pooja": { en: "Pooja room", hi: "पूजा कक्ष", mr: "देवघर" },
  "designOut.room.utility": { en: "Utility", hi: "यूटिलिटी", mr: "युटिलिटी" },
  "designOut.room.powder": { en: "Powder room", hi: "पाउडर रूम", mr: "पावडर रूम" },
  "designOut.room.master": { en: "Master bedroom", hi: "मास्टर बेडरूम", mr: "मास्टर बेडरूम" },
  "designOut.room.masterBath": { en: "Master bath", hi: "मास्टर बाथरूम", mr: "मास्टर बाथरूम" },
  "designOut.room.bedroomN": { en: "Bedroom {n}", hi: "बेडरूम {n}", mr: "बेडरूम {n}" },
  "designOut.room.bathN": { en: "Bath {n}", hi: "बाथरूम {n}", mr: "बाथरूम {n}" },
  "designOut.room.study": { en: "Study", hi: "अध्ययन कक्ष", mr: "अभ्यासिका" },
  "designOut.room.servant": { en: "Servant room", hi: "सहायक कक्ष", mr: "मदतनीस खोली" },
  "designOut.room.stairs": { en: "Staircase", hi: "सीढ़ियां", mr: "जिना" },
  "designOut.room.lift": { en: "Lift", hi: "लिफ़्ट", mr: "लिफ्ट" },
  "designOut.room.balcony": { en: "Balcony", hi: "बालकनी", mr: "बाल्कनी" },
  "designOut.room.terrace": { en: "Terrace access", hi: "छत का रास्ता", mr: "गच्चीकडे जाण्याचा मार्ग" },
  "designOut.room.reception": { en: "Reception & lobby", hi: "रिसेप्शन और लॉबी", mr: "रिसेप्शन आणि लॉबी" },
  "designOut.room.workstations": {
    en: "Workstation area ({n} seats)",
    hi: "वर्कस्टेशन क्षेत्र ({n} सीटें)",
    mr: "वर्कस्टेशन क्षेत्र ({n} जागा)",
  },
  "designOut.room.cabinN": { en: "Cabin {floor}-{n}", hi: "केबिन {floor}-{n}", mr: "केबिन {floor}-{n}" },
  "designOut.room.meetingN": { en: "Meeting {floor}-{n}", hi: "मीटिंग रूम {floor}-{n}", mr: "मीटिंग रूम {floor}-{n}" },
  "designOut.room.cafeteria": { en: "Cafeteria", hi: "कैफ़ेटेरिया", mr: "कॅफेटेरिया" },
  "designOut.room.mensRestroom": { en: "Men's restroom", hi: "पुरुष शौचालय", mr: "पुरुष स्वच्छतागृह" },
  "designOut.room.womensRestroom": { en: "Women's restroom", hi: "महिला शौचालय", mr: "महिला स्वच्छतागृह" },
  "designOut.room.retailN": { en: "Retail unit {n}", hi: "दुकान {n}", mr: "दुकान {n}" },
  "designOut.room.commonLobby": { en: "Common lobby", hi: "साझा लॉबी", mr: "सामायिक लॉबी" },
  "designOut.room.inUnit": { en: "Unit {n} · {name}", hi: "यूनिट {n} · {name}", mr: "युनिट {n} · {name}" },
  "designOut.room.kitchenNote": {
    en: "Place east/north-east if vastu",
    hi: "वास्तु के अनुसार पूर्व/उत्तर-पूर्व में रखें",
    mr: "वास्तूनुसार पूर्व/ईशान्य दिशेला ठेवा",
  },

  // Floors
  "designOut.floor.ground": { en: "Ground floor", hi: "भूतल", mr: "तळमजला" },
  "designOut.floor.first": { en: "First floor", hi: "पहली मंज़िल", mr: "पहिला मजला" },
  "designOut.floor.n": { en: "{n}th floor", hi: "मंज़िल {n}", mr: "मजला {n}" },

  // Warnings
  "designOut.warn.floorArea": {
    en: "Floor {floor} net area ({net} sqft) exceeds usable footprint ({max} sqft). Consider reducing room count or increasing floors.",
    hi: "मंज़िल {floor} का नेट क्षेत्रफल ({net} वर्ग फुट) उपलब्ध फ़ुटप्रिंट ({max} वर्ग फुट) से ज़्यादा है। कमरे घटाने या मंज़िलें बढ़ाने पर विचार करें।",
    mr: "मजला {floor} चे नेट क्षेत्रफळ ({net} चौ. फूट) उपलब्ध फूटप्रिंटपेक्षा ({max} चौ. फूट) जास्त आहे. खोल्या कमी करण्याचा किंवा मजले वाढवण्याचा विचार करा.",
  },
  "designOut.warn.far": {
    en: "Planned built-up ({planned} sqft) exceeds FAR cap ({max} sqft). Reduce rooms or request FAR variance.",
    hi: "प्रस्तावित बिल्ट-अप ({planned} वर्ग फुट) FAR सीमा ({max} वर्ग फुट) से ज़्यादा है। कमरे घटाएं या FAR में छूट के लिए आवेदन करें।",
    mr: "नियोजित बिल्ट-अप ({planned} चौ. फूट) FAR मर्यादेपेक्षा ({max} चौ. फूट) जास्त आहे. खोल्या कमी करा किंवा FAR सवलतीसाठी अर्ज करा.",
  },

  // Materials
  "designOut.material.rcc": { en: "RCC frame structure", hi: "RCC फ़्रेम ढांचा", mr: "RCC फ्रेम रचना" },
  "designOut.material.aac": {
    en: "AAC block walls (lightweight, thermal)",
    hi: "AAC ब्लॉक की दीवारें (हल्की, गर्मी से बचाव वाली)",
    mr: "AAC ब्लॉकच्या भिंती (हलक्या, उष्णतारोधक)",
  },
  "designOut.material.vitrified": { en: "Vitrified floor tiles", hi: "विट्रिफ़ाइड फ़र्श टाइलें", mr: "व्हिट्रिफाइड फरशी टाइल्स" },
  "designOut.material.aluminiumGlass": {
    en: "Aluminium-glass facade for windows",
    hi: "खिड़कियों के लिए एल्यूमीनियम-कांच फ़साड",
    mr: "खिडक्यांसाठी ॲल्युमिनियम-काच दर्शनी भाग",
  },
  "designOut.material.kota": { en: "Kota / granite flooring", hi: "कोटा / ग्रेनाइट फ़र्श", mr: "कोटा / ग्रॅनाइट फरशी" },
  "designOut.material.teak": { en: "Teak wood doors", hi: "सागौन की लकड़ी के दरवाज़े", mr: "सागवानी लाकडाचे दरवाजे" },
  "designOut.material.lime": { en: "Lime plaster finish", hi: "चूने का प्लास्टर", mr: "चुन्याचा गिलावा" },
  "designOut.material.upvc": { en: "UPVC windows", hi: "UPVC खिड़कियां", mr: "UPVC खिडक्या" },
  "designOut.material.flyAsh": { en: "Fly-ash bricks", hi: "फ़्लाई ऐश ईंटें", mr: "फ्लाय ॲश विटा" },
  "designOut.material.lowVoc": { en: "Low-VOC paints", hi: "कम VOC वाले पेंट", mr: "कमी VOC असलेले रंग" },
  "designOut.material.steel": { en: "Recycled steel", hi: "रीसाइकिल किया हुआ स्टील", mr: "पुनर्वापर केलेले स्टील" },

  // Mechanical, electrical, plumbing
  "designOut.mep.threePhase": { en: "3-phase electrical supply", hi: "3-फ़ेज़ बिजली आपूर्ति", mr: "3-फेज वीजपुरवठा" },
  "designOut.mep.wiring": { en: "Modular wiring with RCCB", hi: "RCCB के साथ मॉड्यूलर वायरिंग", mr: "RCCB सह मॉड्युलर वायरिंग" },
  "designOut.mep.lift": {
    en: "Passenger lift (6-8 person capacity)",
    hi: "यात्री लिफ़्ट (6-8 व्यक्ति क्षमता)",
    mr: "प्रवासी लिफ्ट (6-8 व्यक्ती क्षमता)",
  },
  "designOut.mep.solar": { en: "Rooftop solar PV (3-5 kW)", hi: "छत पर सोलर पैनल (3-5 kW)", mr: "छतावर सौर पॅनेल (3-5 kW)" },
  "designOut.mep.rainwater": {
    en: "Rainwater harvesting (recharge pit + storage tank)",
    hi: "वर्षा जल संचयन (रिचार्ज पिट + भंडारण टंकी)",
    mr: "पावसाचे पाणी साठवण (रिचार्ज खड्डा + साठवण टाकी)",
  },
  "designOut.mep.stp": { en: "STP / soak pit for waste water", hi: "गंदे पानी के लिए STP / सोख्ता गड्ढा", mr: "सांडपाण्यासाठी STP / शोषखड्डा" },
  "designOut.mep.waterTank": {
    en: "Centralized water tank (overhead + underground)",
    hi: "केंद्रीय पानी की टंकी (ऊपरी + भूमिगत)",
    mr: "मध्यवर्ती पाण्याची टाकी (वरची + भूमिगत)",
  },
  "designOut.mep.hvac": { en: "Central HVAC (VRF system)", hi: "सेंट्रल HVAC (VRF सिस्टम)", mr: "सेंट्रल HVAC (VRF प्रणाली)" },
  "designOut.mep.fire": { en: "Fire alarm + sprinkler", hi: "फ़ायर अलार्म + स्प्रिंकलर", mr: "फायर अलार्म + स्प्रिंकलर" },
  "designOut.mep.cctv": { en: "CCTV + access control", hi: "CCTV + एक्सेस कंट्रोल", mr: "CCTV + प्रवेश नियंत्रण" },

  // Code notes
  "designOut.code.setbacks": {
    en: "Setbacks: front {front}ft, rear {rear}ft, sides {side}ft.",
    hi: "सेटबैक: आगे {front} फुट, पीछे {rear} फुट, किनारों पर {side} फुट।",
    mr: "सेटबॅक: पुढे {front} फूट, मागे {rear} फूट, बाजूंना {side} फूट.",
  },
  "designOut.code.far": {
    en: "FAR cap {far}× plot area = {max} sqft max built-up.",
    hi: "FAR सीमा {far}× प्लॉट क्षेत्रफल = अधिकतम {max} वर्ग फुट बिल्ट-अप।",
    mr: "FAR मर्यादा {far}× प्लॉट क्षेत्रफळ = कमाल {max} चौ. फूट बिल्ट-अप.",
  },
  "designOut.code.height": {
    en: "Max height {height}ft per local bylaws.",
    hi: "स्थानीय उपनियमों के अनुसार अधिकतम ऊंचाई {height} फुट।",
    mr: "स्थानिक नियमांनुसार कमाल उंची {height} फूट.",
  },
  "designOut.code.accessibility": {
    en: "Accessibility: ramps ≤1:12 slope, 36in doorways, accessible WC on ground floor.",
    hi: "सुगम्यता: रैंप की ढलान अधिकतम 1:12, दरवाज़े 36 इंच चौड़े, भूतल पर सुगम शौचालय।",
    mr: "सुलभता: रॅम्पचा उतार कमाल 1:12, दरवाजे 36 इंच रुंद, तळमजल्यावर सुलभ स्वच्छतागृह.",
  },
  "designOut.code.vastu": {
    en: "Vastu: main door N/E, kitchen SE, master bedroom SW, pooja NE.",
    hi: "वास्तु: मुख्य द्वार उत्तर/पूर्व, रसोई दक्षिण-पूर्व, मास्टर बेडरूम दक्षिण-पश्चिम, पूजा कक्ष उत्तर-पूर्व।",
    mr: "वास्तू: मुख्य दरवाजा उत्तर/पूर्व, स्वयंपाकघर आग्नेय, मास्टर बेडरूम नैऋत्य, देवघर ईशान्य.",
  },
  "designOut.code.fire": {
    en: "NBC fire safety: 2 staircases if >15m height; refuge area every 7 floors.",
    hi: "NBC अग्नि सुरक्षा: 15 मीटर से ऊंची इमारत में 2 सीढ़ियां; हर 7 मंज़िल पर रिफ़्यूज एरिया।",
    mr: "NBC अग्निसुरक्षा: 15 मीटरपेक्षा उंच इमारतीत 2 जिने; दर 7 मजल्यांवर रिफ्यूज एरिया.",
  },

  // Plain room type names, shown in the Type column
  "design.roomType.bedroom": { en: "Bedroom", hi: "बेडरूम", mr: "बेडरूम" },
  "design.roomType.master_bedroom": { en: "Master bedroom", hi: "मास्टर बेडरूम", mr: "मास्टर बेडरूम" },
  "design.roomType.bathroom": { en: "Bathroom", hi: "बाथरूम", mr: "बाथरूम" },
  "design.roomType.kitchen": { en: "Kitchen", hi: "रसोई", mr: "स्वयंपाकघर" },
  "design.roomType.living": { en: "Living", hi: "बैठक", mr: "दिवाणखाना" },
  "design.roomType.dining": { en: "Dining", hi: "भोजन", mr: "जेवण" },
  "design.roomType.study": { en: "Study", hi: "अध्ययन", mr: "अभ्यास" },
  "design.roomType.pooja": { en: "Pooja", hi: "पूजा", mr: "देवघर" },
  "design.roomType.utility": { en: "Utility", hi: "यूटिलिटी", mr: "युटिलिटी" },
  "design.roomType.servant": { en: "Staff", hi: "सहायक", mr: "मदतनीस" },
  "design.roomType.balcony": { en: "Balcony", hi: "बालकनी", mr: "बाल्कनी" },
  "design.roomType.lobby": { en: "Lobby", hi: "लॉबी", mr: "लॉबी" },
  "design.roomType.stairs": { en: "Stairs", hi: "सीढ़ियां", mr: "जिना" },
  "design.roomType.lift": { en: "Lift", hi: "लिफ़्ट", mr: "लिफ्ट" },
  "design.roomType.reception": { en: "Reception", hi: "रिसेप्शन", mr: "रिसेप्शन" },
  "design.roomType.workstation_area": { en: "Workstations", hi: "वर्कस्टेशन", mr: "वर्कस्टेशन" },
  "design.roomType.cabin": { en: "Cabin", hi: "केबिन", mr: "केबिन" },
  "design.roomType.meeting_room": { en: "Meeting room", hi: "मीटिंग रूम", mr: "मीटिंग रूम" },
  "design.roomType.cafeteria": { en: "Cafeteria", hi: "कैफ़ेटेरिया", mr: "कॅफेटेरिया" },
  "design.roomType.retail_unit": { en: "Retail", hi: "दुकान", mr: "दुकान" },
  "design.roomType.parking": { en: "Parking", hi: "पार्किंग", mr: "पार्किंग" },
  "design.roomType.terrace": { en: "Terrace", hi: "छत", mr: "गच्ची" },
  "design.roomType.garden": { en: "Garden", hi: "बगीचा", mr: "बाग" },

  // Floor plan drawing
  "design.plan.heading": { en: "{label} — {net} sqft net", hi: "{label} — नेट {net} वर्ग फुट", mr: "{label} — नेट {net} चौ. फूट" },
  "design.plan.facing": {
    en: "facing {facing} · scale 1ft = {scale}px",
    hi: "दिशा: {facing} · पैमाना 1 फुट = {scale}px",
    mr: "दिशा: {facing} · प्रमाण 1 फूट = {scale}px",
  },
  "design.plan.areaShort": { en: "{value} sqft", hi: "{value} व. फु.", mr: "{value} चौ. फू." },

  // PDF
  "design.pdf.title": { en: "Building Design", hi: "बिल्डिंग डिज़ाइन", mr: "इमारत डिझाइन" },
  "design.pdf.subtitle": { en: "{type} · {area} sqft plot", hi: "{type} · {area} वर्ग फुट का प्लॉट", mr: "{type} · {area} चौ. फूट प्लॉट" },
  "design.pdf.floors": { en: "Floors", hi: "मंज़िलें", mr: "मजले" },
  "design.pdf.floorSummary": {
    en: "Net area: {net} sqft · {rooms} rooms",
    hi: "नेट क्षेत्रफल: {net} वर्ग फुट · {rooms} कमरे",
    mr: "नेट क्षेत्रफळ: {net} चौ. फूट · {rooms} खोल्या",
  },
  "design.pdf.floorCost": { en: "est. ₹{amount}", hi: "अनुमानित ₹{amount}", mr: "अंदाजे ₹{amount}" },
  "design.pdf.roomSchedule": { en: "Room schedule", hi: "कमरों की सूची", mr: "खोल्यांची यादी" },
  "design.pdf.specs": { en: "Specifications & code", hi: "विनिर्देश और नियम", mr: "तपशील आणि नियम" },

  // Design brief shown when the AI writer is unavailable
  "design.kind.residential_house": { en: "home", hi: "घर", mr: "घर" },
  "design.kind.residential_apartment": { en: "apartment building", hi: "अपार्टमेंट बिल्डिंग", mr: "अपार्टमेंट इमारत" },
  "design.kind.commercial_office": { en: "office space", hi: "ऑफ़िस स्पेस", mr: "ऑफिस जागा" },
  "design.kind.commercial_retail": { en: "retail space", hi: "रिटेल स्पेस", mr: "रिटेल जागा" },
  "design.kind.mixed_use": { en: "mixed-use building", hi: "मिश्रित उपयोग बिल्डिंग", mr: "मिश्र वापराची इमारत" },
  "design.narrative.overviewTitle": { en: "Overview", hi: "सारांश", mr: "सारांश" },
  "design.narrative.overview": {
    en: "A {style} {kind} of {builtUp} sqft across {floors} floor(s) on a {plot} sqft plot. The design prioritizes practical room sizing within local FAR constraints ({far}% used).",
    hi: "{plot} वर्ग फुट के प्लॉट पर {floors} मंज़िल में {builtUp} वर्ग फुट का {style} {kind}। यह डिज़ाइन स्थानीय FAR सीमा के भीतर ({far}% इस्तेमाल) कमरों के व्यावहारिक आकार को प्राथमिकता देता है।",
    mr: "{plot} चौ. फूट प्लॉटवर {floors} मजल्यांमध्ये {builtUp} चौ. फूट {style} {kind}. हे डिझाइन स्थानिक FAR मर्यादेत ({far}% वापर) खोल्यांच्या व्यावहारिक आकाराला प्राधान्य देते.",
  },
  "design.narrative.layoutTitle": { en: "Layout & flow", hi: "लेआउट और आवाजाही", mr: "लेआउट आणि वावर" },
  "design.narrative.layout": {
    en: "The ground floor anchors the building with common-use spaces; upper floors stack private rooms. Setbacks of {front}ft front and {side}ft sides preserve light and ventilation on all faces.",
    hi: "भूतल पर साझा उपयोग की जगहें हैं और ऊपरी मंज़िलों पर निजी कमरे। आगे {front} फुट और किनारों पर {side} फुट के सेटबैक से चारों ओर रोशनी और हवा बनी रहती है।",
    mr: "तळमजल्यावर सामायिक वापराच्या जागा आहेत आणि वरच्या मजल्यांवर खासगी खोल्या. पुढे {front} फूट आणि बाजूंना {side} फूट सेटबॅकमुळे सर्व बाजूंनी प्रकाश आणि हवा मिळते.",
  },
  "design.narrative.vastu": {
    en: "Room positions follow Vastu directional principles.",
    hi: "कमरों की स्थिति वास्तु की दिशाओं के अनुसार है।",
    mr: "खोल्यांची रचना वास्तूच्या दिशांनुसार आहे.",
  },
  "design.narrative.recommendationsTitle": { en: "Recommendations", hi: "सुझाव", mr: "शिफारसी" },
  "design.narrative.windows": {
    en: "Consider upgrading windows to double-glazed UPVC for thermal performance.",
    hi: "गर्मी से बेहतर बचाव के लिए डबल-ग्लेज़्ड UPVC खिड़कियों पर विचार करें।",
    mr: "उष्णतारोधनासाठी डबल-ग्लेझ्ड UPVC खिडक्यांचा विचार करा.",
  },
  "design.narrative.solar": {
    en: "A 3 kW rooftop solar array would offset ~60% of monthly grid usage.",
    hi: "छत पर 3 kW का सोलर सिस्टम हर महीने की बिजली खपत का लगभग 60% पूरा कर सकता है।",
    mr: "छतावरील 3 kW सौर यंत्रणा दरमहा वीजवापराच्या सुमारे 60% गरज भागवू शकते.",
  },
  "design.narrative.rainwater": {
    en: "Add rainwater harvesting — pays back within 4 years in most metros.",
    hi: "वर्षा जल संचयन जोड़ें — ज़्यादातर महानगरों में इसकी लागत 4 साल में निकल आती है।",
    mr: "पावसाचे पाणी साठवण जोडा — बहुतेक महानगरांत याचा खर्च 4 वर्षांत वसूल होतो.",
  },
  "design.narrative.nextStepsTitle": { en: "Next steps", hi: "अगले कदम", mr: "पुढील पावले" },
  "design.narrative.step1": {
    en: "Confirm local bylaw setbacks and FAR with the municipal authority before locking the layout.",
    hi: "लेआउट तय करने से पहले नगर निकाय से स्थानीय सेटबैक और FAR की पुष्टि करें।",
    mr: "लेआउट निश्चित करण्यापूर्वी महापालिकेकडून स्थानिक सेटबॅक आणि FAR ची खात्री करा.",
  },
  "design.narrative.step2": {
    en: "Get 2-3 structural engineer quotes against this room list.",
    hi: "इस कमरों की सूची के आधार पर 2-3 स्ट्रक्चरल इंजीनियरों से कोटेशन लें।",
    mr: "या खोल्यांच्या यादीनुसार 2-3 स्ट्रक्चरल इंजिनिअरकडून कोटेशन घ्या.",
  },
  "design.narrative.step3": {
    en: "Decide finishes (flooring, paint, fixtures) — this drives 20-30% of total cost.",
    hi: "फ़िनिश तय करें (फ़र्श, पेंट, फ़िटिंग) — कुल लागत का 20-30% इसी पर निर्भर करता है।",
    mr: "फिनिशिंग ठरवा (फरशी, रंग, फिटिंग्ज) — एकूण खर्चाच्या 20-30% यावर अवलंबून असतो.",
  },
};
