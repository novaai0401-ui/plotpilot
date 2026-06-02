"use client";
import { ThemeProvider, TkxToastProvider } from "@/components/tkx-dyn";
import type { ResolvedTheme } from "@/lib/theme";

/**
 * App-wide client providers.
 *
 * History:
 *  - tekivex-ui 3.0.3: needed both next/dynamic + a mount-gate to avoid hydration mismatch.
 *  - tekivex-ui 3.18.0: static imports + ThemeProvider suppressHydrationWarning landed.
 *  - Round 8: theme is now driven by a server-read cookie (lib/theme.ts) so the
 *    server renders the right tokens on first paint. No flash-of-wrong-theme.
 */
export function Providers({
  children,
  theme,
}: {
  children: React.ReactNode;
  theme: ResolvedTheme;
}) {
  return (
    <ThemeProvider mode={theme}>
      <TkxToastProvider position="top-right">{children}</TkxToastProvider>
    </ThemeProvider>
  );
}
