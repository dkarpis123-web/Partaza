// Countries and "where is this visitor". Listings store a two-letter country code (LT, LV…).
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useSyncExternalStore } from 'react';

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

export interface Place {
  country: string | null;
  city: string;
}

export type Consent = 'unknown' | 'asking' | 'granted' | 'denied';
interface GeoState {
  consent: Consent;
  place: Place | null;
}

const KEY = 'partaza.geo';
let state: GeoState = { consent: 'unknown', place: null };
let loaded = false;
const listeners = new Set<() => void>();
const emit = (next: GeoState) => {
  state = next;
  listeners.forEach((l) => l());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (!loaded) {
    loaded = true;
    AsyncStorage.getItem(KEY)
      .then((saved) => {
        const parsed = saved ? (JSON.parse(saved) as GeoState) : null;
        emit(parsed && (parsed.consent === 'granted' || parsed.consent === 'denied') ? parsed : { consent: 'asking', place: null });
      })
      .catch(() => emit({ consent: 'asking', place: null }));
  }
  return () => listeners.delete(listener);
};
const SERVER: GeoState = { consent: 'unknown', place: null };

/** The person's answer about location ('asking' = not answered yet) and, if allowed, where they are. */
export function useGeo(): GeoState {
  return useSyncExternalStore(subscribe, () => state, () => SERVER);
}

/** The country the person is in, or null if they have not allowed location. */
export const detectCountry = (): string | null => state.place?.country ?? null;

const save = (next: GeoState) => {
  emit(next);
  AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
};

export function declineLocation() {
  save({ consent: 'denied', place: null });
}

/**
 * Asks the browser or phone for permission (its own prompt), then turns the rough position into a
 * country and city on our server. The position itself is not stored anywhere.
 */
export async function allowLocation(): Promise<Place | null> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      declineLocation();
      return null;
    }
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    // Rounded to about a kilometre: enough for a city, not enough for an address.
    const lat = position.coords.latitude.toFixed(2);
    const lon = position.coords.longitude.toFixed(2);
    const base = typeof window !== 'undefined' && window.location?.origin?.startsWith('http') ? '' : 'https://partaza.eu';
    const response = await fetch(`${base}/api/geo?lat=${lat}&lon=${lon}`);
    const data = await response.json();
    const country = typeof data.country === 'string' && COUNTRY_NAMES[data.country] ? data.country : null;
    const place = { country, city: typeof data.city === 'string' ? data.city : '' };
    save({ consent: 'granted', place });
    return place;
  } catch {
    declineLocation();
    return null;
  }
}

// The country a buyer wants parts delivered to. Their own choice wins over the detected place.
const DEST_KEY = 'partaza.dest';
let manualDest: string | null = null;
let destLoaded = false;
const destListeners = new Set<() => void>();
const subscribeDest = (listener: () => void) => {
  destListeners.add(listener);
  if (!destLoaded) {
    destLoaded = true;
    AsyncStorage.getItem(DEST_KEY)
      .then((saved) => {
        if (saved && COUNTRY_NAMES[saved]) {
          manualDest = saved;
          destListeners.forEach((l) => l());
        }
      })
      .catch(() => {});
  }
  return () => destListeners.delete(listener);
};

/** Delivery country: `manual` is what the buyer picked by hand, `country` is that or, failing it, where they are. */
export function useDestination(): { country: string | null; manual: string | null } {
  const manual = useSyncExternalStore(subscribeDest, () => manualDest, () => null);
  const detected = useGeo().place?.country ?? null;
  return { country: manual ?? detected, manual };
}

/** Sets the delivery country by hand; null goes back to the detected place. */
export function setDestination(code: string | null) {
  manualDest = code;
  destListeners.forEach((l) => l());
  (code ? AsyncStorage.setItem(DEST_KEY, code) : AsyncStorage.removeItem(DEST_KEY)).catch(() => {});
}
