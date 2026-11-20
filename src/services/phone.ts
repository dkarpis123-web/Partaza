/**
 * Normalises a phone number to international form (+37061234567).
 * Lithuanian shortcuts are accepted: 861234567 and 37061234567. Returns null when the number
 * cannot be a real phone number. The number is NOT verified by SMS yet.
 */
export function normalizePhone(input: string): string | null {
  let value = input.replace(/[\s().-]/g, '');
  if (/^8\d{8}$/.test(value)) value = `+370${value.slice(1)}`;
  else if (/^00\d+$/.test(value)) value = `+${value.slice(2)}`;
  else if (/^370\d{8}$/.test(value)) value = `+${value}`;
  return /^\+[1-9]\d{7,14}$/.test(value) ? value : null;
}
