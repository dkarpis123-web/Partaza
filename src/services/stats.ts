import type { Donor, Listing } from '@/types';

export interface DonorStats {
  donor: Donor;
  /** Money received for sold parts of this vehicle. */
  recovered: number;
  /** Purchase cost not yet covered by sales (0 once the vehicle has paid for itself). */
  toRecover: number;
  /** recovered - cost; negative until the vehicle has paid for itself. */
  profit: number;
  /** profit / cost, in percent; null when the cost is 0. Not annualised. */
  roi: number | null;
  soldCount: number;
  activeCount: number;
  /** Asking prices of the parts still listed. */
  stockValue: number;
}

export interface SellerStats {
  income: number;
  /** All donor purchase costs + costs of single parts already sold. */
  expenses: number;
  profit: number;
  soldCount: number;
  activeCount: number;
  stockValue: number;
  /** Sold single parts with no purchase price entered (their cost is counted as 0). */
  soldWithoutCost: number;
  firstListingAt: number | null;
  donors: DonorStats[];
}

const sum = (values: number[]) => Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;
const soldFor = (l: Listing) => l.soldPrice ?? l.price;

/**
 * Seller's own figures. Money actually spent on a dismantled vehicle counts as an expense
 * from the day it is bought; a single part's cost counts when that part is sold.
 * Platform fees, shipping and taxes are not included.
 */
export function sellerStats(listings: Listing[], donors: Donor[], sellerId: string): SellerStats {
  const mine = listings.filter((l) => l.sellerId === sellerId);
  const sold = mine.filter((l) => l.status === 'sold');
  const active = mine.filter((l) => l.status !== 'sold');
  const singlesSold = sold.filter((l) => !l.donorId);

  const donorStats = donors.map<DonorStats>((donor) => {
    const parts = mine.filter((l) => l.donorId === donor.id);
    const partsSold = parts.filter((l) => l.status === 'sold');
    const partsActive = parts.filter((l) => l.status !== 'sold');
    const recovered = sum(partsSold.map(soldFor));
    const profit = Math.round((recovered - donor.cost) * 100) / 100;
    return {
      donor, recovered, profit,
      toRecover: Math.max(0, Math.round((donor.cost - recovered) * 100) / 100),
      roi: donor.cost > 0 ? Math.round((profit / donor.cost) * 100) : null,
      soldCount: partsSold.length, activeCount: partsActive.length,
      stockValue: sum(partsActive.map((l) => l.price)),
    };
  });

  const income = sum(sold.map(soldFor));
  const expenses = sum([...donors.map((d) => d.cost), ...singlesSold.map((l) => l.cost ?? 0)]);
  return {
    income, expenses,
    profit: Math.round((income - expenses) * 100) / 100,
    soldCount: sold.length, activeCount: active.length,
    stockValue: sum(active.map((l) => l.price)),
    soldWithoutCost: singlesSold.filter((l) => l.cost == null).length,
    firstListingAt: mine.length > 0 ? Math.min(...mine.map((l) => l.createdAt)) : null,
    donors: donorStats,
  };
}

export const STALE_DAYS = 90;

export interface StaleListing {
  listing: Listing;
  /** Whole days since it was listed or since the price was last lowered. */
  days: number;
  /** Suggested new price: 10 % lower, rounded to a whole euro (to 0.50 € under 20 €). */
  suggested: number;
}

/** The seller's active listings that have waited 90 days or more without a price cut, oldest first. */
export function staleListings(listings: Listing[], sellerId: string, now: number): StaleListing[] {
  return listings
    .filter((l) => l.sellerId === sellerId && l.status !== 'sold')
    .map((listing) => {
      const since = Math.max(listing.createdAt, listing.refreshedAt ?? 0);
      const lower = listing.price * 0.9;
      const suggested = listing.price >= 20 ? Math.round(lower) : Math.round(lower * 2) / 2;
      return { listing, days: Math.floor((now - since) / 86400000), suggested };
    })
    .filter((x) => x.days >= STALE_DAYS && x.suggested > 0 && x.suggested < x.listing.price)
    .sort((a, b) => b.days - a.days);
}
