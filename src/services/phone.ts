/** International dialling codes of the countries we list, by two-letter country code. */
export const DIAL: Record<string, string> = {
  LT: '370', LV: '371', EE: '372', PL: '48', DE: '49', FI: '358', SE: '46', NO: '47', DK: '45', GB: '44', IE: '353', NL: '31', BE: '32',
  LU: '352', FR: '33', ES: '34', PT: '351', IT: '39', AT: '43', CH: '41', CZ: '420', SK: '421', HU: '36', SI: '386', HR: '385', RO: '40',
  BG: '359', GR: '30', CY: '357', MT: '356', IS: '354', UA: '380', MD: '373', RS: '381', BA: '387', ME: '382', MK: '389', AL: '355',
  XK: '383', TR: '90', GE: '995', AM: '374', AZ: '994', KZ: '7', US: '1', CA: '1',
};

/** What to show as an example in the phone field for a person in this country. */
export function phoneExample(country: string | null | undefined): string {
  const dial = DIAL[country ?? 'LT'] ?? '370';
  return dial === '370' ? '+37061234567' : `+${dial} …`;
}

/**
 * Normalises a phone number to international form (+37061234567). A number typed without a country
 * code gets the code of the given country (where the person is): 0612 34567 → +370…, and the
 * Lithuanian 8 612 34567 as well. Returns null when it cannot be a real phone number.
 * The number is NOT verified by SMS yet.
 */
export function normalizePhone(input: string, country: string | null = 'LT'): string | null {
  let value = input.replace(/[\s().-]/g, '');
  const dial = DIAL[country ?? 'LT'] ?? '370';
  if (/^00\d+$/.test(value)) value = `+${value.slice(2)}`;
  else if (dial === '370' && /^8\d{8}$/.test(value)) value = `+370${value.slice(1)}`;
  else if (/^\d+$/.test(value) && value.startsWith(dial) && value.length >= dial.length + 7) value = `+${value}`;
  else if (/^0\d{6,12}$/.test(value)) value = `+${dial}${value.slice(1)}`;
  else if (/^[1-9]\d{6,12}$/.test(value)) value = `+${dial}${value}`;
  return /^\+[1-9]\d{7,14}$/.test(value) ? value : null;
}
