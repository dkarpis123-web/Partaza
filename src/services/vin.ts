/**
 * Offline VIN reading. A VIN tells the manufacturer (first three characters) and the model
 * year (tenth character). For Volkswagen-group cars and Mercedes-Benz we also read the model
 * from the platform / series code; for other makes the model, and for every make the engine
 * and equipment, need a paid catalogue, so the person types or corrects the model. Model-year codes repeat every 30 years, so the year is
 * the most recent one that is not in the future.
 */

export interface VinInfo {
  vin: string;
  make: string | null;
  year: number | null;
  /** Model read from the VIN for makes whose numbering we know; a guess the person should check. */
  model: string | null;
}

// Volkswagen group: characters 7-8 are the model platform code.
const VAG_MODELS: Record<string, Record<string, string>> = {
  Volkswagen: {
    '1J': 'Golf IV', '1K': 'Golf V / VI', '5K': 'Golf VI', AU: 'Golf VII', '5G': 'Golf VII', CD: 'Golf VIII',
    '3B': 'Passat B5', '3C': 'Passat B6 / B7', '3G': 'Passat B8', '9N': 'Polo IV', '6R': 'Polo V', AW: 'Polo VI',
    '7H': 'Transporter T5', '7E': 'Transporter T5', '7J': 'Transporter T5', SG: 'Transporter T6', '2K': 'Caddy',
    '5N': 'Tiguan', AD: 'Tiguan II', '1T': 'Touran', '5T': 'Touran II', '7L': 'Touareg', '7P': 'Touareg II',
    '13': 'Scirocco', '16': 'Jetta', '7M': 'Sharan', '7N': 'Sharan II', '2E': 'Crafter', '1Z': 'Golf Plus',
  },
  Audi: {
    '8L': 'A3 (8L)', '8P': 'A3 (8P)', '8V': 'A3 (8V)', '8E': 'A4 B6 / B7', '8K': 'A4 B8', '8W': 'A4 B9',
    '4B': 'A6 C5', '4F': 'A6 C6', '4G': 'A6 C7', '4K': 'A6 C8', '4E': 'A8 (D3)', '4H': 'A8 (D4)',
    '8U': 'Q3', '8R': 'Q5', FY: 'Q5 II', '4L': 'Q7', '4M': 'Q7 II', '8T': 'A5', '8X': 'A1', '8J': 'TT',
  },
  Škoda: {
    '1U': 'Octavia I', '1Z': 'Octavia II', '5E': 'Octavia III', NE: 'Octavia III', NX: 'Octavia IV', '6Y': 'Fabia I', '5J': 'Fabia II',
    NJ: 'Fabia III', '3U': 'Superb I', '3T': 'Superb II', '3V': 'Superb III', '5L': 'Yeti', NS: 'Kodiaq', NU: 'Karoq', NH: 'Rapid',
  },
  Seat: {
    '1M': 'Leon I / Toledo II', '1P': 'Leon II', '5F': 'Leon III', '6L': 'Ibiza III', '6J': 'Ibiza IV', KJ: 'Ibiza V',
    '5P': 'Altea / Toledo III', '7N': 'Alhambra II',
  },
};

// Mercedes-Benz: characters 4-6 are the model series number.
const MERCEDES_MODELS: Record<string, string> = {
  '168': 'A klasė (W168)', '169': 'A klasė (W169)', '176': 'A klasė (W176)', '177': 'A klasė (W177)',
  '245': 'B klasė (W245)', '246': 'B klasė (W246)', '202': 'C klasė (W202)', '203': 'C klasė (W203)',
  '204': 'C klasė (W204)', '205': 'C klasė (W205)', '206': 'C klasė (W206)', '210': 'E klasė (W210)',
  '211': 'E klasė (W211)', '212': 'E klasė (W212)', '213': 'E klasė (W213)', '220': 'S klasė (W220)',
  '221': 'S klasė (W221)', '222': 'S klasė (W222)', '163': 'ML (W163)', '164': 'ML / GL (W164)',
  '166': 'ML / GLE (W166)', '209': 'CLK (W209)', '219': 'CLS (W219)', '218': 'CLS (W218)', '251': 'R klasė',
  '253': 'GLC', '156': 'GLA', '117': 'CLA', '463': 'G klasė', '639': 'Vito / Viano (W639)', '447': 'Vito / V klasė (W447)',
  '906': 'Sprinter (W906)', '907': 'Sprinter (W907)', '901': 'Sprinter', '903': 'Sprinter', '904': 'Sprinter',
};

function readModel(vin: string, make: string | null): string | null {
  if (!make) return null;
  if (make === 'Mercedes-Benz') return MERCEDES_MODELS[vin.slice(3, 6)] ?? null;
  const table = VAG_MODELS[make];
  return table ? table[vin.slice(6, 8)] ?? null : null;
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
const YEAR_IN_TENTH = ['Volkswagen', 'Audi', 'Škoda', 'Seat', 'Porsche', 'Volvo', 'Tesla'];

export function readVin(input: string): VinInfo | null {
  const vin = input.replace(/[\s-]/g, '').toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return null;
  const match = WMI.filter(([prefix]) => vin.startsWith(prefix)).sort((a, b) => b[0].length - a[0].length)[0];
  const index = YEAR_CODES.indexOf(vin[9]);
  let year: number | null = null;
  const make = match ? match[1] : null;
  // Only some manufacturers put the model year in the tenth character; for the rest
  // (Mercedes-Benz, BMW, most French and Japanese cars sold in Europe) it means something else.
  const yearInVin = /^[1-57]/.test(vin) || (make !== null && YEAR_IN_TENTH.includes(make));
  if (index >= 0 && yearInVin) {
    const limit = new Date().getFullYear() + 1;
    year = 1980 + index;
    while (year + 30 <= limit) year += 30;
  }
  return { vin, make, year, model: readModel(vin, make) };
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

/** The short model word to search listings by: "Passat" for "Passat B6 / B7", "W204" for "C klasė (W204)". */
export function modelSearchTerm(info: VinInfo | null): string {
  if (!info?.model) return '';
  if (info.make === 'Mercedes-Benz') {
    const code = info.model.match(/\((W\d+)\)/);
    return code ? code[1] : info.model;
  }
  return info.model.split(/[\s(]/)[0];
}
