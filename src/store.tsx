import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { PHOTO_BUCKET, supabase } from '@/backend/client';
import { seedListings, seedUsers } from '@/data/seed';
import type { Donor, Listing, ListingDraft, Message, MyCar, Order, SellerKind, Thread, User } from '@/types';

/**
 * One store, two modes.
 * - Demo (no server configured): sample data kept in memory, nothing leaves the device.
 * - Live (EXPO_PUBLIC_SUPABASE_* set): accounts, listings, photos and chats are kept in Supabase.
 * Every action resolves to null on success or to a message for the user on failure.
 */

interface State {
  ready: boolean;
  me: User;
  registered: boolean;
  users: User[];
  listings: Listing[];
  threads: Thread[];
  /** The signed-in seller's own dismantled vehicles. */
  donors: Donor[];
  /** Ids of listings the signed-in person has saved. */
  favorites: string[];
  /** Ids of people the signed-in person has blocked. Their listings and chats are hidden. */
  blocked: string[];
  /** The signed-in person's own phone number; '' when not given yet. Never shown to others. */
  phone: string;
  /** The signed-in person's purchases and sales paid through the platform. */
  orders: Order[];
  /** Ids of sellers who can take payments through the platform. */
  payReady: string[];
}

export type OrderStep = 'ship' | 'received' | 'confirm' | 'dispute' | 'cancel';
export interface PayoutStatus {
  /** false = payments are not switched on for the whole platform yet. */
  configured: boolean;
  exists: boolean;
  ready: boolean;
  error?: string;
}

type Result = Promise<string | null>;

interface Store extends State {
  live: boolean;
  /** Threads whose latest message came from the other person and has not been opened yet (tracked on this device). */
  unreadThreadIds: string[];
  markRead: (threadId: string) => void;
  /** Saved on this device only; never sent to the server. */
  myCar: MyCar | null;
  setMyCar: (car: MyCar | null) => void;
  registerDemo: (name: string, kind: SellerKind, phone: string) => void;
  signUp: (email: string, password: string, name: string, kind: SellerKind, phone: string) => Result;
  setPhone: (phone: string) => Result;
  /** Saves or un-saves a listing. */
  toggleFavorite: (listingId: string) => Result;
  blockUser: (userId: string) => Result;
  unblockUser: (userId: string) => Result;
  /** Sends a link for choosing a new password. */
  requestPasswordReset: (email: string) => Result;
  changePassword: (password: string) => Result;
  /** Finishes a link from an e-mail (confirmation or password reset) that brought the person back to the site. */
  completeAuthLink: (hash: string) => Promise<{ kind: 'recovery' | 'signedIn' | 'error' | 'none'; message?: string }>;
  updatePhotos: (listingId: string, photos: string[]) => Result;
  signIn: (email: string, password: string) => Result;
  signOut: () => Result;
  setKind: (kind: SellerKind) => Result;
  addListing: (draft: ListingDraft) => Promise<{ id?: string; error?: string }>;
  updateListing: (listingId: string, draft: ListingDraft) => Result;
  addDonor: (name: string, vin: string, cost: number) => Promise<{ id?: string; error?: string }>;
  markSold: (listingId: string, price: number) => Result;
  /** Lowers the price and restarts the 90-day reminder. */
  reducePrice: (listingId: string, price: number) => Result;
  openThread: (listingId: string) => Promise<{ id?: string; error?: string }>;
  sendText: (threadId: string, text: string) => Result;
  sendOffer: (threadId: string, amount: number, text: string) => Result;
  answerOffer: (threadId: string, messageId: string, status: 'accepted' | 'declined') => Result;
  report: (listingId: string) => Result;
  /** Starts a payment; resolves to the address of the payment page. */
  buy: (listingId: string, delivery: 'shipping' | 'pickup') => Promise<{ url?: string; error?: string }>;
  /** Asks the server to check with the payment provider whether an order has been paid. */
  syncOrder: (orderId: string) => Result;
  orderStep: (orderId: string, step: OrderStep, text?: string) => Result;
  payoutStatus: () => Promise<PayoutStatus>;
  /** Resolves to the address where the seller sets up (or manages) payouts. */
  startPayouts: () => Promise<{ url?: string; error?: string }>;
  orderById: (id: string) => Order | undefined;
  deleteAccount: () => Result;
  refresh: () => Promise<void>;
  userById: (id: string) => User;
  listingById: (id: string) => Listing | undefined;
  threadById: (id: string) => Thread | undefined;
  threadForListing: (listingId: string) => Thread | undefined;
}

const live = supabase !== null;
const GUEST: User = { id: live ? '' : 'me', name: 'Svečias', kind: 'private', rating: 0, reviews: 0, since: 'šiandien' };
const UNKNOWN: User = { id: '', name: 'Naudotojas', kind: 'private', rating: 0, reviews: 0, since: '' };

