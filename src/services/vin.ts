/**
 * Offline VIN reading. A VIN tells the manufacturer (first three characters) and the model
 * year (tenth character); it does NOT tell the model name or engine without a paid catalogue,
 * so the buyer still types the model. Model-year codes repeat every 30 years, so the year is
 * the most recent one that is not in the future.
 */

export interface VinInfo {
  vin: string;
  make: string | null;
  year: number | null;
}

// World Manufacturer Identifier prefixes -> make. Longest prefix wins.
const WMI: [string, string][] = [
  ['WVW', 'Volkswagen'], ['WV1', 'Volkswagen'], ['WV2', 'Volkswagen'], ['WVG', 'Volkswagen'], ['3VW', 'Volkswagen'], ['1VW', 'Volkswagen'],
  ['WAU', 'Audi'], ['WA1', 'Audi'], ['TRU', 'Audi'],
  ['WBA', 'BMW'], ['WBS', 'BMW'], ['WBX', 'BMW'], ['WBY', 'BMW'], ['5UX', 'BMW'],
  ['WDB', 'Mercedes-Benz'], ['WDD', 'Mercedes-Benz'], ['WDC', 'Mercedes-Benz'], ['WDF', 'Mercedes-Benz'], ['W1K', 'Mercedes-Benz'], ['W1N', 'Mercedes-Benz'], ['W1V', 'Mercedes-Benz'],
  ['W0L', 'Opel'], ['W0V', 'Opel'], ['VXK', 'Opel'],
  ['WF0', 'Ford'], ['1FA', 'Ford'], ['1FT', 'Ford'], ['NM0', 'Ford'],
  ['WP0', 'Porsche'], ['WP1', 'Porsche'],
  ['TMB', 'Škoda'], ['VSS', 'Seat'],
  ['VF1', 'Renault'], ['VF3', 'Peugeot'], ['VF7', 'Citroën'], ['VR1', 'DS'], ['UU1', 'Dacia'],
  ['ZFA', 'Fiat'], ['ZAR', 'Alfa Romeo'], ['ZLA', 'Lancia'],
  ['YV1', 'Volvo'], ['YV4', 'Volvo'], ['YS3', 'Saab'],
  ['SAL', 'Land Rover'], ['SAJ', 'Jaguar'], ['SB1', 'Toyota'],
  ['JT', 'Toyota'], ['NMT', 'Toyota'], ['VNK', 'Toyota'],
  ['JN', 'Nissan'], ['SJN', 'Nissan'], ['VSK', 'Nissan'],
  ['JHM', 'Honda'], ['SHH', 'Honda'], ['SHS', 'Honda'],
  ['JM', 'Mazda'], ['JMZ', 'Mazda'],
  ['JA', 'Mitsubishi'], ['JMB', 'Mitsubishi'],
  ['JF', 'Subaru'], ['JS', 'Suzuki'], ['TSM', 'Suzuki'],
  ['KMH', 'Hyundai'], ['TMA', 'Hyundai'], ['NLH', 'Hyundai'],
  ['KNA', 'Kia'], ['KND', 'Kia'], ['U5Y', 'Kia'],
  ['5YJ', 'Tesla'], ['7SA', 'Tesla'], ['LRW', 'Tesla'], ['XP7', 'Tesla'],
  ['XTA', 'VAZ'], ['YS2', 'Scania'], ['WMA', 'MAN'], ['XLR', 'DAF'], ['VF6', 'Renault Trucks'],
];

const YEAR_CODES = 'ABCDEFGHJKLMNPRSTVWXY123456789';

export function readVin(input: string): VinInfo | null {
  const vin = input.replace(/[\s-]/g, '').toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return null;
  const match = WMI.filter(([prefix]) => vin.startsWith(prefix)).sort((a, b) => b[0].length - a[0].length)[0];
  const index = YEAR_CODES.indexOf(vin[9]);
  let year: number | null = null;
  if (index >= 0) {
    const limit = new Date().getFullYear() + 1;
    year = 1980 + index;
    while (year + 30 <= limit) year += 30;
  }
  return { vin, make: match ? match[1] : null, year };
}

const SYNONYMS: Record<string, string[]> = {
  volkswagen: ['volkswagen', 'vw'],
  'mercedes-benz': ['mercedes-benz', 'mercedes', 'mb'],
  škoda: ['škoda', 'skoda'],
  citroën: ['citroën', 'citroen'],
  vaz: ['vaz', 'lada', 'žiguli', 'ziguli'],
  bmw: ['bmw'],
};

function words(text: string): string {
  return ` ${text.toLowerCase().replace(/[.,;:()/]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
}

/** True when a listing's "fits" text or title mentions the buyer's make and, if given, model. */
export function fitsCar(listingText: string, make: string, model: string): boolean {
  const text = words(listingText);
  const key = make.trim().toLowerCase();
  if (!key) return false;
  const names = SYNONYMS[key] ?? Object.values(SYNONYMS).find((list) => list.includes(key)) ?? [key];
  if (!names.some((name) => text.includes(` ${name} `))) return false;
  const wanted = model.trim().toLowerCase();
  return wanted ? text.includes(wanted) : true;
}
