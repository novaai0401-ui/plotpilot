import type { StringTable } from "./types";

/** AI architect: wizard, design viewer, 3D viewer, designs list. */
export const DESIGN: StringTable = {
  // Shared units and amounts
  "design.sqft": { en: "sqft", hi: "वर्ग फुट", mr: "चौ. फूट" },
  "design.sqftValue": { en: "{value} sqft", hi: "{value} वर्ग फुट", mr: "{value} चौ. फूट" },
  "design.perSqft": { en: "@ ₹{rate}/sqft", hi: "₹{rate}/वर्ग फुट की दर से", mr: "₹{rate}/चौ. फूट दराने" },
  "design.perSqftShort": { en: "(₹{rate}/sf)", hi: "(₹{rate}/वर्ग फुट)", mr: "(₹{rate}/चौ. फूट)" },
  "design.amount.crore": { en: "{value}Cr", hi: "{value} करोड़", mr: "{value} कोटी" },
  "design.amount.lakh": { en: "{value}L", hi: "{value} लाख", mr: "{value} लाख" },
  "design.amount.thousand": { en: "{value}K", hi: "{value} हज़ार", mr: "{value} हजार" },
  "design.costRange": { en: "₹{low}L – {high}L", hi: "₹{low} लाख – {high} लाख", mr: "₹{low} लाख – {high} लाख" },

  // Project types: full labels
  "design.projectType.residential_house": {
    en: "Residential — standalone house / villa",
    hi: "आवासीय — स्वतंत्र मकान / विला",
    mr: "निवासी — स्वतंत्र बंगला / व्हिला",
  },
  "design.projectType.residential_apartment": {
    en: "Residential — apartment building",
    hi: "आवासीय — अपार्टमेंट बिल्डिंग",
    mr: "निवासी — अपार्टमेंट इमारत",
  },
  "design.projectType.commercial_office": {
    en: "Commercial — office",
    hi: "कमर्शियल — ऑफ़िस",
    mr: "व्यावसायिक — ऑफिस",
  },
  "design.projectType.commercial_retail": {
    en: "Commercial — retail / shop",
    hi: "कमर्शियल — रिटेल / दुकान",
    mr: "व्यावसायिक — रिटेल / दुकान",
  },
  "design.projectType.mixed_use": {
    en: "Mixed-use (retail + residential)",
    hi: "मिश्रित उपयोग (दुकान + आवासीय)",
    mr: "मिश्र वापर (दुकाने + निवासी)",
  },

  // Project types: short labels for the review badge
  "design.projectTypeShort.residential_house": { en: "residential house", hi: "आवासीय मकान", mr: "निवासी घर" },
  "design.projectTypeShort.residential_apartment": {
    en: "residential apartment",
    hi: "आवासीय अपार्टमेंट",
    mr: "निवासी अपार्टमेंट",
  },
  "design.projectTypeShort.commercial_office": { en: "commercial office", hi: "कमर्शियल ऑफ़िस", mr: "व्यावसायिक ऑफिस" },
  "design.projectTypeShort.commercial_retail": { en: "commercial retail", hi: "कमर्शियल रिटेल", mr: "व्यावसायिक रिटेल" },
  "design.projectTypeShort.mixed_use": { en: "mixed use", hi: "मिश्रित उपयोग", mr: "मिश्र वापर" },

  // Facing
  "design.facing.N": { en: "N", hi: "उत्तर", mr: "उत्तर" },
  "design.facing.E": { en: "E", hi: "पूर्व", mr: "पूर्व" },
  "design.facing.S": { en: "S", hi: "दक्षिण", mr: "दक्षिण" },
  "design.facing.W": { en: "W", hi: "पश्चिम", mr: "पश्चिम" },
  "design.facing.NE": { en: "NE", hi: "उत्तर-पूर्व", mr: "ईशान्य" },
  "design.facing.NW": { en: "NW", hi: "उत्तर-पश्चिम", mr: "वायव्य" },
  "design.facing.SE": { en: "SE", hi: "दक्षिण-पूर्व", mr: "आग्नेय" },
  "design.facing.SW": { en: "SW", hi: "दक्षिण-पश्चिम", mr: "नैऋत्य" },

  // Style
  "design.style.modern": { en: "Modern", hi: "मॉडर्न", mr: "मॉडर्न" },
  "design.style.contemporary": { en: "Contemporary", hi: "समकालीन", mr: "समकालीन" },
  "design.style.traditional": { en: "Traditional", hi: "पारंपरिक", mr: "पारंपरिक" },
  "design.style.minimalist": { en: "Minimalist", hi: "मिनिमलिस्ट", mr: "मिनिमलिस्ट" },
  "design.style.industrial": { en: "Industrial", hi: "इंडस्ट्रियल", mr: "इंडस्ट्रियल" },
  "design.style.mediterranean": { en: "Mediterranean", hi: "मेडिटेरेनियन", mr: "मेडिटेरेनियन" },
  "design.style.colonial": { en: "Colonial", hi: "कोलोनियल", mr: "कोलोनियल" },

  // Climate
  "design.climate.tropical": { en: "Tropical", hi: "उष्णकटिबंधीय", mr: "उष्णकटिबंधीय" },
  "design.climate.temperate": { en: "Temperate", hi: "समशीतोष्ण", mr: "समशीतोष्ण" },
  "design.climate.arid": { en: "Arid", hi: "शुष्क", mr: "कोरडे" },
  "design.climate.cold": { en: "Cold", hi: "ठंडी", mr: "थंड" },
  "design.climate.humid": { en: "Humid", hi: "नम", mr: "दमट" },

  // Wizard: frame
  "design.wizard.title": { en: "Design a building", hi: "इमारत डिज़ाइन करें", mr: "इमारत डिझाइन करा" },
  "design.wizard.subtitle": {
    en: "Walk through six steps; the engine handles the rest.",
    hi: "छह आसान चरण पूरे करें, बाकी काम हम संभाल लेंगे।",
    mr: "सहा पायऱ्या पूर्ण करा, बाकीचे आम्ही पाहू.",
  },
  "design.wizard.formLabel": { en: "Building design wizard", hi: "इमारत डिज़ाइन फ़ॉर्म", mr: "इमारत डिझाइन फॉर्म" },
  "design.wizard.stepHeading": {
    en: "Step {current} of {total}: {title} — {description}",
    hi: "{total} में से चरण {current}: {title} — {description}",
    mr: "{total} पैकी पायरी {current}: {title} — {description}",
  },

  // Wizard: steps. Never use an ampersand here, TkxStepper escapes it.
  "design.wizard.step.project.title": { en: "Project", hi: "प्रोजेक्ट", mr: "प्रकल्प" },
  "design.wizard.step.project.desc": { en: "Type and purpose", hi: "प्रकार और उद्देश्य", mr: "प्रकार आणि उद्देश" },
  "design.wizard.step.plot.desc": { en: "Size and rules", hi: "आकार और नियम", mr: "आकार आणि नियम" },
  "design.wizard.step.layout.title": { en: "Layout", hi: "लेआउट", mr: "लेआउट" },
  "design.wizard.step.layout.desc": { en: "Rooms and floors", hi: "कमरे और मंज़िलें", mr: "खोल्या आणि मजले" },
  "design.wizard.step.amenities.title": { en: "Amenities", hi: "सुविधाएं", mr: "सुविधा" },
  "design.wizard.step.amenities.desc": { en: "Add-ons", hi: "अतिरिक्त सुविधाएं", mr: "अतिरिक्त गोष्टी" },
  "design.wizard.step.style.title": { en: "Style", hi: "स्टाइल", mr: "शैली" },
  "design.wizard.step.style.desc": { en: "Look and feel", hi: "कैसा दिखे", mr: "कसे दिसावे" },
  "design.wizard.step.review.title": { en: "Review", hi: "जांचें", mr: "तपासा" },
  "design.wizard.step.review.desc": { en: "Generate", hi: "डिज़ाइन बनाएं", mr: "डिझाइन तयार करा" },

  // Wizard: project and plot
  "design.wizard.projectType": { en: "Project type", hi: "प्रोजेक्ट का प्रकार", mr: "प्रकल्पाचा प्रकार" },
  "design.wizard.totalArea": {
    en: "Total plot area (sqft)",
    hi: "प्लॉट का कुल क्षेत्रफल (वर्ग फुट)",
    mr: "प्लॉटचे एकूण क्षेत्रफळ (चौ. फूट)",
  },
  "design.wizard.facing": { en: "Facing", hi: "दिशा", mr: "दिशा" },
  "design.wizard.frontage": {
    en: "Frontage (ft) — optional",
    hi: "सामने की चौड़ाई (फुट) — वैकल्पिक",
    mr: "दर्शनी रुंदी (फूट) — ऐच्छिक",
  },
  "design.wizard.depth": {
    en: "Depth (ft) — optional",
    hi: "गहराई (फुट) — वैकल्पिक",
    mr: "खोली (फूट) — ऐच्छिक",
  },
  "design.wizard.farCap": { en: "FAR cap", hi: "अधिकतम FAR (FSI)", mr: "कमाल FAR (FSI)" },
  "design.wizard.setbackFront": {
    en: "Setback front (ft)",
    hi: "सामने का सेटबैक (फुट)",
    mr: "समोरचा सेटबॅक (फूट)",
  },
  "design.wizard.setbackRear": { en: "Setback rear (ft)", hi: "पीछे का सेटबैक (फुट)", mr: "मागचा सेटबॅक (फूट)" },
  "design.wizard.setbackSide": { en: "Setback sides (ft)", hi: "बगल का सेटबैक (फुट)", mr: "बाजूचा सेटबॅक (फूट)" },

  // Wizard: layout
  "design.wizard.floors": { en: "Number of floors", hi: "मंज़िलों की संख्या", mr: "मजल्यांची संख्या" },
  "design.wizard.unitsPerFloor": { en: "Units per floor", hi: "हर मंज़िल पर यूनिट", mr: "प्रत्येक मजल्यावरील युनिट" },
  "design.wizard.residentialRooms": { en: "Residential rooms", hi: "रहने के कमरे", mr: "राहण्याच्या खोल्या" },
  "design.wizard.perUnit": { en: "(per unit)", hi: "(प्रति यूनिट)", mr: "(प्रति युनिट)" },
  "design.wizard.bedrooms": { en: "Bedrooms", hi: "बेडरूम", mr: "बेडरूम" },
  "design.wizard.bathrooms": { en: "Bathrooms", hi: "बाथरूम", mr: "बाथरूम" },
  "design.wizard.livingRooms": { en: "Living rooms", hi: "लिविंग रूम", mr: "लिव्हिंग रूम" },
  "design.wizard.studyRooms": { en: "Study rooms", hi: "स्टडी रूम", mr: "स्टडी रूम" },
  "design.wizard.poojaRooms": { en: "Pooja rooms", hi: "पूजा घर", mr: "देवघर" },
  "design.wizard.commercialSpaces": { en: "Commercial spaces", hi: "कमर्शियल जगह", mr: "व्यावसायिक जागा" },
  "design.wizard.workstations": { en: "Workstations", hi: "वर्कस्टेशन", mr: "वर्कस्टेशन" },
  "design.wizard.cabins": { en: "Cabins", hi: "केबिन", mr: "केबिन" },
  "design.wizard.meetingRooms": { en: "Meeting rooms", hi: "मीटिंग रूम", mr: "मीटिंग रूम" },
  "design.wizard.retailUnits": { en: "Retail units", hi: "रिटेल यूनिट", mr: "रिटेल युनिट" },
  "design.wizard.cafeteria": { en: "Cafeteria", hi: "कैफ़ेटेरिया", mr: "कॅफेटेरिया" },
  "design.wizard.parking": { en: "Parking", hi: "पार्किंग", mr: "पार्किंग" },
  "design.wizard.carParking": { en: "Car parking", hi: "कार पार्किंग", mr: "कार पार्किंग" },
  "design.wizard.bikeParking": { en: "Bike parking", hi: "बाइक पार्किंग", mr: "बाईक पार्किंग" },

  // Wizard: amenities
  "design.wizard.balcony": { en: "Balcony", hi: "बालकनी", mr: "बालकनी" },
  "design.wizard.terrace": { en: "Terrace", hi: "टैरेस", mr: "टेरेस" },
  "design.wizard.garden": { en: "Garden", hi: "बगीचा", mr: "बाग" },
  "design.wizard.lift": { en: "Lift", hi: "लिफ़्ट", mr: "लिफ्ट" },
  "design.wizard.solar": { en: "Solar PV", hi: "सोलर पैनल", mr: "सोलर पॅनेल" },
  "design.wizard.rainwater": {
    en: "Rainwater harvesting",
    hi: "बारिश के पानी का संचयन",
    mr: "पावसाच्या पाण्याची साठवण",
  },

  // Wizard: style
  "design.wizard.style": { en: "Style", hi: "स्टाइल", mr: "शैली" },
  "design.wizard.climate": { en: "Climate", hi: "जलवायु", mr: "हवामान" },
  "design.wizard.vastu": { en: "Vastu compliant", hi: "वास्तु के अनुसार", mr: "वास्तुनुसार" },
  "design.wizard.accessibility": { en: "Accessibility", hi: "दिव्यांग-अनुकूल", mr: "दिव्यांगांसाठी सोयीचे" },
  "design.wizard.sustainable": {
    en: "Sustainable build",
    hi: "पर्यावरण-अनुकूल निर्माण",
    mr: "पर्यावरणपूरक बांधकाम",
  },
  "design.wizard.notes": { en: "Notes for the AI (optional)", hi: "AI के लिए नोट्स (वैकल्पिक)", mr: "AI साठी सूचना (ऐच्छिक)" },
  "design.wizard.notesHint": {
    en: "Anything special — accessibility needs, plot constraints, design references.",
    hi: "कुछ खास हो तो लिखें — दिव्यांग सुविधा की ज़रूरत, प्लॉट की पाबंदियां, डिज़ाइन के उदाहरण।",
    mr: "काही खास असेल तर लिहा — दिव्यांगांसाठीच्या गरजा, प्लॉटच्या मर्यादा, डिझाइनचे संदर्भ.",
  },

  // Wizard: review and contact
  "design.wizard.contactTitle": { en: "Contact details", hi: "संपर्क विवरण", mr: "संपर्क तपशील" },
  "design.wizard.contactBody": {
    en: "Share these so a broker in your area can follow up. We'll never spam you.",
    hi: "ये जानकारी दें ताकि आपके इलाके का ब्रोकर आपसे संपर्क कर सके। हम आपको कभी स्पैम नहीं करेंगे।",
    mr: "ही माहिती द्या, म्हणजे तुमच्या भागातील ब्रोकर तुमच्याशी संपर्क करू शकेल. आम्ही तुम्हाला कधीही स्पॅम करणार नाही.",
  },
  "design.wizard.cityPlaceholder": { en: "e.g. Bangalore", hi: "जैसे बेंगलुरु", mr: "उदा. बेंगळुरू" },
  "design.wizard.locationShared": {
    en: "Location shared (matches nearby brokers)",
    hi: "लोकेशन शेयर हो गई (नज़दीकी ब्रोकर मिलेंगे)",
    mr: "लोकेशन शेअर झाले (जवळचे ब्रोकर शोधले जातील)",
  },
  "design.wizard.shareLocation": {
    en: "Share my location (optional)",
    hi: "मेरी लोकेशन शेयर करें (वैकल्पिक)",
    mr: "माझे लोकेशन शेअर करा (ऐच्छिक)",
  },
  "design.wizard.summary": { en: "Summary", hi: "सारांश", mr: "सारांश" },
  "design.wizard.summary.facing": { en: "facing {facing}", hi: "दिशा: {facing}", mr: "दिशा: {facing}" },
  "design.wizard.summary.floor": { en: "{count} floor", hi: "{count} मंज़िल", mr: "{count} मजला" },
  "design.wizard.summary.floors": { en: "{count} floors", hi: "{count} मंज़िलें", mr: "{count} मजले" },
  "design.wizard.summary.units": { en: "{count} units", hi: "{count} यूनिट", mr: "{count} युनिट" },
  "design.wizard.summary.rooms": {
    en: "{bedrooms} BR · {bathrooms} BA · {living} LR",
    hi: "{bedrooms} बेडरूम · {bathrooms} बाथरूम · {living} लिविंग रूम",
    mr: "{bedrooms} बेडरूम · {bathrooms} बाथरूम · {living} लिव्हिंग रूम",
  },
  "design.wizard.summary.pooja": { en: "{count} pooja", hi: "{count} पूजा घर", mr: "{count} देवघर" },
  "design.wizard.summary.study": { en: "{count} study", hi: "{count} स्टडी रूम", mr: "{count} स्टडी रूम" },
  "design.wizard.summary.commercial": {
    en: "{workstations} workstations · {cabins} cabins · {meetings} meetings",
    hi: "{workstations} वर्कस्टेशन · {cabins} केबिन · {meetings} मीटिंग रूम",
    mr: "{workstations} वर्कस्टेशन · {cabins} केबिन · {meetings} मीटिंग रूम",
  },
  "design.wizard.summary.retail": { en: "{count} retail", hi: "{count} रिटेल", mr: "{count} रिटेल" },
  "design.wizard.summary.styleClimate": {
    en: "{style}, {climate} climate",
    hi: "{style}, जलवायु: {climate}",
    mr: "{style}, हवामान: {climate}",
  },

  // Wizard: actions
  "design.wizard.generate": { en: "Generate design", hi: "डिज़ाइन बनाएं", mr: "डिझाइन तयार करा" },
  "design.wizard.generating": {
    en: "Generating design (~30s)…",
    hi: "डिज़ाइन बन रहा है (करीब 30 सेकंड)…",
    mr: "डिझाइन तयार होत आहे (सुमारे 30 सेकंद)…",
  },
  "design.wizard.cannotSubmit": {
    en: "Fill in name and phone in the review step before generating.",
    hi: "डिज़ाइन बनाने से पहले आखिरी चरण में नाम और फ़ोन भरें।",
    mr: "डिझाइन तयार करण्यापूर्वी शेवटच्या पायरीवर नाव आणि फोन भरा.",
  },
  "design.wizard.generated": { en: "Design generated!", hi: "डिज़ाइन तैयार है!", mr: "डिझाइन तयार झाले!" },
  "design.wizard.failed": { en: "Generation failed", hi: "डिज़ाइन नहीं बन सका", mr: "डिझाइन तयार होऊ शकले नाही" },

  // Design viewer: exports
  "design.viewer.loading3d": { en: "Loading 3D viewer…", hi: "3D व्यू लोड हो रहा है…", mr: "3D व्ह्यू लोड होत आहे…" },
  "design.viewer.exportFormats": { en: "Two export formats:", hi: "एक्सपोर्ट के दो फ़ॉर्मेट:", mr: "एक्सपोर्टचे दोन फॉरमॅट:" },
  "design.viewer.pdfHelp": {
    en: "for clients, prospects, sharing. Includes brief + floor plans + cost estimate.",
    hi: "ग्राहकों, संभावित खरीदारों और शेयर करने के लिए। इसमें ब्रीफ़, फ़्लोर प्लान और लागत का अनुमान शामिल है।",
    mr: "ग्राहक, संभाव्य खरेदीदार आणि शेअर करण्यासाठी. यात ब्रीफ, फ्लोअर प्लॅन आणि खर्चाचा अंदाज आहे.",
  },
  "design.viewer.dxfHelp": {
    en: "for architects/engineers. Open standard, imports cleanly into AutoCAD, LibreCAD, QCAD, DraftSight, FreeCAD, BricsCAD.",
    hi: "आर्किटेक्ट और इंजीनियरों के लिए। ओपन स्टैंडर्ड, AutoCAD, LibreCAD, QCAD, DraftSight, FreeCAD और BricsCAD में आसानी से खुलता है।",
    mr: "आर्किटेक्ट आणि इंजिनिअरसाठी. ओपन स्टँडर्ड, AutoCAD, LibreCAD, QCAD, DraftSight, FreeCAD आणि BricsCAD मध्ये सहज उघडते.",
  },
  "design.viewer.notNative": {
    en: "Not native {dwg}",
    hi: "यह नेटिव {dwg} नहीं है",
    mr: "हे नेटिव्ह {dwg} नाही",
  },
  "design.viewer.dxfDiffTitle": {
    en: "DXF is Autodesk's open interchange format. Every modern CAD tool accepts it; .dwg is the proprietary AutoCAD binary.",
    hi: "DXF, Autodesk का ओपन इंटरचेंज फ़ॉर्मेट है। हर आधुनिक CAD टूल इसे खोल लेता है; .dwg, AutoCAD का अपना बाइनरी फ़ॉर्मेट है।",
    mr: "DXF हा Autodesk चा ओपन इंटरचेंज फॉरमॅट आहे. प्रत्येक आधुनिक CAD टूलमध्ये तो उघडतो; .dwg हा AutoCAD चा स्वतःचा बायनरी फॉरमॅट आहे.",
  },
  "design.viewer.whatsTheDifference": { en: "what's the difference?", hi: "फ़र्क क्या है?", mr: "फरक काय आहे?" },
  "design.viewer.downloadPdf": { en: "Download PDF", hi: "PDF डाउनलोड करें", mr: "PDF डाउनलोड करा" },
  "design.viewer.downloadDxf": { en: "Download DXF", hi: "DXF डाउनलोड करें", mr: "DXF डाउनलोड करा" },
  "design.viewer.downloadDwg": { en: "Download DWG", hi: "DWG डाउनलोड करें", mr: "DWG डाउनलोड करा" },
  "design.viewer.dxfTitle": {
    en: "Open in AutoCAD, LibreCAD, QCAD, DraftSight, FreeCAD, BricsCAD. DXF is the open AutoCAD interchange format — not native .dwg.",
    hi: "AutoCAD, LibreCAD, QCAD, DraftSight, FreeCAD या BricsCAD में खोलें। DXF, AutoCAD का ओपन इंटरचेंज फ़ॉर्मेट है — यह नेटिव .dwg नहीं है।",
    mr: "AutoCAD, LibreCAD, QCAD, DraftSight, FreeCAD किंवा BricsCAD मध्ये उघडा. DXF हा AutoCAD चा ओपन इंटरचेंज फॉरमॅट आहे — हे नेटिव्ह .dwg नाही.",
  },
  "design.viewer.dwgTitle": {
    en: "Native .dwg export is not currently enabled. Use DXF — every modern CAD tool opens it. If you specifically require .dwg, contact your account manager.",
    hi: "नेटिव .dwg एक्सपोर्ट अभी चालू नहीं है। DXF इस्तेमाल करें — हर आधुनिक CAD टूल इसे खोल लेता है। अगर आपको .dwg ही चाहिए, तो अपने अकाउंट मैनेजर से बात करें।",
    mr: "नेटिव्ह .dwg एक्सपोर्ट सध्या सुरू नाही. DXF वापरा — प्रत्येक आधुनिक CAD टूलमध्ये तो उघडतो. तुम्हाला .dwg च हवे असेल तर तुमच्या अकाउंट मॅनेजरशी बोला.",
  },
  "design.viewer.enterprise": { en: "enterprise", hi: "एंटरप्राइज़", mr: "एंटरप्राइझ" },

  // Design viewer: concept render
  "design.viewer.conceptRender": { en: "Concept render", hi: "कॉन्सेप्ट इमेज", mr: "कॉन्सेप्ट इमेज" },
  "design.viewer.renderAlt": {
    en: "AI-generated concept render",
    hi: "AI से बनी कॉन्सेप्ट इमेज",
    mr: "AI ने तयार केलेली कॉन्सेप्ट इमेज",
  },
  "design.viewer.renderBadge": {
    en: "AI illustration · not measured",
    hi: "AI चित्र · माप के अनुसार नहीं",
    mr: "AI चित्र · मापानुसार नाही",
  },
  "design.viewer.important": { en: "Important:", hi: "ज़रूरी:", mr: "महत्त्वाचे:" },
  "design.viewer.renderNotice": {
    en: "this is an AI-generated mood image. Dimensions, proportions, materials, and layout may differ from the floor plans below. Use the 2D plans, room schedule, and DXF export for any measurements or contractor briefs. Treat this image as inspiration only.",
    hi: "यह AI से बना सिर्फ़ एक काल्पनिक चित्र है। इसका माप, अनुपात, सामग्री और लेआउट नीचे दिए फ़्लोर प्लान से अलग हो सकते हैं। माप लेने या ठेकेदार को समझाने के लिए 2D प्लान, कमरों की सूची और DXF एक्सपोर्ट का इस्तेमाल करें। इस इमेज को सिर्फ़ प्रेरणा के तौर पर देखें।",
    mr: "ही AI ने तयार केलेली फक्त कल्पना-प्रतिमा आहे. तिची मापे, प्रमाण, साहित्य आणि लेआउट खालील फ्लोअर प्लॅनपेक्षा वेगळे असू शकतात. मोजमापांसाठी किंवा कंत्राटदाराला सूचना देण्यासाठी 2D प्लॅन, खोल्यांची यादी आणि DXF एक्सपोर्ट वापरा. ही प्रतिमा फक्त प्रेरणा म्हणून पाहा.",
  },

  // Design viewer: summary
  "design.viewer.summary": { en: "Design summary", hi: "डिज़ाइन का सारांश", mr: "डिझाइनचा सारांश" },
  "design.viewer.plotArea": { en: "Plot area", hi: "प्लॉट का क्षेत्रफल", mr: "प्लॉटचे क्षेत्रफळ" },
  "design.viewer.builtUp": { en: "Built-up planned", hi: "प्रस्तावित बिल्ट-अप", mr: "नियोजित बिल्ट-अप" },
  "design.viewer.farUsed": { en: "FAR used", hi: "इस्तेमाल हुआ FAR", mr: "वापरलेला FAR" },
  "design.viewer.footprint": { en: "Footprint", hi: "फ़ुटप्रिंट", mr: "फूटप्रिंट" },
  "design.viewer.estCost": { en: "Est. cost", hi: "अनुमानित लागत", mr: "अंदाजे खर्च" },
  "design.viewer.warnings": { en: "Warnings:", hi: "चेतावनियां:", mr: "इशारे:" },

  // Design viewer: floor plans
  "design.viewer.floorPlans": { en: "Floor plans", hi: "फ़्लोर प्लान", mr: "फ्लोअर प्लॅन" },
  "design.viewer.room": { en: "Room", hi: "कमरा", mr: "खोली" },
  "design.viewer.type": { en: "Type", hi: "प्रकार", mr: "प्रकार" },
  "design.viewer.dimensions": { en: "W × D", hi: "चौड़ाई × गहराई", mr: "रुंदी × खोली" },
  "design.viewer.area": { en: "Area", hi: "क्षेत्रफल", mr: "क्षेत्रफळ" },
  "design.viewer.floorTotal": { en: "Floor total", hi: "मंज़िल का कुल", mr: "मजल्याचे एकूण" },

  // Design viewer: brief
  "design.viewer.brief": { en: "Design brief", hi: "डिज़ाइन ब्रीफ़", mr: "डिझाइन ब्रीफ" },
  "design.viewer.materials": { en: "Materials", hi: "सामग्री", mr: "साहित्य" },
  "design.viewer.mep": {
    en: "MEP recommendations",
    hi: "बिजली, प्लंबिंग और मैकेनिकल सुझाव",
    mr: "वीज, प्लंबिंग आणि मेकॅनिकल सूचना",
  },
  "design.viewer.codeNotes": {
    en: "Code & compliance notes",
    hi: "नियम और अनुपालन नोट्स",
    mr: "नियम आणि पालनाबाबत नोंदी",
  },

  // 3D viewer
  "design.viewer3d.visibleFloors": { en: "Visible floors:", hi: "दिखने वाली मंज़िलें:", mr: "दिसणारे मजले:" },
  "design.viewer3d.labels": { en: "Labels", hi: "लेबल", mr: "लेबल" },
  "design.viewer3d.roof": { en: "Roof", hi: "छत", mr: "छत" },
  "design.viewer3d.help": {
    en: "Drag to rotate · scroll to zoom · right-click drag to pan",
    hi: "घुमाने के लिए खींचें · ज़ूम के लिए स्क्रॉल करें · सरकाने के लिए राइट-क्लिक करके खींचें",
    mr: "फिरवण्यासाठी ड्रॅग करा · झूमसाठी स्क्रोल करा · सरकवण्यासाठी राइट-क्लिक करून ड्रॅग करा",
  },

  // Claim lead
  "design.claim.button": { en: "Claim + invite", hi: "लीड लें + आमंत्रित करें", mr: "लीड घ्या + आमंत्रित करा" },
  "design.claim.busy": { en: "Claiming…", hi: "लीड ली जा रही है…", mr: "लीड घेत आहे…" },
  "design.claim.sendWhatsapp": { en: "send WhatsApp now", hi: "अभी व्हाट्सएप भेजें", mr: "आता व्हॉट्सॲप पाठवा" },
  "design.claim.failed": { en: "Claim failed", hi: "लीड नहीं ली जा सकी", mr: "लीड घेता आली नाही" },

  // Design status and source
  "design.status.draft": { en: "draft", hi: "ड्राफ़्ट", mr: "मसुदा" },
  "design.status.generating": { en: "generating", hi: "बन रहा है", mr: "तयार होत आहे" },
  "design.status.ready": { en: "ready", hi: "तैयार", mr: "तयार" },
  "design.status.failed": { en: "failed", hi: "विफल", mr: "अयशस्वी" },
  "design.source.broker": { en: "broker", hi: "ब्रोकर", mr: "ब्रोकर" },
  "design.source.client": { en: "client", hi: "ग्राहक", mr: "ग्राहक" },
  "design.source.public_lead": { en: "public lead", hi: "वेबसाइट लीड", mr: "वेबसाइट लीड" },
  "design.source.standalone": { en: "standalone", hi: "बिना प्लॉट", mr: "प्लॉटशिवाय" },

  // Design page
  "design.page.ready": { en: "Your design is ready", hi: "आपका डिज़ाइन तैयार है", mr: "तुमचे डिझाइन तयार आहे" },
  "design.page.generated": {
    en: "Generated {date} · ID {id}",
    hi: "बनाया गया: {date} · ID {id}",
    mr: "तयार केले: {date} · ID {id}",
  },
  "design.page.home": { en: "Home", hi: "होम", mr: "मुख्यपृष्ठ" },
  "design.page.notReady.draft": {
    en: "This design is still draft…",
    hi: "यह डिज़ाइन अभी ड्राफ़्ट में है…",
    mr: "हे डिझाइन अजून मसुदा अवस्थेत आहे…",
  },
  "design.page.notReady.generating": {
    en: "This design is still generating…",
    hi: "यह डिज़ाइन अभी बन रहा है…",
    mr: "हे डिझाइन अजून तयार होत आहे…",
  },
  "design.page.notReady.failed": {
    en: "This design is still failed…",
    hi: "यह डिज़ाइन नहीं बन सका…",
    mr: "हे डिझाइन तयार होऊ शकले नाही…",
  },

  // Designs list
  "design.list.title": { en: "Building designs", hi: "इमारत के डिज़ाइन", mr: "इमारतींची डिझाइन" },
  "design.list.new": { en: "+ New design", hi: "+ नया डिज़ाइन", mr: "+ नवीन डिझाइन" },
  "design.list.empty": {
    en: "No designs yet. Start one from a plot or click \"+ New design\".",
    hi: "अभी कोई डिज़ाइन नहीं है। किसी प्लॉट से शुरू करें या \"+ नया डिज़ाइन\" पर क्लिक करें।",
    mr: "अजून एकही डिझाइन नाही. एखाद्या प्लॉटवरून सुरू करा किंवा \"+ नवीन डिझाइन\" वर क्लिक करा.",
  },
  "design.list.floors": { en: "{count} floor(s)", hi: "{count} मंज़िल", mr: "{count} मजले" },
  "design.list.forPlot": { en: "For plot:", hi: "प्लॉट:", mr: "प्लॉट:" },

  // New design pages
  "design.new.title": { en: "New building design", hi: "इमारत का नया डिज़ाइन", mr: "इमारतीचे नवीन डिझाइन" },
  "design.new.subtitle": {
    en: "Walk through requirements — we'll generate a floor plan, design brief, and concept render.",
    hi: "अपनी ज़रूरतें बताएं — हम फ़्लोर प्लान, डिज़ाइन ब्रीफ़ और कॉन्सेप्ट इमेज बना देंगे।",
    mr: "तुमच्या गरजा सांगा — आम्ही फ्लोअर प्लॅन, डिझाइन ब्रीफ आणि कॉन्सेप्ट इमेज तयार करू.",
  },
  "design.portal.subtitle": {
    en: "Answer a few questions and we'll auto-generate a floor plan, design brief, and concept image.",
    hi: "कुछ सवालों के जवाब दें, हम अपने आप फ़्लोर प्लान, डिज़ाइन ब्रीफ़ और कॉन्सेप्ट इमेज बना देंगे।",
    mr: "काही प्रश्नांची उत्तरे द्या, आम्ही आपोआप फ्लोअर प्लॅन, डिझाइन ब्रीफ आणि कॉन्सेप्ट इमेज तयार करू.",
  },

  // Public design page
  "design.public.brokersLogin": { en: "Brokers login", hi: "ब्रोकर लॉगिन", mr: "ब्रोकर लॉगिन" },
  "design.public.headline": {
    en: "Design your dream building in 60 seconds.",
    hi: "60 सेकंड में अपने सपनों की इमारत डिज़ाइन करें।",
    mr: "60 सेकंदांत तुमच्या स्वप्नातील इमारत डिझाइन करा.",
  },
  "design.public.subhead": {
    en: "Answer a few questions about your plot and preferences — get an AI-generated floor plan, design brief, and concept render. Free. No signup needed.",
    hi: "अपने प्लॉट और पसंद के बारे में कुछ सवालों के जवाब दें — AI से बना फ़्लोर प्लान, डिज़ाइन ब्रीफ़ और कॉन्सेप्ट इमेज पाएं। बिल्कुल मुफ़्त। साइनअप की ज़रूरत नहीं।",
    mr: "तुमचा प्लॉट आणि पसंतीबद्दल काही प्रश्नांची उत्तरे द्या — AI ने तयार केलेला फ्लोअर प्लॅन, डिझाइन ब्रीफ आणि कॉन्सेप्ट इमेज मिळवा. अगदी मोफत. साइनअपची गरज नाही.",
  },
  "design.public.footer": {
    en: "Looking to list properties or invite clients? {link}.",
    hi: "प्रॉपर्टी लिस्ट करनी है या ग्राहकों को आमंत्रित करना है? {link}।",
    mr: "प्रॉपर्टी लिस्ट करायची आहे किंवा ग्राहकांना आमंत्रित करायचे आहे? {link}.",
  },
  "design.public.footerCta": { en: "Start a free org", hi: "मुफ़्त में शुरू करें", mr: "मोफत सुरू करा" },
};
