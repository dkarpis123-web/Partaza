import type { Listing, SavedSearch } from '@/types';

/** Lower case, no spaces: "7E0 615 301" and "7e0615301" compare equal. */
export function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '');
}

/** Does an active listing match a saved search? Uses the same rules as the search screen. */
export function matchesSearch(listing: Listing, search: Pick<SavedSearch, 'query' | 'vehicleType' | 'country' | 'city'>): boolean {
  if ((listing.status ?? 'active') !== 'active') return false;
  const q = normalize(search.query);
  if (q && !normalize(`${listing.title} ${listing.oem} ${listing.fits} ${listing.description ?? ''}`).includes(q)) return false;
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
