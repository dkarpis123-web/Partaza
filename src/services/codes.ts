import { scanFromURLAsync } from 'expo-camera';
import { Platform } from 'react-native';

type Detector = { detect: (image: unknown) => Promise<{ rawValue?: string }[]> };

const limit = <T,>(work: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([work.catch(() => fallback), new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);

/** Barcodes and QR codes in one photo, read on the device itself. Empty when none is found or reading is not available. */
async function scanOne(uri: string): Promise<string[]> {
  if (Platform.OS === 'web') {
    const Maker = (globalThis as unknown as { BarcodeDetector?: new () => Detector }).BarcodeDetector;
    if (!Maker || typeof createImageBitmap !== 'function') return [];
    const bitmap = await createImageBitmap(await (await fetch(uri)).blob());
    return (await new Maker().detect(bitmap)).map((code) => code.rawValue ?? '');
  }
  return (await scanFromURLAsync(uri)).map((code) => code.data);
}

/**
 * Reads the barcodes and QR codes on the seller's photos (first four) so the part can be looked
 * up by them when no part number is readable. Never throws; gives up on a photo after a few seconds.
 */
export async function scanCodes(uris: string[]): Promise<string[]> {
  const found: string[] = [];
  for (const uri of uris.slice(0, 4)) {
    for (const code of await limit(scanOne(uri), 4000, [] as string[])) {
      const text = code.trim().slice(0, 120);
      if (text.length >= 4 && !found.includes(text)) found.push(text);
    }
  }
  return found.slice(0, 6);
}
