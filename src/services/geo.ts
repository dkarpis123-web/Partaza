// Countries and "where is this visitor". Listings store a two-letter country code (LT, LV…).
import AsyncStorage from '@react-native-async-storage/async-storage';

import { COUNTRY_NAMES } from '@/data/countries';
import { getLang } from '@/i18n';

/** All countries a seller can choose, Lithuania and its neighbours first. */
export const COUNTRIES = Object.keys(COUNTRY_NAMES);

const LEGACY: Record<string, string> = Object.fromEntries(Object.entries(COUNTRY_NAMES).map(([code, names]) => [names.lt.toLowerCase(), code]));

/** Accepts a code or an older Lithuanian name ("Lietuva") and returns the code; unknown values pass through. */
export function countryCode(value: string | null | undefined): string {
  if (!value) return 'LT';
  const upper = value.trim().toUpperCase();
  if (COUNTRY_NAMES[upper]) return upper;
  return LEGACY[value.trim().toLowerCase()] ?? value;
}

/** The country's name in the language the app is shown in. */
export function countryName(code: string): string {
  return COUNTRY_NAMES[code]?.[getLang()] ?? code;
}

/** The flag for a two-letter code, built from the code itself. */
export function flagOf(code: string): string {
  if (!/^[A-Z]{2}$/.test(code) || code === 'XK') return '';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export const countryLabel = (code: string) => `${flagOf(code)} ${countryName(code)}`.trim();

const BY_ZONE: Record<string, string> = {
  'Europe/Vilnius': 'LT', 'Europe/Riga': 'LV', 'Europe/Tallinn': 'EE', 'Europe/Warsaw': 'PL', 'Europe/Berlin': 'DE', 'Europe/Busingen': 'DE',
  'Europe/Helsinki': 'FI', 'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO', 'Europe/Copenhagen': 'DK', 'Europe/London': 'GB', 'Europe/Dublin': 'IE',
  'Europe/Amsterdam': 'NL', 'Europe/Brussels': 'BE', 'Europe/Paris': 'FR', 'Europe/Madrid': 'ES', 'Europe/Rome': 'IT', 'Europe/Vienna': 'AT',
  'Europe/Prague': 'CZ', 'Europe/Kyiv': 'UA', 'Europe/Kiev': 'UA', 'Europe/Zurich': 'CH', 'Europe/Lisbon': 'PT', 'Europe/Budapest': 'HU',
  'Europe/Bucharest': 'RO', 'Europe/Sofia': 'BG', 'Europe/Athens': 'GR', 'Europe/Bratislava': 'SK', 'Europe/Ljubljana': 'SI', 'Europe/Zagreb': 'HR',
};

export interface Place {
  country: string | null;
  city: string;
}

const KEY = 'partaza.place';
let known: Place | null = null;

/** First guess, available at once: the country of the device's time zone. Asks nothing and sends nothing. */
export function detectCountry(): string | null {
  if (known?.country) return known.country;
  try {
    return BY_ZONE[Intl.DateTimeFormat().resolvedOptions().timeZone] ?? null;
  } catch {
    return null;
  }
}

/**
 * Better guess: the country and city of the network the visitor is connected from, as seen by our
 * web server. Nothing is stored on the server; the answer is kept on the device for next time.
 */
export async function locate(): Promise<Place> {
  if (known) return known;
  try {
    const saved = await AsyncStorage.getItem(KEY);
    if (saved) {
      known = JSON.parse(saved) as Place;
      return known;
    }
  } catch {
    // fall through to asking the server
  }
  try {
    const base = typeof window !== 'undefined' && window.location?.origin?.startsWith('http') ? '' : 'https://partaza.eu';
    const response = await fetch(`${base}/api/geo`);
    const data = await response.json();
    const country = typeof data.country === 'string' && COUNTRY_NAMES[data.country] ? data.country : null;
    if (country) {
      known = { country, city: typeof data.city === 'string' ? data.city : '' };
      AsyncStorage.setItem(KEY, JSON.stringify(known)).catch(() => {});
      return known;
    }
  } catch {
    // offline or not on our server: keep the time-zone guess
  }
  return { country: detectCountry(), city: '' };
}
