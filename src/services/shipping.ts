import { Listing, ShipZone } from '@/types';

export const EU = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
/** European countries outside the EU that parcels go to. Russia and Belarus are not here: vehicle parts may not be sent there. */
export const EUROPE_NON_EU = ['GB', 'NO', 'CH', 'IS', 'LI', 'UA', 'MD', 'RS', 'ME', 'MK', 'AL', 'BA', 'XK', 'AD', 'MC', 'SM', 'VA', 'GI'];
/** Countries under sanctions that bar sending vehicle parts there: never a delivery destination. */
export const NO_DELIVERY = ['RU', 'BY', 'KP', 'IR', 'SY', 'CU'];

/** The choices a seller has, in the order shown. */
export const SHIP_ZONES: { value: ShipZone; label: string }[] = [
  { value: 'home', label: 'Tik savo šalyje' },
  { value: 'eu', label: 'Į Europos Sąjungos šalis' },
  { value: 'europe', label: 'Į visą Europą (su JK, Norvegija, Šveicarija)' },
  { value: 'world', label: 'Į visą pasaulį' },
];
export const SHIP_ZONE_SHORT: Record<ShipZone, string> = {
  home: 'tik savo šalyje',
  eu: 'į ES šalis',
  europe: 'į visą Europą',
  world: 'į visą pasaulį',
};

/** Does a seller in `from` with this zone send to `to`? Within the seller's own country always. */
export function zoneAllows(from: string, zone: ShipZone | undefined, to: string): boolean {
  if (to === from) return true;
  if (NO_DELIVERY.includes(to)) return false;
  switch (zone ?? 'eu') {
    case 'home':
      return false;
    case 'eu':
      return EU.includes(to);
    case 'europe':
      return EU.includes(to) || EUROPE_NON_EU.includes(to);
    default:
      return true;
  }
}

/** Is the part sent to this country at all (with a price or on request)? */
export function shipsTo(listing: Pick<Listing, 'shipping' | 'shippingQuote' | 'shipZone' | 'country'>, destination: string): boolean {
  if (listing.shipping === null && !listing.shippingQuote) return false;
  return zoneAllows(listing.country, listing.shipZone, destination);
}

/**
 * What delivery of this listing costs to the given country: the seller's own price at home, the
 * seller's price for abroad elsewhere. Null = not known (pickup only, on request, not sent there, or no price for abroad).
 */
export function shippingTo(listing: Pick<Listing, 'shipping' | 'shippingAbroad' | 'country' | 'shipZone'>, destination: string | null): number | null {
  if (!destination || listing.shipping === null) return null;
  if (!zoneAllows(listing.country, listing.shipZone, destination)) return null;
  return destination === listing.country ? listing.shipping : listing.shippingAbroad ?? null;
}
