import type { Listing, VehicleType } from '@/types';

/** A rough postage estimate found on public carrier pages. */
export interface ShippingEstimate {
  found: boolean;
  low?: number;
  high?: number;
  weightKg?: number | null;
  size?: string;
  note: string;
  sources: { title: string; url: string }[];
}

export interface Recognition {
  title: string;
  oem: string;
  fits: string;
  vehicleType: VehicleType;
  suggestedDefects: string[];
  /** true while no real model is connected and the fields are sample values. */
  isDemo: boolean;
}

/**
 * Recognises a part from its photos.
 *
 * FIRST VERSION: no model is connected yet, so this returns sample values and
 * `isDemo: true`. The review screen tells the seller that the fields are an
 * example and must be corrected. Replace the body with a call to the backend
 * (vision model) in the AI stage; the return shape stays the same.
 */
export async function recognizePart(photoUris: string[]): Promise<Recognition> {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return {
    title: 'Priekiniai stabdžių diskai, komplektas',
    oem: '7E0 615 301',
    fits: 'VW Transporter T5, T6',
    vehicleType: 'car',
    suggestedDefects: photoUris.length > 0 ? ['Paviršinės rūdys'] : [],
    isDemo: true,
  };
}

/** Asking prices found on public web pages by the AI price search. */
export interface WebPrices {
  found: boolean;
  low?: number;
  typical?: number;
  high?: number;
  /** What the prices refer to and how sure the search is. */
  note: string;
  sources: { title: string; url: string; price: number | null }[];
}

export interface Comparable {
  id: string;
  title: string;
  price: number;
  condition: Listing['condition'];
  defects: number;
  place: string;
}

export interface PriceAdvice {
  count: number;
  min: number;
  max: number;
  /** Middle price of the comparable listings. */
  median: number;
  /** Suggested prices: sells quickly / market price / patient seller. */
  quick: number;
  fair: number;
  high: number;
  comparables: Comparable[];
}

function normalizeCode(code: string): string {
  return code.replace(/[\s.\-]+/g, '').toUpperCase();
}

function roundPrice(value: number): number {
  return value >= 20 ? Math.round(value) : Math.round(value * 2) / 2;
}

/**
 * Price advisor: compares the part with listings that carry the same part code and suggests
 * three prices. FIRST VERSION: compares only with listings on our own marketplace. Comparison
 * with public prices elsewhere (shown with named, linked sources) is a later stage and needs
 * the server-side AI search; the return shape stays the same.
 *
 * Defects lower the suggestion: a part with declared defects is advised 15 % below the same
 * part without them.
 */
export function priceAdviceFromMarket(oem: string, listings: Listing[], hasDefects = false): PriceAdvice | null {
  const code = normalizeCode(oem);
  if (code.length < 4) return null;
  const same = listings.filter((l) => (l.status ?? 'active') === 'active' && normalizeCode(l.oem) === code);
  if (same.length === 0) return null;
  const prices = same.map((l) => l.price).sort((a, b) => a - b);
  const middle = Math.floor(prices.length / 2);
  const median = prices.length % 2 === 1 ? prices[middle] : (prices[middle - 1] + prices[middle]) / 2;
  const base = hasDefects ? median * 0.85 : median;
  return {
    count: prices.length,
    min: prices[0],
    max: prices[prices.length - 1],
    median: roundPrice(median),
    quick: roundPrice(base * 0.9),
    fair: roundPrice(base),
    high: roundPrice(Math.max(base * 1.1, hasDefects ? base : prices[prices.length - 1])),
    comparables: same
      .slice()
      .sort((a, b) => a.price - b.price)
      .slice(0, 5)
      .map((l) => ({ id: l.id, title: l.title, price: l.price, condition: l.condition, defects: l.defects.length, place: l.city })),
  };
}
