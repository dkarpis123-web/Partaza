// Two languages. The app is written in Lithuanian; English is produced when text is shown:
// every piece of text passes through tr(), which looks it up in the dictionary (src/i18n/en.ts).
// Text with no translation stays Lithuanian, so a missing entry never breaks a screen.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { detectCountry } from '@/services/geo';

import { EN, EN_PATTERNS } from './en';

export type Lang = 'lt' | 'en';
const KEY = 'partaza.lang';

function detect(): Lang {
  try {
    const saved = globalThis.localStorage?.getItem(KEY);
    if (saved === 'lt' || saved === 'en') return saved;
  } catch {
    // storage unavailable: fall through to the device language
  }
  // No saved choice: Lithuanian for people in Lithuania or with a Lithuanian device, English everywhere else.
  const device = (typeof navigator !== 'undefined' && navigator.language) || Intl.DateTimeFormat().resolvedOptions().locale || 'lt';
  return detectCountry() === 'Lietuva' || device.toLowerCase().startsWith('lt') ? 'lt' : 'en';
}

// The static web page is built in Lithuanian; the device language is applied once the app starts.
let current: Lang = 'lt';
let started = false;
const listeners = new Set<() => void>();

function apply(lang: Lang) {
  current = lang;
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  listeners.forEach((l) => l());
}

export function startLang() {
  if (started) return;
  started = true;
  apply(detect());
  // On phones there is no localStorage; the saved choice arrives a moment later.
  AsyncStorage.getItem(KEY)
    .then((saved) => {
      if ((saved === 'lt' || saved === 'en') && saved !== current) apply(saved);
    })
    .catch(() => {});
}

export function setLang(lang: Lang) {
  AsyncStorage.setItem(KEY, lang).catch(() => {
    // not saved; still applies for this visit
  });
  apply(lang);
}

export const getLang = () => current;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Re-renders the component when the language changes. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, () => 'lt' as Lang);
}

/** Texts shown in English mode that have no translation yet (used by the tests). */
export const missing = new Set<string>();
const LITHUANIAN = /[ąčęėįšųūžĄČĘĖĮŠŲŪŽ]|\b(ir|arba|kaina|skelbim\w*|dal\w+)\b/i;

/** Test aid: with localStorage "partaza.collect" set, every text shown is recorded under "partaza.seen". */
let collecting: boolean | null = null;
function collect(text: string) {
  try {
    if (collecting === null) collecting = globalThis.localStorage?.getItem('partaza.collect') === '1';
    if (!collecting) return;
    const seen: string[] = JSON.parse(globalThis.localStorage.getItem('partaza.seen') ?? '[]');
    if (!seen.includes(text)) globalThis.localStorage.setItem('partaza.seen', JSON.stringify([...seen, text]));
  } catch {
    collecting = false;
  }
}

export function tr(text: string): string {
  if (text && collecting !== false) collect(text.trim());
  if (current === 'lt' || !text) return text;
  const lead = text.match(/^\s*/)?.[0] ?? '';
  const tail = text.match(/\s*$/)?.[0] ?? '';
  const core = text.trim();
  if (!core) return text;
  const exact = EN[core];
  if (exact !== undefined) return lead + exact + tail;
  for (const [pattern, replacement] of EN_PATTERNS) {
     
    if (pattern.test(core)) return lead + core.replace(pattern, replacement as any) + tail;
  }
  // "Naudota · Kaunas, Lietuva": translate each piece on its own.
  if (core.includes(' · ')) return lead + core.split(' · ').map(tr).join(' · ') + tail;
  if (LITHUANIAN.test(core)) missing.add(core);
  return text;
}
