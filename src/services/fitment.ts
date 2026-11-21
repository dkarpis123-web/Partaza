import { fitsCar } from '@/services/vin';
import type { Listing, MyCar } from '@/types';

/** One vehicle a part fits, read from the listing's "fits" text: the name and the production years, if given. */
export interface FitRow {
  name: string;
  from: number | null;
  /** null with a `from` means "still made" (e.g. "2023–"). */
  to: number | null;
}

const YEARS = /\(?\b((?:19|20)\d\d)\s*(?:[–—-]\s*((?:19|20)\d\d)?)?\)?\s*(?:m\.)?/;

/** "VW Golf VII 2012–2019, Audi A3 (8V) 2013-" → rows with names and year ranges. */
export function parseFitment(fits: string): FitRow[] {
  return fits
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const years = part.match(YEARS);
      if (!years) return { name: part, from: null, to: null };
      const from = Number(years[1]);
      const open = /[–—-]\s*\)?\s*(?:m\.)?$/.test(years[0].trim()) && !years[2];
      const to = years[2] ? Number(years[2]) : open ? null : from;
      const name = part.replace(years[0], ' ').replace(/\s{2,}/g, ' ').replace(/[\s(–—-]+$/, '').trim();
      return { name: name || part, from, to };
    })
    .slice(0, 30);
}

export const yearsText = (row: FitRow) => (row.from === null ? '' : row.to === null ? `${row.from}–` : row.to === row.from ? `${row.from}` : `${row.from}–${row.to}`);

/**
 * Does the listing fit the buyer's saved car?
 * 'fits' – make and model are named (and the year, if both sides give one, is in range);
 * 'year' – make and model are named, but only for other years; 'no' – the car is not named.
 */
export function fitVerdict(listing: Pick<Listing, 'fits' | 'title'>, car: MyCar): 'fits' | 'year' | 'no' {
  const rows = parseFitment(listing.fits).filter((row) => fitsCar(row.name, car.make, car.model));
  if (rows.length === 0) return fitsCar(`${listing.fits} ${listing.title}`, car.make, car.model) ? 'fits' : 'no';
  const year = car.year;
  if (!year) return 'fits';
  const dated = rows.filter((row) => row.from !== null);
  if (dated.length < rows.length) return 'fits'; // some entry gives no years, so it cannot be ruled out
  return dated.some((row) => year >= (row.from ?? 0) && year <= (row.to ?? 9999)) ? 'fits' : 'year';
}
