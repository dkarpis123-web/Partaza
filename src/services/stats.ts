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
