import { execSync } from "child_process";
import { copyFileSync, mkdirSync, writeFileSync } from "fs";

/**
 * Builds a shareable Android APK that opens the deployed site.
 * Usage: APP_SERVER_URL=https://your-app.onrender.com npm run android:apk
 * Needs JDK 21 (JAVA_HOME) and the Android SDK (ANDROID_HOME).
 */

const url = process.env.APP_SERVER_URL;
if (!url?.startsWith("https://")) {
  console.error("Set APP_SERVER_URL to the https address of the deployed app.");
  process.exit(1);
}

const run = (command, cwd) => execSync(command, { cwd, stdio: "inherit" });

// The offline page's retry button needs to know where to go back to.
writeFileSync("mobile/server-url.js", `window.__appUrl = ${JSON.stringify(url)};\n`);

run("npx cap sync android");
run("node scripts/generate-icons.mjs");
run(process.platform === "win32" ? ".\\gradlew.bat assembleDebug" : "./gradlew assembleDebug", "android");

mkdirSync("dist", { recursive: true });
copyFileSync("android/app/build/outputs/apk/debug/app-debug.apk", "dist/PlotBroker.apk");
console.log("APK ready: dist/PlotBroker.apk");
