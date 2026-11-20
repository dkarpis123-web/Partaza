import type { Listing, User } from '@/types';

/**
 * Sample data for the first version. Everything here is invented for testing;
 * it is replaced by the backend in a later stage.
 */
export const seedUsers: User[] = [
  { id: 'u1', name: 'Rimas K.', kind: 'private', rating: 4.9, reviews: 48, since: '2026 m. kovo' },
  { id: 'u2', name: 'UAB Dalių centras', kind: 'business', rating: 4.7, reviews: 212, since: '2025 m. gegužės' },
  { id: 'u3', name: 'Aistė M.', kind: 'private', rating: 5.0, reviews: 7, since: '2026 m. rugsėjo' },
];

const day = 24 * 60 * 60 * 1000;
const now = Date.now();

export const seedListings: Listing[] = [
  {
    id: 'l9', title: 'Karbiuratorius „Ozon“, veikiantis', price: 60, vat: false, condition: 'used', defects: [],
    oem: '2107-1107010', fits: 'VAZ 2105, 2107', vehicleType: 'car', city: 'Panevėžys', country: 'LT',
    shipping: 2.9, pickup: true, sellerId: 'u3', photos: [], allowOffers: true, createdAt: now - 9 * day, classic: true,
  },
  {
    id: 'l1', title: 'Priekiniai stabdžių diskai, komplektas', price: 85, vat: false, condition: 'used',
    defects: ['Paviršinės rūdys ant disko krašto', 'Griovelis darbiniame paviršiuje'],
    oem: '7E0 615 301', fits: 'VW Transporter T5, T6', vehicleType: 'car', city: 'Kaunas', country: 'LT',
    shipping: 3.5, pickup: true, sellerId: 'u1', photos: [], allowOffers: true, createdAt: now - 1 * day,
  },
  {
    id: 'l2', title: 'Turbina 2.0 TDI, restauruota', price: 320, vat: true, condition: 'refurbished',
    defects: [], oem: '03L 253 016', fits: 'VW Transporter T5, T6', vehicleType: 'car', city: 'Vilnius', country: 'LT',
    shipping: 5.9, pickup: false, sellerId: 'u2', photos: [], allowOffers: true, createdAt: now - 2 * day,
  },
  {
    id: 'l3', title: 'Galinis amortizatorius, kairė', price: 45, vat: true, condition: 'new',
    defects: [], oem: '7H0 513 029', fits: 'VW Transporter T5', vehicleType: 'car', city: 'Klaipėda', country: 'LT',
    shipping: 3.5, pickup: true, sellerId: 'u2', photos: [], allowOffers: false, createdAt: now - 3 * day,
  },
  {
    id: 'l4', title: 'Stabdžių diskai priekiniai, pora', price: 92, vat: true, condition: 'used',
    defects: [], oem: '7E0 615 301', fits: 'VW Transporter T5, T6', vehicleType: 'car', city: 'Vilnius', country: 'LT',
    shipping: 3.5, pickup: false, sellerId: 'u2', photos: [], allowOffers: true, createdAt: now - 4 * day,
  },
  {
    id: 'l5', title: 'Grandinės ir žvaigždučių komplektas', price: 55, vat: false, condition: 'used',
    defects: ['Nusidėvėję galinės žvaigždutės dantys'], oem: '', fits: 'Yamaha MT-07', vehicleType: 'motorcycle',
    city: 'Šiauliai', country: 'LT', shipping: 3.5, pickup: true, sellerId: 'u3', photos: [], allowOffers: true,
    createdAt: now - 5 * day,
  },
  {
    id: 'l6', title: 'Pakabinamo variklio sraigtas', price: 70, vat: false, condition: 'used',
    defects: [], oem: '', fits: 'Yamaha 40–60 AG', vehicleType: 'boat', city: 'Klaipėda', country: 'LT',
    shipping: null, pickup: true, sellerId: 'u3', photos: [], allowOffers: true, createdAt: now - 6 * day,
  },
  {
    id: 'l7', title: 'Galiniai žibintai, komplektas', price: 180, vat: true, condition: 'used',
    defects: [], oem: '', fits: 'MAN TGX', vehicleType: 'truck', city: 'Ryga', country: 'LV',
    shipping: 9.9, pickup: true, sellerId: 'u2', photos: [], allowOffers: true, createdAt: now - 7 * day,
  },
  {
    id: 'l8', title: 'Hidrauliniai diskiniai stabdžiai, pora', price: 60, vat: false, condition: 'used',
    defects: [], oem: '', fits: 'Kalnų dviračiai, 160 mm', vehicleType: 'bicycle', city: 'Kaunas', country: 'LT',
    shipping: 2.9, pickup: true, sellerId: 'u1', photos: [], allowOffers: true, createdAt: now - 8 * day,
  },
];
