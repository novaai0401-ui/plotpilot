/** Every string must exist in all three languages; the compiler enforces it. */
export type StringTable = Record<string, { en: string; hi: string; mr: string }>;
