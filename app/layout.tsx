import type { Metadata, Viewport } from "next";
import "./globals.css";
import "tekivex-ui/styles";
import { Providers } from "@/components/providers";
import { getLocale } from "@/lib/i18n/server";
import { getThemeMode, resolveTheme } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Plot Broker — Manage clients, visits & deals",
  description:
    "Multi-tenant SaaS for real-estate plot brokers: invite clients, schedule visits, message via WhatsApp, track analytics.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = getLocale();
  const themeMode = getThemeMode();
  const resolvedTheme = resolveTheme(themeMode);
  return (
    <html
      lang={locale}
      data-theme={resolvedTheme}
      data-theme-mode={themeMode}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        {/* Skip-to-content link for keyboard + screen-reader users (a11y) */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:bg-brand focus:text-white focus:rounded"
        >
          Skip to main content
        </a>
        <Providers theme={resolvedTheme}>
          <div id="main-content">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
