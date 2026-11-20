import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { PHOTO_BUCKET, supabase } from '@/backend/client';
import { seedListings, seedUsers } from '@/data/seed';
import type { Donor, Listing, ListingDraft, Message, MyCar, SellerKind, Thread, User } from '@/types';

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
  /** The signed-in person's own phone number; '' when not given yet. Never shown to others. */
  phone: string;
}

type Result = Promise<string | null>;

interface Store extends State {
  live: boolean;
  /** Saved on this device only; never sent to the server. */
  myCar: MyCar | null;
  setMyCar: (car: MyCar | null) => void;
  registerDemo: (name: string, kind: SellerKind, phone: string) => void;
  signUp: (email: string, password: string, name: string, kind: SellerKind, phone: string) => Result;
  setPhone: (phone: string) => Result;
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
  openThread: (listingId: string) => Promise<{ id?: string; error?: string }>;
  sendText: (threadId: string, text: string) => Result;
  sendOffer: (threadId: string, amount: number, text: string) => Result;
  answerOffer: (threadId: string, messageId: string, status: 'accepted' | 'declined') => Result;
  report: (listingId: string) => Result;
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
    ? { ready: false, me: GUEST, registered: false, users: [], listings: [], threads: [], donors: [], phone: '' }
    : { ready: true, me: GUEST, registered: false, users: seedUsers, listings: seedListings, threads: [], donors: [], phone: '' };
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
  phone_required: 'Įrašykite telefono numerį, pvz., +37061234567.',
  'Invalid login credentials': 'Neteisingas el. paštas arba slaptažodis.',
  'User already registered': ALREADY_REGISTERED,
  'Email not confirmed': 'El. paštas dar nepatvirtintas. Atidarykite laišką ir paspauskite nuorodą.',
  'should be different': 'Naujas slaptažodis turi skirtis nuo senojo.',
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
    createdAt: new Date(row.created_at).getTime(), classic: !!row.classic, wholeVehicle: !!row.whole_vehicle, status: row.status === 'sold' ? 'sold' : 'active',
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

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(initialState);
  // Actions read the latest state through this ref so they never work on a stale copy.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

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
    if (uid) {
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

    const ids = new Set<string>();
    listings.forEach((l) => ids.add(l.sellerId));
    threads.forEach((t) => {
      ids.add(t.buyerId);
      ids.add(t.sellerId);
    });
    if (uid) ids.add(uid);
    const profilesRes = ids.size > 0 ? await supabase.from('profiles').select('*').in('id', [...ids]) : { data: [] as Row[] };
    const users = (profilesRes.data ?? []).map(toUser);
    const me = uid ? users.find((u) => u.id === uid) ?? { ...GUEST, id: uid } : GUEST;

    setState({ ready: true, me, registered: !!uid, users, listings, threads, donors, phone: uid ? phone : '' });
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
          classic: !!draft.classic, whole_vehicle: !!draft.wholeVehicle,
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

    const sendText: Store['sendText'] = async (threadId, text) => {
      const { me } = stateRef.current;
      if (!supabase) {
        updateThread(threadId, (m) => [...m, { id: newId('m'), senderId: me.id, kind: 'text', text, at: Date.now() }]);
        return null;
      }
      const { error } = await supabase.from('messages').insert({ thread_id: threadId, sender_id: me.id, kind: 'text', body: text });
      if (error) return explain(error);
      await refresh();
      return null;
    };

    const sendOffer: Store['sendOffer'] = async (threadId, amount, text) => {
      const { me, threads, listings } = stateRef.current;
      if (supabase) {
        const { error } = await supabase.rpc('send_offer', { p_thread: threadId, p_amount: amount, p_body: text || null });
        if (error) return explain(error);
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

    return { registerDemo, setPhone, requestPasswordReset, changePassword, completeAuthLink, updatePhotos, signUp, signIn, signOut, setKind, addListing, updateListing, addDonor, markSold, openThread, sendText, sendOffer, answerOffer, report, deleteAccount };
  }, [refresh]);

  const value = useMemo<Store>(
    () => ({
      ...state,
      ...actions,
      live,
      myCar,
      setMyCar,
      refresh,
      userById: (id) => (id === state.me.id ? state.me : state.users.find((u) => u.id === id) ?? UNKNOWN),
      listingById: (id) => state.listings.find((l) => l.id === id),
      threadById: (id) => state.threads.find((t) => t.id === id),
      threadForListing: (listingId) => state.threads.find((t) => t.listingId === listingId && t.buyerId === state.me.id),
    }),
    [state, actions, refresh, myCar, setMyCar],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}