function initialState(): State {
  return live
    ? { ready: false, me: GUEST, registered: false, users: [], listings: [], threads: [], donors: [], phone: '', blocked: [], favorites: [], orders: [], payReady: [] }
    : { ready: true, me: GUEST, registered: false, users: seedUsers, listings: seedListings, threads: [], donors: [], phone: '', blocked: [], favorites: [], orders: [], payReady: [] };
}

let counter = 0;
function newId(prefix: string): string {
  counter += 1;
  return `${prefix}${Date.now()}_${counter}`;
}

export const ALREADY_REGISTERED = 'Šis el. paštas jau užregistruotas. Prisijunkite su juo – naujo laiško nesiunčiame.';

const ERRORS: Record<string, string> = {
  amount_out_of_range: 'Pasiūlymas turi būti mažesnis už skelbimo kainą.',
  offers_not_allowed: 'Pardavėjas šiam skelbimui pasiūlymų nepriima.',
  listing_not_active: 'Skelbimas nebeaktyvus.',
  offer_not_pending: 'Į šį pasiūlymą jau atsakyta.',
  not_allowed: 'Į savo pasiūlymą atsakyti negalima.',
  not_authenticated: 'Pirmiausia prisijunkite.',
  user_blocked: 'Šiam naudotojui rašyti negalite: vienas iš jūsų užblokavo kitą.',
  'row-level security': 'Šis veiksmas neleidžiamas. Jei rašote kitam naudotojui, gali būti, kad vienas iš jūsų užblokavo kitą.',
  phone_required: 'Įrašykite telefono numerį, pvz., +37061234567.',
  'Invalid login credentials': 'Neteisingas el. paštas arba slaptažodis.',
  'User already registered': ALREADY_REGISTERED,
  'Email not confirmed': 'El. paštas dar nepatvirtintas. Atidarykite laišką ir paspauskite nuorodą.',
  'should be different': 'Naujas slaptažodis turi skirtis nuo senojo.',
  open_orders: 'Paskyros ištrinti negalima, kol turite nebaigtų užsakymų. Palaukite, kol jie bus užbaigti.',
  'rate limit': 'Per daug bandymų per trumpą laiką. Palaukite kelias minutes ir bandykite dar kartą.',
};

function explain(error: { message?: string } | null | undefined): string {
  const message = error?.message ?? '';
  const known = Object.keys(ERRORS).find((k) => message.includes(k));
  return known ? ERRORS[known] : `Nepavyko. ${message || 'Patikrinkite interneto ryšį ir bandykite dar kartą.'}`;
}

/* ---------- Row mappers (database -> app types) ---------- */

type Row = Record<string, any>;

function toUser(row: Row): User {
  const year = row.created_at ? new Date(row.created_at).getFullYear() : '';
  return { id: row.id, name: row.name, kind: row.kind === 'business' ? 'business' : 'private', rating: 0, reviews: 0, since: year ? `${year} m.` : '' };
}

function toListing(row: Row): Listing {
  return {
    id: row.id, title: row.title, price: Number(row.price), vat: !!row.vat, condition: row.condition,
    defects: row.defects ?? [], oem: row.oem ?? '', fits: row.fits ?? '', vehicleType: row.vehicle_type,
    city: row.city, country: row.country, shipping: row.shipping === null ? null : Number(row.shipping),
    pickup: !!row.pickup, sellerId: row.seller_id, photos: row.photos ?? [], allowOffers: !!row.allow_offers,
    createdAt: new Date(row.created_at).getTime(), classic: !!row.classic, description: row.description ?? '', wholeVehicle: !!row.whole_vehicle, refreshedAt: row.refreshed_at ? new Date(row.refreshed_at).getTime() : null, status: row.status === 'sold' ? 'sold' : 'active',
  };
}

function toDonor(row: Row): Donor {
  return { id: row.id, name: row.name, vin: row.vin ?? '', cost: Number(row.cost), createdAt: new Date(row.created_at).getTime() };
}

function toMessage(row: Row): Message {
  return {
    id: row.id, senderId: row.sender_id, kind: row.kind, text: row.body ?? undefined,
    amount: row.amount === null ? undefined : Number(row.amount), status: row.status ?? undefined,
    at: new Date(row.created_at).getTime(),
  };
}

function toThread(row: Row): Thread {
  const messages: Message[] = (row.messages ?? []).map(toMessage).sort((a: Message, b: Message) => a.at - b.at);
  return { id: row.id, listingId: row.listing_id, buyerId: row.buyer_id, sellerId: row.seller_id, messages };
}

