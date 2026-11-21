import createIconSet from '@expo/vector-icons/createIconSet';

import type { VehicleType } from '@/types';

// A small font with only the pictures we use (cut from Material Community Icons), so showing them
// does not slow down loading. 'car-vintage' is our own drawing of an early horseless carriage for
// classic cars (scripts/make-classic-car-icon.py adds it to the font).
const glyphs = {
  'car-side': 985003, motorbike: 983932, truck: 984381, 'sail-boat': 986824, moped: 987270,
  scooter: 988605, 'go-kart': 986489, bicycle: 987292, 'view-grid-outline': 987609,
  'car-convertible': 984999, 'car-vintage': 986880, 'flag-checkered': 983612,
};

export type VehicleIconName = keyof typeof glyphs;

export const VehicleIcon = createIconSet(glyphs, 'PartazaVehicles', require('../../assets/vehicles.ttf'));

export const VEHICLE_ICONS: Record<VehicleType, VehicleIconName> = {
  car: 'car-side', motorcycle: 'motorbike', truck: 'truck', boat: 'sail-boat', moped: 'moped',
  scooter: 'scooter', kart: 'go-kart', bicycle: 'bicycle',
};
