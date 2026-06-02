import { describe, it, expect } from "vitest";
import { dict, translate, LOCALES, DEFAULT_LOCALE } from "@/lib/i18n/dict";

describe("i18n dictionary", () => {
  it("every entry has an English translation (English is the fallback)", () => {
    for (const [key, entry] of Object.entries(dict)) {
      expect(entry.en, `key "${key}" missing English translation`).toBeTruthy();
    }
  });

  it("every entry has a Hindi translation (we ship 2 locales — no partial coverage)", () => {
    for (const [key, entry] of Object.entries(dict)) {
      expect(entry.hi, `key "${key}" missing Hindi translation`).toBeTruthy();
    }
  });

  it("default locale is one of the supported locales", () => {
    expect((LOCALES as readonly string[]).includes(DEFAULT_LOCALE)).toBe(true);
  });
});

describe("translate()", () => {
  it("returns the locale's value when present", () => {
    expect(translate("nav.overview", "en")).toBe("Overview");
    expect(translate("nav.overview", "hi")).toBe("अवलोकन");
  });

  it("falls back to English when the locale entry is missing", () => {
    // Simulate by translating with a locale we don't actually populate.
    // (LOCALES is typed strict so we cast here for the negative test.)
    const result = translate("nav.overview", "xx" as any);
    expect(result).toBe("Overview");
  });

  it("falls back to the key when the entry is entirely unknown (visible in dev)", () => {
    expect(translate("nonexistent.key", "en")).toBe("nonexistent.key");
  });
});
