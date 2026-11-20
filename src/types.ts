export type VehicleType =
  | 'car'
  | 'motorcycle'
  | 'truck'
  | 'boat'
  | 'moped'
  | 'scooter'
  | 'kart'
  | 'bicycle';

export const VEHICLE_LABELS: Record<VehicleType, string> = {
  car: 'Automobiliai',
  motorcycle: 'Motociklai',
  truck: 'Sunkvežimiai',
  boat: 'Laivai',
  moped: 'Mopedai',
  scooter: 'Motoroleriai',
  kart: 'Kartingai',
  bicycle: 'Dviračiai',
};

export type Condition = 'new' | 'used' | 'refurbished';

export const CONDITION_LABELS: Record<Condition, string> = {
  new: 'Nauja',
  used: 'Naudota',
  refurbished: 'Restauruota',
};

export type SellerKind = 'private' | 'business';

export interface User {
  id: string;
  name: string;
  kind: SellerKind;
  rating: number;
  reviews: number;
  since: string;
}

export interface Listing {
  id: string;
  title: string;
  price: number;
  /** true = price includes VAT (seller is a VAT payer). */
  vat: boolean;
  condition: Condition;
  /** Defects confirmed by the seller. Empty array = no defects declared. */
  defects: string[];
  oem: string;
  fits: string;
  vehicleType: VehicleType;
  city: string;
  country: string;
  /** Delivery price paid by the buyer; null = pickup only. */
  shipping: number | null;
  pickup: boolean;
  sellerId: string;
  photos: string[];
  allowOffers: boolean;
  createdAt: number;
  /** Part for a historic / classic vehicle. */
  classic?: boolean;
  /** A whole vehicle sold for parts in one listing, instead of a single part. */
  wholeVehicle?: boolean;
  /** 'sold' listings are hidden from buyers and counted in the seller's dashboard. */
  status?: 'active' | 'sold';
  /* The fields below are private: only the seller ever receives them. */
  /** Dismantled vehicle this part came from, if any. */
  donorId?: string | null;
  /** What the seller paid for this single part (not used when the part comes from a donor). */
  cost?: number | null;
  soldPrice?: number | null;
}

/** The buyer's own vehicle, kept on this device only, used to filter parts that fit. */
export interface MyCar {
  make: string;
  model: string;
  vin: string;
  year: number | null;
}

/** A vehicle the seller bought to dismantle. Private to the seller. */
export interface Donor {
  id: string;
  name: string;
  vin: string;
  /** Purchase price plus any other outlay the seller wants to recover. */
  cost: number;
  createdAt: number;
}

export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'countered';

export interface Message {
  id: string;
  senderId: string;
  kind: 'text' | 'offer';
  text?: string;
  amount?: number;
  status?: OfferStatus;
  at: number;
}

export interface Thread {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  messages: Message[];
}

/** What the seller fills in; the id, seller and date are added when it is published. */
export type ListingDraft = Omit<Listing, 'id' | 'sellerId' | 'createdAt' | 'status' | 'soldPrice'>;
