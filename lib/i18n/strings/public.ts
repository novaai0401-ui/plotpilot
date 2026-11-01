import type { StringTable } from "./types";

/** Login, signup, email verification, client portal, offline and error pages. */
export const PUBLIC: StringTable = {
  // Login: two-factor step
  "public.login.failed": { en: "Sign-in failed", hi: "साइन इन नहीं हो सका", mr: "साइन इन होऊ शकले नाही" },
  "public.login.mfaTitle": { en: "Two-factor code", hi: "टू-फ़ैक्टर कोड", mr: "टू-फॅक्टर कोड" },
  "public.login.mfaSubtitle": {
    en: "Open your authenticator app and enter the 6-digit code.",
    hi: "अपना ऑथेंटिकेटर ऐप खोलें और 6 अंकों का कोड डालें।",
    mr: "तुमचे ऑथेंटिकेटर ॲप उघडा आणि 6 अंकी कोड टाका.",
  },
  "public.login.mfaFormLabel": { en: "Two-factor verification", hi: "टू-फ़ैक्टर जांच", mr: "टू-फॅक्टर पडताळणी" },
  "public.login.codeLabel": { en: "6-digit code", hi: "6 अंकों का कोड", mr: "6 अंकी कोड" },
  "public.login.codeHint": {
    en: "Or enter a 10-char recovery code if you've lost your authenticator.",
    hi: "अगर ऑथेंटिकेटर ऐप खो गया है, तो 10 अक्षरों का रिकवरी कोड डालें।",
    mr: "ऑथेंटिकेटर ॲप हरवले असल्यास 10 अक्षरी रिकव्हरी कोड टाका.",
  },
  "public.login.verify": { en: "Verify", hi: "जांचें", mr: "पडताळा" },
  "public.login.verifying": { en: "Verifying…", hi: "जांच हो रही है…", mr: "पडताळणी होत आहे…" },
  "public.login.differentAccount": {
    en: "Use a different account",
    hi: "दूसरा खाता इस्तेमाल करें",
    mr: "दुसरे खाते वापरा",
  },

  // Signup form
  "public.signup.titleOrg": { en: "Start your brokerage", hi: "अपनी ब्रोकरेज शुरू करें", mr: "तुमची ब्रोकरेज सुरू करा" },
  "public.signup.titleClient": { en: "Join as client", hi: "ग्राहक के रूप में जुड़ें", mr: "ग्राहक म्हणून सामील व्हा" },
  "public.signup.titleTeamAdmin": { en: "Join the admin team", hi: "एडमिन टीम से जुड़ें", mr: "ॲडमिन टीममध्ये सामील व्हा" },
  "public.signup.titleTeamAgent": { en: "Join the agent team", hi: "एजेंट टीम से जुड़ें", mr: "एजंट टीममध्ये सामील व्हा" },
  "public.signup.subtitleOrg": {
    en: "Create your organization in under a minute.",
    hi: "एक मिनट से भी कम में अपना संगठन बनाएं।",
    mr: "एका मिनिटापेक्षा कमी वेळेत तुमची संस्था तयार करा.",
  },
  "public.signup.subtitleClient": {
    en: "Your broker invited you. Create an account to see plots and visits.",
    hi: "आपके ब्रोकर ने आपको आमंत्रित किया है। प्लॉट और विज़िट देखने के लिए खाता बनाएं।",
    mr: "तुमच्या ब्रोकरने तुम्हाला आमंत्रित केले आहे. प्लॉट आणि भेटी पाहण्यासाठी खाते तयार करा.",
  },
  "public.signup.subtitleTeam": {
    en: "Your colleague invited you. Set a password to activate your account.",
    hi: "आपके सहकर्मी ने आपको आमंत्रित किया है। खाता चालू करने के लिए पासवर्ड बनाएं।",
    mr: "तुमच्या सहकाऱ्याने तुम्हाला आमंत्रित केले आहे. खाते सुरू करण्यासाठी पासवर्ड तयार करा.",
  },
  "public.signup.joiningOrg": { en: "Joining {org}", hi: "{org} से जुड़ रहे हैं", mr: "{org} मध्ये सामील होत आहात" },
  "public.signup.joiningAsClient": {
    en: "Joining {org} as a client",
    hi: "{org} से ग्राहक के रूप में जुड़ रहे हैं",
    mr: "{org} मध्ये ग्राहक म्हणून सामील होत आहात",
  },
  "public.signup.role": { en: "Role:", hi: "भूमिका:", mr: "भूमिका:" },
  "public.signup.inviteIssuedTo": {
    en: "Invite issued to {email}",
    hi: "आमंत्रण {email} पर भेजा गया",
    mr: "आमंत्रण {email} वर पाठवले",
  },
  "public.signup.inviteValidUntil": {
    en: "Invite valid until {date}",
    hi: "आमंत्रण {date} तक मान्य है",
    mr: "आमंत्रण {date} पर्यंत वैध आहे",
  },
  "public.signup.failed": { en: "Sign-up failed", hi: "साइन अप नहीं हो सका", mr: "साइन अप होऊ शकले नाही" },
  "public.signup.brokerageName": { en: "Brokerage name", hi: "ब्रोकरेज का नाम", mr: "ब्रोकरेजचे नाव" },
  "public.signup.brokeragePlaceholder": {
    en: "e.g. ABC Plots & Estates",
    hi: "जैसे ABC प्लॉट्स एंड एस्टेट्स",
    mr: "उदा. ABC प्लॉट्स अँड इस्टेट्स",
  },
  "public.signup.yourName": { en: "Your name", hi: "आपका नाम", mr: "तुमचे नाव" },
  "public.signup.phoneLabel": {
    en: "Phone (with country code)",
    hi: "फ़ोन (कंट्री कोड के साथ)",
    mr: "फोन (कंट्री कोडसह)",
  },
  "public.signup.emailLockedHint": {
    en: "This is the email the invite was sent to, so it can't be changed.",
    hi: "यह वही ईमेल है जिस पर आमंत्रण भेजा गया था। आमंत्रण की जांच के लिए इसे बदला नहीं जा सकता।",
    mr: "हा तोच ईमेल आहे ज्यावर आमंत्रण पाठवले होते. आमंत्रणाची पडताळणी होण्यासाठी तो बदलता येत नाही.",
  },
  "public.signup.createAccount": { en: "Create account", hi: "खाता बनाएं", mr: "खाते तयार करा" },
  "public.signup.creatingAccount": { en: "Creating account…", hi: "खाता बन रहा है…", mr: "खाते तयार होत आहे…" },
  "public.signup.haveAccount": { en: "Already have an account?", hi: "पहले से खाता है?", mr: "आधीच खाते आहे?" },

  // Signup: check your inbox
  "public.signup.checkInbox": { en: "Check your inbox", hi: "अपना इनबॉक्स देखें", mr: "तुमचा इनबॉक्स तपासा" },
  "public.signup.oneLastStep": {
    en: "One last step to activate your account.",
    hi: "खाता चालू करने के लिए बस एक कदम बाकी है।",
    mr: "खाते सुरू करण्यासाठी फक्त एक पाऊल बाकी आहे.",
  },
  "public.signup.confirmationSent": {
    en: "Confirmation email sent",
    hi: "पुष्टि का ईमेल भेज दिया गया है",
    mr: "पुष्टीचा ईमेल पाठवला आहे",
  },
  "public.signup.confirmationBody.portal": {
    en: "We sent a confirmation link to {email}. Click it to activate your account — you'll be signed in and dropped straight into your client portal.",
    hi: "हमने {email} पर पुष्टि का लिंक भेजा है। खाता चालू करने के लिए उस पर क्लिक करें। आप साइन इन होकर सीधे अपने ग्राहक पोर्टल पर पहुंच जाएंगे।",
    mr: "आम्ही {email} वर पुष्टीची लिंक पाठवली आहे. खाते सुरू करण्यासाठी तिच्यावर क्लिक करा. तुम्ही साइन इन होऊन थेट तुमच्या ग्राहक पोर्टलवर पोहोचाल.",
  },
  "public.signup.confirmationBody.dashboard": {
    en: "We sent a confirmation link to {email}. Click it to activate your account — you'll be signed in and dropped straight into your dashboard.",
    hi: "हमने {email} पर पुष्टि का लिंक भेजा है। खाता चालू करने के लिए उस पर क्लिक करें। आप साइन इन होकर सीधे अपने डैशबोर्ड पर पहुंच जाएंगे।",
    mr: "आम्ही {email} वर पुष्टीची लिंक पाठवली आहे. खाते सुरू करण्यासाठी तिच्यावर क्लिक करा. तुम्ही साइन इन होऊन थेट तुमच्या डॅशबोर्डवर पोहोचाल.",
  },
  "public.signup.notReceived": { en: "Didn't get it?", hi: "ईमेल नहीं मिला?", mr: "ईमेल मिळाला नाही?" },
  "public.signup.notReceivedHelp": {
    en: "Check your spam folder. You can keep using your account in the meantime.",
    hi: "अपना स्पैम फ़ोल्डर देखें। तब तक आप अपना खाता इस्तेमाल करते रह सकते हैं।",
    mr: "तुमचा स्पॅम फोल्डर तपासा. तोपर्यंत तुम्ही तुमचे खाते वापरू शकता.",
  },
  "public.signup.differentEmail": { en: "Use a different email", hi: "दूसरा ईमेल इस्तेमाल करें", mr: "दुसरा ईमेल वापरा" },
  "public.signup.alreadyConfirmed": {
    en: "I already confirmed — sign in",
    hi: "मैंने पुष्टि कर दी है, साइन इन करें",
    mr: "मी पुष्टी केली आहे, साइन इन करा",
  },

  // Signup: invite problems
  "public.invite.expiredTitle": {
    en: "This invite has expired",
    hi: "इस आमंत्रण की समय सीमा खत्म हो गई है",
    mr: "या आमंत्रणाची मुदत संपली आहे",
  },
  "public.invite.unverifiedTeamTitle": {
    en: "We couldn't verify this team invite",
    hi: "हम इस टीम आमंत्रण की जांच नहीं कर सके",
    mr: "या टीम आमंत्रणाची पडताळणी करता आली नाही",
  },
  "public.invite.unverifiedClientTitle": {
    en: "We couldn't verify this client invite",
    hi: "हम इस ग्राहक आमंत्रण की जांच नहीं कर सके",
    mr: "या ग्राहक आमंत्रणाची पडताळणी करता आली नाही",
  },
  "public.invite.linkInvalid": { en: "Link no longer valid", hi: "यह लिंक अब मान्य नहीं है", mr: "ही लिंक आता वैध नाही" },
  "public.invite.verificationFailed": { en: "Verification failed", hi: "जांच नहीं हो सकी", mr: "पडताळणी होऊ शकली नाही" },
  "public.invite.askColleague": {
    en: "Ask your colleague to send a fresh invite link — they're valid for 14 days.",
    hi: "अपने सहकर्मी से नया आमंत्रण लिंक भेजने को कहें। लिंक 14 दिन तक मान्य रहता है।",
    mr: "तुमच्या सहकाऱ्याला नवीन आमंत्रण लिंक पाठवायला सांगा. लिंक 14 दिवस वैध असते.",
  },
  "public.invite.askBroker": {
    en: "Ask your broker to send a fresh invite link — they're valid for 14 days.",
    hi: "अपने ब्रोकर से नया आमंत्रण लिंक भेजने को कहें। लिंक 14 दिन तक मान्य रहता है।",
    mr: "तुमच्या ब्रोकरला नवीन आमंत्रण लिंक पाठवायला सांगा. लिंक 14 दिवस वैध असते.",
  },
  "public.invite.malformed": {
    en: "The link may be malformed or have been tampered with.",
    hi: "लिंक अधूरा हो सकता है या उसमें बदलाव किया गया हो सकता है।",
    mr: "लिंक अपूर्ण असू शकते किंवा तिच्यात बदल केलेला असू शकतो.",
  },
  "public.invite.orgGone": {
    en: "Inviting organization no longer exists.",
    hi: "आमंत्रण भेजने वाला संगठन अब मौजूद नहीं है।",
    mr: "आमंत्रण पाठवणारी संस्था आता अस्तित्वात नाही.",
  },
  "public.invite.notFound": { en: "Invite link not found.", hi: "आमंत्रण लिंक नहीं मिला।", mr: "आमंत्रण लिंक सापडली नाही." },
  "public.invite.already.accepted": {
    en: "This invite has already been accepted.",
    hi: "यह आमंत्रण पहले ही स्वीकार किया जा चुका है।",
    mr: "हे आमंत्रण आधीच स्वीकारले आहे.",
  },
  "public.invite.already.expired": {
    en: "This invite has already expired.",
    hi: "इस आमंत्रण की समय सीमा पहले ही खत्म हो चुकी है।",
    mr: "या आमंत्रणाची मुदत आधीच संपली आहे.",
  },
  "public.invite.already.revoked": {
    en: "This invite has already been revoked.",
    hi: "यह आमंत्रण पहले ही वापस लिया जा चुका है।",
    mr: "हे आमंत्रण आधीच मागे घेतले आहे.",
  },
  "public.invite.startNew": {
    en: "Start a new brokerage instead",
    hi: "इसकी जगह नई ब्रोकरेज शुरू करें",
    mr: "त्याऐवजी नवीन ब्रोकरेज सुरू करा",
  },
  "public.invite.haveAccount": { en: "I already have an account", hi: "मेरा पहले से खाता है", mr: "माझे आधीच खाते आहे" },

  // Errors returned by the native auth API
  "public.err.invalidEmail": { en: "Valid email required.", hi: "सही ईमेल डालें।", mr: "योग्य ईमेल टाका." },
  "public.err.passwordShort": {
    en: "Password must be at least 8 characters.",
    hi: "पासवर्ड कम से कम 8 अक्षरों का होना चाहिए।",
    mr: "पासवर्ड किमान 8 अक्षरांचा असावा.",
  },
  "public.err.emailExists": {
    en: "An account with that email already exists.",
    hi: "इस ईमेल से पहले से एक खाता मौजूद है।",
    mr: "या ईमेलने आधीच खाते आहे.",
  },
  "public.err.badCredentials": {
    en: "Email or password is incorrect.",
    hi: "ईमेल या पासवर्ड गलत है।",
    mr: "ईमेल किंवा पासवर्ड चुकीचा आहे.",
  },
  "public.err.accountLocked": {
    en: "Account locked due to too many failed attempts. Try again in ~{mins} minute(s).",
    hi: "कई बार गलत कोशिश होने से खाता लॉक हो गया है। करीब {mins} मिनट बाद फिर से कोशिश करें।",
    mr: "अनेक वेळा चुकीचे प्रयत्न झाल्यामुळे खाते लॉक झाले आहे. सुमारे {mins} मिनिटांनी पुन्हा प्रयत्न करा.",
  },
  "public.err.tooManyLogins": {
    en: "Too many login attempts. Try again after {time}.",
    hi: "लॉगिन की बहुत ज़्यादा कोशिशें हो गईं। {time} के बाद फिर से कोशिश करें।",
    mr: "लॉगिनचे खूप प्रयत्न झाले. {time} नंतर पुन्हा प्रयत्न करा.",
  },
  "public.err.tooManySignups": {
    en: "Too many signup attempts. Try again after {time}.",
    hi: "साइन अप की बहुत ज़्यादा कोशिशें हो गईं। {time} के बाद फिर से कोशिश करें।",
    mr: "साइन अपचे खूप प्रयत्न झाले. {time} नंतर पुन्हा प्रयत्न करा.",
  },
  "public.err.tooManyMfa": {
    en: "Too many MFA attempts on this challenge. Sign in again.",
    hi: "कोड डालने की बहुत ज़्यादा कोशिशें हो गईं। फिर से साइन इन करें।",
    mr: "कोड टाकण्याचे खूप प्रयत्न झाले. पुन्हा साइन इन करा.",
  },
  "public.err.challengeExpired": {
    en: "Login challenge expired. Sign in again.",
    hi: "लॉगिन का समय खत्म हो गया। फिर से साइन इन करें।",
    mr: "लॉगिनची वेळ संपली. पुन्हा साइन इन करा.",
  },
  "public.err.mfaNotEnrolled": {
    en: "MFA is not enrolled for this account.",
    hi: "इस खाते पर टू-फ़ैक्टर चालू नहीं है।",
    mr: "या खात्यावर टू-फॅक्टर सुरू नाही.",
  },
  "public.err.codeInvalid": {
    en: "Code is invalid or expired.",
    hi: "कोड गलत है या उसका समय खत्म हो गया है।",
    mr: "कोड चुकीचा आहे किंवा त्याची मुदत संपली आहे.",
  },
  "public.err.missingNamePhone": {
    en: "Missing name or phone",
    hi: "नाम या फ़ोन नंबर नहीं भरा गया है",
    mr: "नाव किंवा फोन नंबर भरलेला नाही",
  },
  "public.err.missingOrgName": {
    en: "Missing organization name",
    hi: "ब्रोकरेज का नाम नहीं भरा गया है",
    mr: "ब्रोकरेजचे नाव भरलेले नाही",
  },
  "public.err.teamInviteInvalid": {
    en: "This team invite could not be verified.",
    hi: "इस टीम आमंत्रण की जांच नहीं हो सकी।",
    mr: "या टीम आमंत्रणाची पडताळणी होऊ शकली नाही.",
  },
  "public.err.inviteEmailMismatch": {
    en: "This invite was issued to {invited}, but you're signed in as {email}.",
    hi: "यह आमंत्रण {invited} के लिए था, लेकिन आप {email} से साइन इन हैं।",
    mr: "हे आमंत्रण {invited} साठी होते, पण तुम्ही {email} ने साइन इन केले आहे.",
  },
  "public.err.inviteInvalid": {
    en: "Invalid or expired invite",
    hi: "आमंत्रण सही नहीं है या उसकी समय सीमा खत्म हो गई है",
    mr: "आमंत्रण अवैध आहे किंवा त्याची मुदत संपली आहे",
  },

  // Email verification page
  "public.verify.successTitle": { en: "Email verified", hi: "ईमेल की पुष्टि हो गई", mr: "ईमेलची पुष्टी झाली" },
  "public.verify.failTitle": {
    en: "We couldn't verify your email",
    hi: "हम आपके ईमेल की पुष्टि नहीं कर सके",
    mr: "तुमच्या ईमेलची पुष्टी करता आली नाही",
  },
  "public.verify.successBody": {
    en: "Your account is fully active. You can continue to your dashboard.",
    hi: "आपका खाता पूरी तरह चालू है। अब आप अपने डैशबोर्ड पर जा सकते हैं।",
    mr: "तुमचे खाते पूर्णपणे सुरू आहे. आता तुम्ही तुमच्या डॅशबोर्डवर जाऊ शकता.",
  },
  "public.verify.goToDashboard": { en: "Go to dashboard", hi: "डैशबोर्ड पर जाएं", mr: "डॅशबोर्डवर जा" },
  "public.verify.backToSignIn": { en: "Back to sign in", hi: "साइन इन पर वापस जाएं", mr: "साइन इनवर परत जा" },
  "public.verify.missingToken": {
    en: "Missing token.",
    hi: "लिंक अधूरा है।",
    mr: "लिंक अपूर्ण आहे.",
  },
  "public.verify.invalidLink": {
    en: "Invalid or already-used verification link.",
    hi: "यह पुष्टि लिंक सही नहीं है या पहले ही इस्तेमाल हो चुका है।",
    mr: "ही पुष्टीची लिंक अवैध आहे किंवा आधीच वापरली गेली आहे.",
  },
  "public.verify.usedLink": {
    en: "This verification link was already used.",
    hi: "यह पुष्टि लिंक पहले ही इस्तेमाल हो चुका है।",
    mr: "ही पुष्टीची लिंक आधीच वापरली गेली आहे.",
  },
  "public.verify.expiredLink": {
    en: "Verification link expired.",
    hi: "पुष्टि लिंक की समय सीमा खत्म हो गई है।",
    mr: "पुष्टीच्या लिंकची मुदत संपली आहे.",
  },

  // Client portal
  "public.portal.nav.home": { en: "Home", hi: "होम", mr: "मुख्यपृष्ठ" },
  "public.portal.nav.visits": { en: "My visits", hi: "मेरी विज़िट", mr: "माझ्या भेटी" },
  "public.portal.nav.design": { en: "Design a building", hi: "इमारत डिज़ाइन करें", mr: "इमारत डिझाइन करा" },
  "public.portal.nav.profile": { en: "Profile", hi: "प्रोफ़ाइल", mr: "प्रोफाइल" },
  "public.portal.welcome": { en: "Welcome, {name}", hi: "स्वागत है, {name}", mr: "स्वागत आहे, {name}" },
  "public.portal.hello": { en: "Hello, {name}.", hi: "नमस्ते, {name}।", mr: "नमस्कार, {name}." },
  "public.portal.yourBroker": { en: "Your broker", hi: "आपके ब्रोकर", mr: "तुमचे ब्रोकर" },
  "public.portal.brokerAt": { en: "{name} at {org}", hi: "{name}, {org}", mr: "{name}, {org}" },
  "public.portal.waGreeting": { en: "Hi {name}, ", hi: "नमस्ते {name} जी, ", mr: "नमस्कार {name}, " },
  "public.portal.waAria": {
    en: "Message {name} on WhatsApp",
    hi: "{name} को व्हाट्सएप पर संदेश भेजें",
    mr: "{name} यांना व्हॉट्सॲपवर संदेश पाठवा",
  },
  "public.portal.waButton": {
    en: "Message broker on WhatsApp",
    hi: "ब्रोकर को व्हाट्सएप पर संदेश भेजें",
    mr: "ब्रोकरला व्हॉट्सॲपवर संदेश पाठवा",
  },
  "public.portal.upcomingVisits": { en: "Upcoming visits", hi: "आने वाली विज़िट", mr: "पुढील भेटी" },
  "public.portal.noUpcoming": {
    en: "Nothing scheduled — your broker will schedule plot visits for you here.",
    hi: "अभी कोई विज़िट तय नहीं है। आपके ब्रोकर आपकी प्लॉट विज़िट यहां तय करेंगे।",
    mr: "अजून कोणतीही भेट ठरलेली नाही. तुमचे ब्रोकर तुमच्या प्लॉट भेटी इथे ठरवतील.",
  },
  "public.portal.withAgent": { en: "with {name}", hi: "{name} के साथ", mr: "{name} यांच्यासोबत" },

  "public.portal.visits.empty": {
    en: "No visits yet — once your broker schedules a visit, it'll appear here.",
    hi: "अभी कोई विज़िट नहीं है। ब्रोकर के विज़िट तय करते ही वह यहां दिखेगी।",
    mr: "अजून कोणतीही भेट नाही. ब्रोकरने भेट ठरवली की ती इथे दिसेल.",
  },
  "public.portal.visits.waMessage": {
    en: "Hi {name}, regarding my visit to {plot}: ",
    hi: "नमस्ते {name} जी, {plot} की मेरी विज़िट के बारे में: ",
    mr: "नमस्कार {name}, {plot} येथील माझ्या भेटीबद्दल: ",
  },
  "public.portal.visits.waLink": {
    en: "WhatsApp broker →",
    hi: "ब्रोकर को व्हाट्सएप करें →",
    mr: "ब्रोकरला व्हॉट्सॲप करा →",
  },

  "public.portal.messages.empty": {
    en: "No messages yet — conversations with your broker will appear here.",
    hi: "अभी कोई संदेश नहीं है। ब्रोकर के साथ आपकी बातचीत यहां दिखेगी।",
    mr: "अजून कोणताही संदेश नाही. ब्रोकरसोबतचे तुमचे बोलणे इथे दिसेल.",
  },
  "public.portal.messages.youSender": { en: "You", hi: "आप", mr: "तुम्ही" },
  "public.portal.messages.youRecipient": { en: "you", hi: "आप", mr: "तुम्ही" },

  "public.portal.profile.detailsTitle": { en: "Your details", hi: "आपकी जानकारी", mr: "तुमची माहिती" },
  "public.portal.profile.detailsSubtitle": {
    en: "Your broker uses these to reach you about visits and listings.",
    hi: "आपके ब्रोकर विज़िट और प्लॉट की जानकारी देने के लिए इन्हीं से आपसे संपर्क करते हैं।",
    mr: "तुमचे ब्रोकर भेटी आणि प्लॉटच्या माहितीसाठी याच तपशीलांवरून तुमच्याशी संपर्क करतात.",
  },
  "public.portal.profile.phoneHint": {
    en: "Include country code (e.g. +91…) for WhatsApp deep-links.",
    hi: "व्हाट्सएप लिंक के लिए कंट्री कोड भी लिखें (जैसे +91…)।",
    mr: "व्हॉट्सॲप लिंकसाठी कंट्री कोडही लिहा (उदा. +91…).",
  },

  // Offline page
  "public.offline.title": { en: "You're offline", hi: "आप ऑफ़लाइन हैं", mr: "तुम्ही ऑफलाइन आहात" },
  "public.offline.body": {
    en: "We'll automatically reconnect when your network is back. Pages you've already visited should still work — try going back instead of reloading.",
    hi: "नेटवर्क वापस आते ही ऐप अपने आप जुड़ जाएगा। जो पेज आप पहले देख चुके हैं वे अब भी खुलने चाहिए। रीलोड करने के बजाय वापस जाकर देखें।",
    mr: "नेटवर्क परत आल्यावर ॲप आपोआप जोडले जाईल. तुम्ही आधी पाहिलेली पेज अजूनही उघडायला हवीत. रीलोड करण्याऐवजी मागे जाऊन पाहा.",
  },
  "public.offline.goBack": { en: "Go back", hi: "वापस जाएं", mr: "मागे जा" },
  "public.offline.retry": { en: "Retry now", hi: "अभी फिर से कोशिश करें", mr: "आता पुन्हा प्रयत्न करा" },
  "public.offline.footer": {
    en: "PlotBroker · works offline for pages you've already opened.",
    hi: "PlotBroker · पहले खोले गए पेज ऑफ़लाइन भी चलते हैं।",
    mr: "PlotBroker · आधी उघडलेली पेज ऑफलाइनही चालतात.",
  },

  // Forbidden page
  "public.forbidden.title": { en: "403 — Forbidden", hi: "403 — अनुमति नहीं है", mr: "403 — परवानगी नाही" },
  "public.forbidden.body": {
    en: "You don't have access to this page.",
    hi: "आपको इस पेज को देखने की अनुमति नहीं है।",
    mr: "तुम्हाला हे पेज पाहण्याची परवानगी नाही.",
  },

  // Landing page
  "public.landing.footer": {
    en: "© {year} PlotBroker. All rights reserved.",
    hi: "© {year} PlotBroker. सर्वाधिकार सुरक्षित।",
    mr: "© {year} PlotBroker. सर्व हक्क राखीव.",
  },
};