function toOrder(row: Row): Order {
  const time = (value: string | null) => (value ? new Date(value).getTime() : null);
  return {
    id: row.id, listingId: row.listing_id ?? null, buyerId: row.buyer_id ?? '', sellerId: row.seller_id ?? '', title: row.title,
    itemAmount: row.item_amount / 100, shippingAmount: row.shipping_amount / 100, feeAmount: row.fee_amount / 100, total: row.total_amount / 100,
    delivery: row.delivery === 'pickup' ? 'pickup' : 'shipping', status: row.status, shipTo: row.ship_to ?? null,
    tracking: row.tracking ?? '', disputeReason: row.dispute_reason ?? '', createdAt: new Date(row.created_at).getTime(),
    paidAt: time(row.paid_at), shippedAt: time(row.shipped_at), receivedAt: time(row.received_at), releaseAt: time(row.release_at),
  };
}

const PAY_ERRORS: Record<string, string> = {
  not_authenticated: 'Pirmiausia prisijunkite.',
  not_configured: 'Mokėjimai per Partaza dar neįjungti.',
  connect_not_enabled: 'Išmokos pardavėjams dar neįjungtos. Bandykite vėliau.',
  listing_not_active: 'Skelbimas nebeaktyvus – gali būti, kad dalis ką tik parduota.',
  listing_reserved: 'Šią dalį šiuo metu apmoka kitas pirkėjas. Pabandykite po pusvalandžio.',
  own_listing: 'Savo skelbimo pirkti negalima.',
  no_shipping: 'Pardavėjas šios dalies nesiunčia – galimas tik atsiėmimas.',
  no_pickup: 'Šios dalies atsiimti negalima – tik pristatymas.',
  user_blocked: 'Pirkti negalite: vienas iš jūsų užblokavo kitą.',
  seller_not_ready: 'Pardavėjas dar nepriima mokėjimų per Partaza. Susitarkite žinutėmis.',
  amount_too_small: 'Suma per maža mokėjimui kortele.',
  wrong_status: 'Užsakymo būsena pasikeitė. Atnaujinkite puslapį.',
  not_allowed: 'Šis veiksmas jums neleidžiamas.',
  not_a_participant: 'Šio užsakymo neberandame.',
  reason_required: 'Aprašykite problemą bent keliais žodžiais.',
  too_early: 'Atšaukti galima, jei pardavėjas neišsiunčia per 7 dienas nuo apmokėjimo.',
  stripe_error: 'Mokėjimų sistema atsakė klaida. Bandykite dar kartą po minutės.',
};

