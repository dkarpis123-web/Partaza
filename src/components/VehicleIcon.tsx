import createIconSet from '@expo/vector-icons/createIconSet';

import type { VehicleType } from '@/types';

// A 2 KB font with only the nine pictures we use (cut from Material Community Icons),
// so showing them does not slow down loading.
const glyphs = {
  'car-side': 985003, motorbike: 983932, truck: 984381, 'sail-boat': 986824, moped: 987270,
  scooter: 988605, 'go-kart': 986489, bicycle: 987292, 'view-grid-outline': 987609,
};

export type VehicleIconName = keyof typeof glyphs;

export const VehicleIcon = createIconSet(glyphs, 'PartazaVehicles', require('../../assets/vehicles.ttf'));

export const VEHICLE_ICONS: Record<VehicleType, VehicleIconName> = {
  car: 'car-side', motorcycle: 'motorbike', truck: 'truck', boat: 'sail-boat', moped: 'moped',
  scooter: 'scooter', kart: 'go-kart', bicycle: 'bicycle',
};
