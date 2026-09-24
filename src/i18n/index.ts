import { en } from "./en";
import { ru } from "./ru";
import type { Locale, TranslationKey } from "./types";

const dictionaries = { ru, en };

export function translate(locale: Locale, key: TranslationKey): string {
  return dictionaries[locale][key] ?? dictionaries.ru[key] ?? key;
}

export type { Locale, TranslationKey };
