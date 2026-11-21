import type { Listing, SavedSearch } from '@/types';

/** Lower case, no spaces: "7E0 615 301" and "7e0615301" compare equal. */
export function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '');
}

/** Is the listing promoted (paid to be shown first) right now? */
export const promoted = (listing: Pick<Listing, 'bumpedUntil'>) => !!listing.bumpedUntil && listing.bumpedUntil > Date.now();

const codeOnly = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Does the listing contain what was typed? Plain text is compared without spaces; a code is also compared
 * without dashes and dots, against the part number and the other codes on the part - so "1587113-00-B",
 * "158711300b" and a supplier code written on the label all find the same listing.
 */
export function textMatches(listing: Pick<Listing, 'title' | 'oem' | 'altCodes' | 'fits' | 'description'>, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  if (normalize(`${listing.title} ${listing.oem} ${listing.altCodes ?? ''} ${listing.fits} ${listing.description ?? ''}`).includes(q)) return true;
  const code = codeOnly(query);
  if (code.length < 4 || !/\d/.test(code)) return false;
  return [listing.oem, ...(listing.altCodes ?? '').split(',')].some((c) => codeOnly(c).includes(code));
}

/** Does an active listing match a saved search? Uses the same rules as the search screen. */
export function matchesSearch(listing: Listing, search: Pick<SavedSearch, 'query' | 'vehicleType' | 'country' | 'city'>): boolean {
  if ((listing.status ?? 'active') !== 'active') return false;
  if (!textMatches(listing, search.query)) return false;
  if (search.vehicleType && listing.vehicleType !== search.vehicleType) return false;
  if (search.country && listing.country !== search.country) return false;
  const c = normalize(search.city);
  if (c && !normalize(listing.city).includes(c)) return false;
  return true;
}

/** Listings that appeared after the search was last opened, excluding the person's own. */
export function newMatches(listings: Listing[], search: SavedSearch, myId: string): Listing[] {
  return listings.filter((l) => l.sellerId !== myId && l.createdAt > search.seenAt && matchesSearch(l, search));
}
