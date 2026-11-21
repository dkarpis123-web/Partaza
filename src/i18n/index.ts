// Nine languages. The app is written in Lithuanian; other languages are produced when text is shown:
// every piece of text passes through tr(), which looks it up in that language's dictionary (src/i18n/<lang>.ts).
// Text missing in a language falls back to English, then to Lithuanian, so a missing entry never breaks a screen.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import * as DE from './de';
import { EN, EN_PATTERNS } from './en';
import * as ES from './es';
import * as ET from './et';
import * as FR from './fr';
import * as LV from './lv';
import * as PL from './pl';
import * as RU from './ru';

export type Lang = 'lt' | 'en' | 'lv' | 'et' | 'pl' | 'ru' | 'de' | 'es' | 'fr';

/** Every language, in the order shown in the picker, with its own name. */
export const LANGUAGES: { code: Lang; name: string; short: string }[] = [
  { code: 'lt', name: 'Lietuvių', short: 'LT' },
  { code: 'en', name: 'English', short: 'EN' },
  { code: 'lv', name: 'Latviešu', short: 'LV' },
  { code: 'et', name: 'Eesti', short: 'ET' },
  { code: 'pl', name: 'Polski', short: 'PL' },
  { code: 'ru', name: 'Русский', short: 'RU' },
  { code: 'de', name: 'Deutsch', short: 'DE' },
  { code: 'es', name: 'Español', short: 'ES' },
  { code: 'fr', name: 'Français', short: 'FR' },
];
const isLang = (value: unknown): value is Lang => LANGUAGES.some((l) => l.code === value);

type Pattern = [RegExp, string | ((...groups: string[]) => string)];
const OTHER: Record<Exclude<Lang, 'lt' | 'en'>, { dict: Record<string, string>; patterns: Pattern[] }> = {
  lv: { dict: LV.DICT, patterns: templated(LV.DICT, LV.TEMPLATES) },
  et: { dict: ET.DICT, patterns: templated(ET.DICT, ET.TEMPLATES) },
  pl: { dict: PL.DICT, patterns: templated(PL.DICT, PL.TEMPLATES) },
  ru: { dict: RU.DICT, patterns: templated(RU.DICT, RU.TEMPLATES) },
  de: { dict: DE.DICT, patterns: templated(DE.DICT, DE.TEMPLATES) },
  es: { dict: ES.DICT, patterns: templated(ES.DICT, ES.TEMPLATES) },
  fr: { dict: FR.DICT, patterns: templated(FR.DICT, FR.TEMPLATES) },
};

/** The English patterns' expressions with a language's sentence templates: $n = the piece as it is, %n = translated. */
function templated(dict: Record<string, string>, templates: string[]): Pattern[] {
  const look = (piece: string) => dict[piece] ?? dict[piece.charAt(0).toUpperCase() + piece.slice(1)] ?? EN[piece] ?? piece;
  return EN_PATTERNS.map(([pattern], i): Pattern => [
    pattern,
    (...groups: string[]) => (templates[i] ?? '').replace(/([$%])(\d)/g, (_m, kind: string, n: string) => {
      const piece = groups[Number(n)] ?? '';
      if (kind === '$' || !piece) return piece;
      const lead = piece.match(/^\s*/)?.[0] ?? '';
      return lead + look(piece.trim());
    }),
  ]).filter((_, i) => !!templates[i]);
}
const KEY = 'partaza.lang';

/** The language of the device: what the app is shown in until the person chooses. */
function deviceLang(): Lang {
  const device = ((typeof navigator !== 'undefined' && navigator.language) || Intl.DateTimeFormat().resolvedOptions().locale || 'lt').toLowerCase();
  const code = device.slice(0, 2);
  if (code === 'ee') return 'et';
  return isLang(code) ? code : 'en';
}

function savedLang(): Lang | null {
  try {
    const saved = globalThis.localStorage?.getItem(KEY);
    if (isLang(saved)) return saved;
  } catch {
    // storage unavailable
  }
  return null;
}

// The static web page is built in Lithuanian; the real language is applied once the app starts.
let current: Lang = 'lt';
/** null while we do not know yet; false until the person has picked a language themselves. */
let chosen: boolean | null = null;
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
  const saved = savedLang();
  if (saved) chosen = true;
  apply(saved ?? deviceLang());
  // On phones there is no localStorage; the saved choice arrives a moment later.
  AsyncStorage.getItem(KEY)
    .then((stored) => {
      const valid = isLang(stored);
      chosen = valid;
      apply(valid ? stored : current);
    })
    .catch(() => {
      chosen = false;
      apply(current);
    });
}

/** The person's own choice: saved and used from now on. */
export function setLang(lang: Lang) {
  chosen = true;
  AsyncStorage.setItem(KEY, lang).catch(() => {
    // not saved; still applies for this visit
  });
  apply(lang);
}

export const getLang = () => current;
const getChosen = () => chosen;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Re-renders the component when the language changes. */
/** false while the person has not yet confirmed a language (null: not known yet). */
export function useLangChosen(): boolean | null {
  return useSyncExternalStore(subscribe, getChosen, () => null);
}

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
  if (current !== 'en') {
    const own = OTHER[current];
    const mine = own.dict[core];
    if (mine !== undefined) return lead + mine + tail;
    for (const [pattern, replacement] of own.patterns) {
      if (pattern.test(core)) return lead + core.replace(pattern, replacement as never) + tail;
    }
  }
  const exact = EN[core];
  if (exact !== undefined) return lead + exact + tail;
  for (const [pattern, replacement] of EN_PATTERNS) {
    if (pattern.test(core)) return lead + core.replace(pattern, replacement as never) + tail;
  }
  // "Naudota · Kaunas, Lietuva": translate each piece on its own.
  if (core.includes(' · ')) return lead + core.split(' · ').map(tr).join(' · ') + tail;
  if (LITHUANIAN.test(core)) missing.add(core);
  return text;
}