/** Calls the server's payment function. Resolves to its answer, or to a message for the user. */
async function pay(body: Row): Promise<{ data?: Row; error?: string }> {
  if (!supabase) return { error: 'Bandomuoju režimu mokėjimų nėra.' };
  try {
    const { data, error } = await supabase.functions.invoke('payments', { body });
    if (error || !data) return { error: 'Nepavyko susisiekti su serveriu. Patikrinkite interneto ryšį ir bandykite dar kartą.' };
    if (data.error) return { error: PAY_ERRORS[data.error] ?? PAY_ERRORS.stripe_error, data };
    return { data };
  } catch {
    return { error: 'Nepavyko susisiekti su serveriu. Patikrinkite interneto ryšį ir bandykite dar kartą.' };
  }
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(initialState);
  // Actions read the latest state through this ref so they never work on a stale copy.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  // When each thread was last opened on this device.
  const [lastRead, setLastRead] = useState<Record<string, number>>({});
  useEffect(() => {
    AsyncStorage.getItem('partaza.lastRead')
      .then((raw) => {
        if (raw) setLastRead(JSON.parse(raw));
      })
      .catch(() => {});
  }, []);
  const markRead = useCallback((threadId: string) => {
    setLastRead((current) => {
      const thread = stateRef.current.threads.find((t) => t.id === threadId);
      const latest = thread && thread.messages.length > 0 ? thread.messages[thread.messages.length - 1].at : 0;
      if (!latest || (current[threadId] ?? 0) >= latest) return current;
      const next = { ...current, [threadId]: latest };
      AsyncStorage.setItem('partaza.lastRead', JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const [myCar, setMyCarState] = useState<MyCar | null>(null);
  useEffect(() => {
    AsyncStorage.getItem('partaza.myCar')
      .then((raw) => {
        if (raw) setMyCarState(JSON.parse(raw));
      })
      .catch(() => {});
  }, []);
  const setMyCar = useCallback((car: MyCar | null) => {
    setMyCarState(car);
    (car ? AsyncStorage.setItem('partaza.myCar', JSON.stringify(car)) : AsyncStorage.removeItem('partaza.myCar')).catch(() => {});
  }, []);

  /* ---------- Live mode: loading ---------- */

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id ?? null;
    const phone = String(sessionData.session?.user.user_metadata?.phone ?? '');

    const [listingsRes, threadsRes] = await Promise.all([
      supabase.from('listings').select('*').order('created_at', { ascending: false }).limit(300),
      uid ? supabase.from('threads').select('*, messages(*)').order('created_at', { ascending: false }) : Promise.resolve({ data: [] as Row[] }),
    ]);
    const listings = (listingsRes.data ?? []).map(toListing);
    // Private seller data (purchase costs, donors, sale prices): the server returns only the user's own rows.
    let donors: Donor[] = [];
    let blocked: string[] = [];
    let favorites: string[] = [];
    if (uid) {
      const favoritesRes = await supabase.from('favorites').select('listing_id');
      favorites = (favoritesRes.data ?? []).map((f: Row) => f.listing_id);
      const blocksRes = await supabase.from('blocks').select('blocked_id');
      blocked = (blocksRes.data ?? []).map((b: Row) => b.blocked_id);
      const [donorsRes, financeRes] = await Promise.all([
        supabase.from('donors').select('*').order('created_at', { ascending: false }),
        supabase.from('listing_finance').select('*'),
      ]);
      donors = (donorsRes.data ?? []).map(toDonor);
      const finance = new Map<string, Row>((financeRes.data ?? []).map((f: Row) => [f.listing_id, f]));
      listings.forEach((l) => {
        const f = finance.get(l.id);
        if (!f) return;
        l.donorId = f.donor_id ?? null;
        l.cost = f.cost === null ? null : Number(f.cost);
        l.soldPrice = f.sold_price === null ? null : Number(f.sold_price);
      });
    }
    const threads = ((threadsRes as { data: Row[] | null }).data ?? []).map(toThread);
    // Payments: who can be paid through the platform (public), and my own orders.
    const [readyRes, ordersRes] = await Promise.all([
      supabase.from('seller_accounts').select('seller_id').eq('payouts_ready', true),
      uid ? supabase.from('orders').select('*').neq('status', 'cancelled').order('created_at', { ascending: false }) : Promise.resolve({ data: [] as Row[] }),
    ]);
    const payReady = (readyRes.data ?? []).map((r: Row) => r.seller_id as string);
    const orders = ((ordersRes as { data: Row[] | null }).data ?? []).map(toOrder);

    const ids = new Set<string>();
    listings.forEach((l) => ids.add(l.sellerId));
    blocked.forEach((id) => ids.add(id));
    threads.forEach((t) => {
      ids.add(t.buyerId);
      ids.add(t.sellerId);
    });
    orders.forEach((o) => {
      if (o.buyerId) ids.add(o.buyerId);
      if (o.sellerId) ids.add(o.sellerId);
    });
    if (uid) ids.add(uid);
    const profilesRes = ids.size > 0 ? await supabase.from('profiles').select('*').in('id', [...ids]) : { data: [] as Row[] };
    const users = (profilesRes.data ?? []).map(toUser);
    const me = uid ? users.find((u) => u.id === uid) ?? { ...GUEST, id: uid } : GUEST;

    setState({ ready: true, me, registered: !!uid, users, listings, threads, donors, phone: uid ? phone : '', blocked, favorites, orders, payReady });
  }, []);

  useEffect(() => {
    if (!supabase) return;
    // Fires once at start (INITIAL_SESSION) and again on every sign-in, sign-out and token refresh.
    const { data: auth } = supabase.auth.onAuthStateChange(() => {
      // Deferred: Supabase advises against calling its API directly inside this callback.
      setTimeout(refresh, 0);
    });
    return () => auth.subscription.unsubscribe();
  }, [refresh]);

  // New messages and offer answers arrive in real time; the rules on the server decide
  // which rows this user is allowed to receive.
  useEffect(() => {
    if (!supabase || !state.registered) return;
    const client = supabase;
    const channel = client
      .channel('messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        refresh();
      })
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [state.registered, refresh]);

  /* ---------- Demo mode helpers ---------- */

  const updateThread = (threadId: string, update: (messages: Message[]) => Message[]) =>
    setState((s) => ({ ...s, threads: s.threads.map((t) => (t.id === threadId ? { ...t, messages: update(t.messages) } : t)) }));

  /* ---------- Actions ---------- */

  const actions = useMemo(() => {
    const registerDemo: Store['registerDemo'] = (name, kind, phone) =>
      setState((s) => ({ ...s, registered: true, phone, me: { ...s.me, name, kind } }));

    const requestPasswordReset: Store['requestPasswordReset'] = async (email) => {
      if (!supabase) return 'Bandomuoju režimu slaptažodžių nėra.';
      const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email, origin ? { redirectTo: `${origin}/reset` } : undefined);
      return error ? explain(error) : null;
    };

    const changePassword: Store['changePassword'] = async (password) => {
      if (!supabase) return null;
      const { error } = await supabase.auth.updateUser({ password });
      return error ? explain(error) : null;
    };

    const completeAuthLink: Store['completeAuthLink'] = async (hash) => {
      if (!supabase) return { kind: 'none' };
      const params = new URLSearchParams(hash.replace(/^#/, ''));
      if (params.get('error') || params.get('error_code')) {
        return { kind: 'error', message: 'Nuoroda nebegalioja arba jau panaudota. Jei el. paštą jau patvirtinote, tiesiog prisijunkite.' };
      }
      const access = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (!access || !refreshToken) return { kind: 'none' };
      const { error } = await supabase.auth.setSession({ access_token: access, refresh_token: refreshToken });
      if (error) return { kind: 'error', message: explain(error) };
      await refresh();
      return { kind: params.get('type') === 'recovery' ? 'recovery' : 'signedIn' };
    };

    const toggleFavorite: Store['toggleFavorite'] = async (listingId) => {
      const { me, favorites } = stateRef.current;
      const saved = favorites.includes(listingId);
      if (supabase) {
        const { error } = saved
          ? await supabase.from('favorites').delete().eq('user_id', me.id).eq('listing_id', listingId)
          : await supabase.from('favorites').upsert({ user_id: me.id, listing_id: listingId }, { onConflict: 'user_id,listing_id', ignoreDuplicates: true });
        if (error) return explain(error);
      }
      setState((s) => ({ ...s, favorites: saved ? s.favorites.filter((id) => id !== listingId) : [...s.favorites, listingId] }));
      return null;
    };

    const blockUser: Store['blockUser'] = async (userId) => {
      const { me } = stateRef.current;
      if (supabase) {
        const { error } = await supabase.from('blocks').upsert({ blocker_id: me.id, blocked_id: userId }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true });
        if (error) return explain(error);
      }
      setState((s) => (s.blocked.includes(userId) ? s : { ...s, blocked: [...s.blocked, userId] }));
      return null;
    };

    const unblockUser: Store['unblockUser'] = async (userId) => {
      const { me } = stateRef.current;
      if (supabase) {
        const { error } = await supabase.from('blocks').delete().eq('blocker_id', me.id).eq('blocked_id', userId);
        if (error) return explain(error);
      }
      setState((s) => ({ ...s, blocked: s.blocked.filter((id) => id !== userId) }));
      return null;
    };

    const setPhone: Store['setPhone'] = async (phone) => {
      if (supabase) {
        const { error } = await supabase.auth.updateUser({ data: { phone } });
        if (error) return explain(error);
      }
      setState((s) => ({ ...s, phone }));
      return null;
    };

    // Uploads photos that are still on the device and returns public links for all of them.
    const uploadPhotos = async (photos: string[], ownerId: string): Promise<{ urls?: string[]; error?: string }> => {
      if (!supabase) return { urls: photos };
      const urls: string[] = [];
      for (let i = 0; i < photos.length; i += 1) {
        const uri = photos[i];
        if (/^https?:\/\//.test(uri)) {
          urls.push(uri);
          continue;
        }
        try {
          const response = await fetch(uri);
          const bytes = await response.arrayBuffer();
          const type = response.headers.get('content-type') || 'image/jpeg';
          const extension = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
          const path = `${ownerId}/${Date.now()}_${i}.${extension}`;
          const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: type });
          if (error) return { error: explain(error) };
          urls.push(supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl);
        } catch {
          return { error: 'Nepavyko įkelti nuotraukos. Patikrinkite interneto ryšį ir bandykite dar kartą.' };
        }
      }
      return { urls };
    };

    const updatePhotos: Store['updatePhotos'] = async (listingId, photos) => {
      const { me } = stateRef.current;
      const uploaded = await uploadPhotos(photos, me.id);
      if (!uploaded.urls) return uploaded.error ?? 'Nepavyko įkelti nuotraukų.';
      const urls = uploaded.urls;
      if (supabase) {
        const { error } = await supabase.from('listings').update({ photos: urls }).eq('id', listingId);
        if (error) return explain(error);
      }
      setState((s) => ({ ...s, listings: s.listings.map((l) => (l.id === listingId ? { ...l, photos: urls } : l)) }));
      return null;
    };

    const signUp: Store['signUp'] = async (email, password, name, kind, phone) => {
      if (!supabase) return null;
      // After confirming the e-mail the person lands back on this site (web) instead of a default address.
      const emailRedirectTo = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : undefined;
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name, kind, phone }, emailRedirectTo } });
      if (error) return explain(error);
      // For an address that is already registered the server answers "success" without sending
      // anything (so strangers cannot probe addresses); the tell-tale is an empty identities list.
      if (!data.session && data.user && (data.user.identities ?? []).length === 0) return ALREADY_REGISTERED;
      if (!data.session) return `Išsiuntėme laišką adresu ${email}. Per 15 minučių paspauskite jame nuorodą ir tada prisijunkite – nepatvirtinta paskyra po 15 minučių ištrinama. Jei adresas su klaida, registruokitės iš naujo teisingu adresu.`;
      await refresh();
      return null;
    };

    const signIn: Store['signIn'] = async (email, password) => {
      if (!supabase) return null;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return explain(error);
      await refresh();
      return null;
    };

    const signOut: Store['signOut'] = async () => {
      if (!supabase) {
        setState(initialState());
        return null;
      }
      const { error } = await supabase.auth.signOut();
      if (error) return explain(error);
      await refresh();
      return null;
    };

    const setKind: Store['setKind'] = async (kind) => {
      const { me } = stateRef.current;
      if (supabase) {
        const { error } = await supabase.from('profiles').update({ kind }).eq('id', me.id);
        if (error) return explain(error);
      }
      setState((s) => ({ ...s, me: { ...s.me, kind }, users: s.users.map((u) => (u.id === s.me.id ? { ...u, kind } : u)) }));
      return null;
    };

    const addListing: Store['addListing'] = async (draft) => {
      const { me } = stateRef.current;
      if (!supabase) {
        const id = newId('l');
        setState((s) => ({ ...s, listings: [{ ...draft, id, sellerId: me.id, createdAt: Date.now(), status: 'active' }, ...s.listings] }));
        return { id };
      }
      // Photos first: each file goes into the seller's own folder, the listing stores public links.
      const uploaded = await uploadPhotos(draft.photos, me.id);
      if (!uploaded.urls) return { error: uploaded.error ?? 'Nepavyko įkelti nuotraukų.' };
      const urls = uploaded.urls;
      const { data, error } = await supabase
        .from('listings')
        .insert({
          seller_id: me.id, title: draft.title, price: draft.price, vat: draft.vat, condition: draft.condition,
          defects: draft.defects, oem: draft.oem, fits: draft.fits, vehicle_type: draft.vehicleType, city: draft.city,
          country: draft.country, shipping: draft.shipping, pickup: draft.pickup, photos: urls, allow_offers: draft.allowOffers,
          classic: !!draft.classic, whole_vehicle: !!draft.wholeVehicle, description: draft.description ?? '',
        })
        .select()
        .single();
      if (error || !data) return { error: explain(error) };
      const listing = toListing(data);
      listing.donorId = draft.donorId ?? null;
      listing.cost = draft.cost ?? null;
      if (listing.donorId || listing.cost !== null) {
        const finance = await supabase.from('listing_finance').insert({ listing_id: listing.id, seller_id: me.id, donor_id: listing.donorId, cost: listing.cost });
        if (finance.error) {
          listing.donorId = null;
          listing.cost = null;
        }
      }
      setState((s) => ({ ...s, listings: [listing, ...s.listings] }));
      return { id: listing.id };
    };

    const updateListing: Store['updateListing'] = async (listingId, draft) => {
      const { me } = stateRef.current;
      const uploaded = await uploadPhotos(draft.photos, me.id);
      if (!uploaded.urls) return uploaded.error ?? 'Nepavyko įkelti nuotraukų.';
      const urls = uploaded.urls;
      if (supabase) {
        const { error } = await supabase
          .from('listings')
          .update({
            title: draft.title, price: draft.price, vat: draft.vat, condition: draft.condition, defects: draft.defects,
            oem: draft.oem, fits: draft.fits, vehicle_type: draft.vehicleType, city: draft.city, shipping: draft.shipping,
            pickup: draft.pickup, photos: urls, allow_offers: draft.allowOffers, classic: !!draft.classic, whole_vehicle: !!draft.wholeVehicle,
            description: draft.description ?? '',
          })
          .eq('id', listingId);
        if (error) return explain(error);
        // Private figures; the sale price, if any, is left untouched.
        await supabase
          .from('listing_finance')
          .upsert({ listing_id: listingId, seller_id: me.id, donor_id: draft.donorId ?? null, cost: draft.cost ?? null }, { onConflict: 'listing_id' });
      }
      setState((s) => ({
        ...s,
        listings: s.listings.map((l) => (l.id === listingId ? { ...l, ...draft, photos: urls, donorId: draft.donorId ?? null, cost: draft.cost ?? null } : l)),
      }));
      return null;
    };

    const addDonor: Store['addDonor'] = async (name, vin, cost) => {
      const { me } = stateRef.current;
      if (!supabase) {
        const donor: Donor = { id: newId('d'), name, vin, cost, createdAt: Date.now() };
        setState((s) => ({ ...s, donors: [donor, ...s.donors] }));
        return { id: donor.id };
      }
      const { data, error } = await supabase.from('donors').insert({ owner_id: me.id, name, vin, cost }).select().single();
      if (error || !data) return { error: explain(error) };
      const donor = toDonor(data);
      setState((s) => ({ ...s, donors: [donor, ...s.donors] }));
      return { id: donor.id };
    };

    const reducePrice: Store['reducePrice'] = async (listingId, price) => {
      const when = new Date();
      if (supabase) {
        const { error } = await supabase.from('listings').update({ price, refreshed_at: when.toISOString() }).eq('id', listingId);
        if (error) return explain(error);
      }
      setState((s) => ({ ...s, listings: s.listings.map((l) => (l.id === listingId ? { ...l, price, refreshedAt: when.getTime() } : l)) }));
      return null;
    };

    const markSold: Store['markSold'] = async (listingId, price) => {
      const { me } = stateRef.current;
      if (supabase) {
        const finance = await supabase.from('listing_finance').upsert({ listing_id: listingId, seller_id: me.id, sold_price: price, sold_at: new Date().toISOString() }, { onConflict: 'listing_id' });
        if (finance.error) return explain(finance.error);
        const { error } = await supabase.from('listings').update({ status: 'sold' }).eq('id', listingId);
        if (error) return explain(error);
      }
      setState((s) => ({ ...s, listings: s.listings.map((l) => (l.id === listingId ? { ...l, status: 'sold' as const, soldPrice: price } : l)) }));
      return null;
    };

    const openThread: Store['openThread'] = async (listingId) => {
      const { me, threads, listings } = stateRef.current;
      const existing = threads.find((t) => t.listingId === listingId && t.buyerId === me.id);
      if (existing) return { id: existing.id };
      const listing = listings.find((l) => l.id === listingId);
      if (!listing) return { error: 'Šio skelbimo neberandame.' };
      if (!supabase) {
        const thread: Thread = { id: newId('t'), listingId, buyerId: me.id, sellerId: listing.sellerId, messages: [] };
        setState((s) => ({ ...s, threads: [thread, ...s.threads] }));
        return { id: thread.id };
      }
      const { data, error } = await supabase
        .from('threads')
        .upsert({ listing_id: listingId, buyer_id: me.id, seller_id: listing.sellerId }, { onConflict: 'listing_id,buyer_id', ignoreDuplicates: true })
        .select();
      let row: Row | undefined = data?.[0];
      if (!row && !error) {
        // The thread already existed (e.g. started on another device).
        const found = await supabase.from('threads').select('*').eq('listing_id', listingId).eq('buyer_id', me.id).maybeSingle();
        row = found.data ?? undefined;
      }
      if (!row) return { error: explain(error) };
      const thread = toThread(row);
      setState((s) => (s.threads.some((t) => t.id === thread.id) ? s : { ...s, threads: [thread, ...s.threads] }));
      return { id: thread.id };
    };

    // Asks the server to e-mail the other person "you have a new message". Best effort: the
    // server decides whether to send (throttled, respects blocks, off until mail is configured).
    const notify = (threadId: string) => {
      if (!supabase) return;
      supabase.functions.invoke('notify-message', { body: { thread_id: threadId } }).catch(() => {});
    };

    const sendText: Store['sendText'] = async (threadId, text) => {
      const { me } = stateRef.current;
      if (!supabase) {
        updateThread(threadId, (m) => [...m, { id: newId('m'), senderId: me.id, kind: 'text', text, at: Date.now() }]);
        return null;
      }
      const { error } = await supabase.from('messages').insert({ thread_id: threadId, sender_id: me.id, kind: 'text', body: text });
      if (error) return explain(error);
      notify(threadId);
      await refresh();
      return null;
    };

    const sendOffer: Store['sendOffer'] = async (threadId, amount, text) => {
      const { me, threads, listings } = stateRef.current;
      if (supabase) {
        const { error } = await supabase.rpc('send_offer', { p_thread: threadId, p_amount: amount, p_body: text || null });
        if (error) return explain(error);
        notify(threadId);
        await refresh();
        return null;
      }
      const thread = threads.find((t) => t.id === threadId);
      const listing = thread ? listings.find((l) => l.id === thread.listingId) : undefined;
      if (!thread || !listing) return 'Šio pokalbio neberandame.';
      // DEMO: there is no real seller on the other side, so the "seller" answers at once
      // with a counter-offer halfway between the offer and the asking price.
      const counterAmount = Math.round((amount + listing.price) / 2);
      const sellerAnswers = counterAmount < listing.price && counterAmount > amount;
      updateThread(threadId, (m) => {
        const next: Message[] = [
          ...m.map((x) => (x.kind === 'offer' && x.status === 'pending' ? { ...x, status: 'countered' as const } : x)),
          { id: newId('m'), senderId: me.id, kind: 'offer', amount, text: text || undefined, status: sellerAnswers ? 'countered' : 'pending', at: Date.now() },
        ];
        if (sellerAnswers) {
          next.push({ id: newId('m'), senderId: thread.sellerId, kind: 'offer', amount: counterAmount, text: 'Demonstracinis pardavėjo atsakymas', status: 'pending', at: Date.now() + 1 });
        }
        return next;
      });
      return null;
    };

    const answerOffer: Store['answerOffer'] = async (threadId, messageId, status) => {
      if (supabase) {
        const { error } = await supabase.rpc('answer_offer', { p_message: messageId, p_status: status });
        if (error) return explain(error);
        notify(threadId);
        await refresh();
        return null;
      }
      updateThread(threadId, (m) => m.map((x) => (x.id === messageId ? { ...x, status } : x)));
      return null;
    };

    const report: Store['report'] = async (listingId) => {
      if (!supabase) return null;
      const { me } = stateRef.current;
      const { error } = await supabase.from('reports').upsert({ listing_id: listingId, reporter_id: me.id }, { onConflict: 'listing_id,reporter_id', ignoreDuplicates: true });
      return error ? explain(error) : null;
    };

    const buy: Store['buy'] = async (listingId, delivery) => {
      const answer = await pay({ action: 'checkout', listing_id: listingId, delivery });
      if (answer.error) return { error: answer.error };
      return answer.data?.url ? { url: String(answer.data.url) } : { error: PAY_ERRORS.stripe_error };
    };

    const syncOrder: Store['syncOrder'] = async (orderId) => {
      const answer = await pay({ action: 'sync_order', order_id: orderId });
      await refresh();
      return answer.error ?? null;
    };

    const orderStep: Store['orderStep'] = async (orderId, step, text) => {
      const answer = await pay({ action: 'order_action', order_id: orderId, do: step, tracking: text, reason: text });
      await refresh();
      return answer.error ?? null;
    };

    const payoutStatus: Store['payoutStatus'] = async () => {
      const answer = await pay({ action: 'connect_status' });
      if (answer.data?.configured === false) return { configured: false, exists: false, ready: false };
      if (answer.error) return { configured: true, exists: false, ready: false, error: answer.error };
      await refresh();
      return { configured: true, exists: !!answer.data?.exists, ready: !!answer.data?.ready };
    };

    const startPayouts: Store['startPayouts'] = async () => {
      const answer = await pay({ action: 'connect_start' });
      if (answer.error) return { error: answer.error };
      return answer.data?.url ? { url: String(answer.data.url) } : { error: PAY_ERRORS.stripe_error };
    };

    const deleteAccount: Store['deleteAccount'] = async () => {
      if (!supabase) {
        setState(initialState());
        return null;
      }
      const { me } = stateRef.current;
      // Remove the user's photos first; the database rows go with the account.
      const files = await supabase.storage.from(PHOTO_BUCKET).list(me.id, { limit: 1000 });
      if (files.data && files.data.length > 0) {
        await supabase.storage.from(PHOTO_BUCKET).remove(files.data.map((f) => `${me.id}/${f.name}`));
      }
      const { error } = await supabase.rpc('delete_my_account');
      if (error) return explain(error);
      await supabase.auth.signOut();
      await refresh();
      return null;
    };

    return { registerDemo, toggleFavorite, blockUser, unblockUser, setPhone, requestPasswordReset, changePassword, completeAuthLink, updatePhotos, signUp, signIn, signOut, setKind, addListing, updateListing, addDonor, markSold, reducePrice, openThread, sendText, sendOffer, answerOffer, report, buy, syncOrder, orderStep, payoutStatus, startPayouts, deleteAccount };
  }, [refresh]);

  const unreadThreadIds = useMemo(
    () =>
      state.threads
        .filter((t) => !state.blocked.includes(t.buyerId) && !state.blocked.includes(t.sellerId))
        .filter((t) => {
          const last = t.messages[t.messages.length - 1];
          return !!last && last.senderId !== state.me.id && last.at > (lastRead[t.id] ?? 0);
        })
        .map((t) => t.id),
    [state.threads, state.blocked, state.me.id, lastRead],
  );

  const value = useMemo<Store>(
    () => ({
      ...state,
      // People I blocked disappear from what I see: their listings and our chats.
      listings: state.blocked.length ? state.listings.filter((l) => !state.blocked.includes(l.sellerId)) : state.listings,
      threads: state.blocked.length ? state.threads.filter((t) => !state.blocked.includes(t.buyerId) && !state.blocked.includes(t.sellerId)) : state.threads,
      ...actions,
      live,
      unreadThreadIds,
      markRead,
      myCar,
      setMyCar,
      refresh,
      userById: (id) => (id === state.me.id ? state.me : state.users.find((u) => u.id === id) ?? UNKNOWN),
      listingById: (id) => state.listings.find((l) => l.id === id),
      threadById: (id) => state.threads.find((t) => t.id === id),
      orderById: (id) => state.orders.find((o) => o.id === id),
      threadForListing: (listingId) => state.threads.find((t) => t.listingId === listingId && t.buyerId === state.me.id),
    }),
    [state, actions, refresh, myCar, setMyCar, unreadThreadIds, markRead],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}
