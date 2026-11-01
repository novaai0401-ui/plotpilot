import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The Android app is a shell around the deployed site: pages, API and database
 * all stay on the server. Set APP_SERVER_URL to the deployed address, then run
 * `npm run android:apk`.
 */
const url = process.env.APP_SERVER_URL;
if (!url?.startsWith("https://")) {
  throw new Error("Set APP_SERVER_URL to the https address of the deployed app.");
}

const config: CapacitorConfig = {
  appId: "com.plotbroker.app",
  appName: "PlotBroker",
  webDir: "mobile",
  server: {
    url,
    errorPath: "offline.html",
  },
};

export default config;
