"use client";

import { createContext, useCallback, useContext } from "react";
import { DEFAULT_LOCALE, format, translate, type Locale } from "./dict";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/** Set once in Providers, from the server-read locale cookie. */
export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** Client-component counterpart of `t` in ./server.ts. */
export function useT() {
  const locale = useLocale();
  return useCallback(
    (key: string, vars?: Record<string, string | number>) =>
      vars ? format(key, locale, vars) : translate(key, locale),
    [locale]
  );
}
