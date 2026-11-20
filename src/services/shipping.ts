import { Listing } from '@/types';

/**
 * What delivery of this listing costs to the given country: the seller's own price at home, the
 * seller's price for abroad elsewhere. Null = not known (pickup only, on request, or no price for abroad).
 */
export function shippingTo(listing: Pick<Listing, 'shipping' | 'shippingAbroad' | 'country'>, destination: string | null): number | null {
  if (!destination || listing.shipping === null) return null;
  return destination === listing.country ? listing.shipping : listing.shippingAbroad ?? null;
}
