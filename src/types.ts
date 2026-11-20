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
  boat: 'Vandens transportas',
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
  /** The seller's own photo or logo. */
  logo?: string | null;
}

/** A rating one side of a completed order gave the other. Public. */
export interface Review {
  id: string;
  orderKind: 'order' | 'payment';
  orderId: string;
  authorId: string;
  subjectId: string;
  /** Was the rated person the buyer or the seller in that order? */
  subjectRole: 'buyer' | 'seller';
  stars: number;
  comment: string;
  createdAt: number;
}

/** A search the person saved; new matching listings are pointed out to them. */
export interface SavedSearch {
  id: string;
  query: string;
  vehicleType: VehicleType | null;
  country: string | null;
  city: string;
  /** When the person last opened this search; listings newer than this count as new. */
  seenAt: number;
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
  /** Delivery price to other countries; null = a buyer abroad asks the seller first. */
  shippingAbroad?: number | null;
  /** Defect marks on photos: photo address → [x, y] points as shares of the picture's size. */
  photoMarks?: Record<string, number[][]>;
  /** The seller ships but has not set a price: the buyer asks for it in a message. */
  shippingQuote?: boolean;
  pickup: boolean;
  sellerId: string;
  photos: string[];
  allowOffers: boolean;
  createdAt: number;
  /** Free-text description by the seller. */
  description?: string;
  /** Part for a historic / classic vehicle. */
  classic?: boolean;
  /** Part for motorsport: racing, rally, drift, track cars. */
  motorsport?: boolean;
  /** When the seller last lowered the price; the 90-day reminder counts from here (or from createdAt). */
  refreshedAt?: number | null;
  /** A whole vehicle sold for parts in one listing, instead of a single part. */
  wholeVehicle?: boolean;
  /** 'sold' listings are hidden from buyers and counted in the seller's dashboard. */
  status?: 'active' | 'reserved' | 'sold';
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

export type OrderStatus = 'agreed' | 'handed' | 'completed' | 'cancelled';

/**
 * A confirmed purchase. Payments through the platform are not switched on yet, so an order
 * records who buys what and for how much; the two people arrange payment themselves.
 */
export interface Order {
  id: string;
  listingId: string | null;
  threadId: string | null;
  buyerId: string;
  sellerId: string;
  title: string;
  photo: string | null;
  price: number;
  shipping: number | null;
  status: OrderStatus;
  createdAt: number;
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

export type PaidOrderStatus = 'pending' | 'paid' | 'shipped' | 'received' | 'completed' | 'disputed' | 'refunded' | 'cancelled';

export interface ShipTo {
  name?: string | null;
  phone?: string | null;
  address?: { line1?: string | null; line2?: string | null; city?: string | null; postal_code?: string | null; state?: string | null; country?: string | null } | null;
}

/** A purchase paid through the platform. Amounts are in euros. Visible only to its buyer and seller. */
export interface PaidOrder {
  id: string;
  listingId: string | null;
  buyerId: string;
  sellerId: string;
  title: string;
  itemAmount: number;
  shippingAmount: number;
  feeAmount: number;
  total: number;
  delivery: 'shipping' | 'pickup';
  status: PaidOrderStatus;
  shipTo: ShipTo | null;
  tracking: string;
  disputeReason: string;
  createdAt: number;
  paidAt: number | null;
  shippedAt: number | null;
  receivedAt: number | null;
  /** When the money goes to the seller by itself if the buyer does nothing. */
  releaseAt: number | null;
}

export const PAID_ORDER_LABELS: Record<PaidOrderStatus, string> = {
  pending: 'Laukiama apmokėjimo',
  paid: 'Apmokėta – laukiama išsiuntimo',
  shipped: 'Išsiųsta',
  received: 'Gauta – tikrinama',
  completed: 'Užbaigta',
  disputed: 'Pranešta apie problemą',
  refunded: 'Pinigai grąžinti pirkėjui',
  cancelled: 'Atšaukta',
};
