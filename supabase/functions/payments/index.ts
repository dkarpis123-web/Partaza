// Payments through Stripe Connect ("separate charges and transfers").
//
// Money flow: the buyer pays on Stripe's hosted checkout page; the money stays on the
// platform's Stripe balance; it is transferred to the seller's connected Stripe account when the
// buyer confirms the part is fine or the check window runs out. Partaza itself never holds money
// and never sees card or bank details.
//
// One function, three kinds of callers:
// - the app, as a signed-in user:   { action: 'connect_start' | 'connect_status' | 'checkout' | 'sync_order' | 'order_action', ... }
//   (checkout: listing_id, extra_ids = up to 9 more listings of the same seller sent in the same parcel, delivery, country, lang)
//   (order_action: do = ship | received | confirm | dispute | dispute_withdraw | dispute_refund | cancel)
// - Stripe, as a signed webhook:    header "Stripe-Signature" (needs STRIPE_WEBHOOK_SECRET)
// - the database timer, no rights:  { action: 'release_due' } – takes no input, only releases what is already due
//
// Deploy with JWT verification OFF (Stripe cannot send a Supabase token); every user action
// checks the caller's session itself.
//
// Edge Function secrets:
//   STRIPE_SECRET_KEY         required; sk_test_... while testing
//   STRIPE_WEBHOOK_SECRET     required for webhooks; whsec_...
//   SITE_URL                  optional, default https://partaza.eu
//   PARTAZA_FEE_PERCENT       optional, buyer fee in percent of item + delivery, default 4.5
//   PARTAZA_FEE_FIXED_CENTS   optional, fixed buyer fee in cents, default 45
//   PARTAZA_ADMIN_FEE_CENTS   optional, the platform's administration fee per order in cents, default 100
//
// The default buyer fee is sized so that payments cost the platform nothing even in the most
// expensive case: Stripe's card fee (1.5 % + 0.25 EUR for standard EU cards, up to
// 3.25 % + 0.25 EUR for cards from outside Europe), the Connect payout fee (0.25 % + 0.10 EUR)
// and 21 % VAT on the fee itself. The same numbers are in src/theme.ts (buyerFee) for display.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

// deno-lint-ignore no-explicit-any
type Json = Record<string, any>;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Days the buyer has to check the part after marking it received. */
const CHECK_DAYS = 5;
/** If the buyer never marks it received: days after dispatch until the money is released. */
const SILENT_DAYS = 14;
/** If the seller never dispatches: days after payment until the buyer may cancel and be refunded. */
const DISPATCH_DAYS = 7;
const DISPUTE_KINDS = ['not_received', 'not_as_described', 'damaged', 'no_fit', 'other'];
/** Words on Stripe's payment page in the buyer's language (Stripe shows its own page in the same language). */
const WORDS: Record<string, { delivery: string; oneParcel: string; protection: string; admin: string }> = {
  lt: { delivery: 'Pristatymas', oneParcel: 'Pristatymas (viena siunta)', protection: 'Pirkėjo apsauga', admin: 'Administravimo mokestis' },
  en: { delivery: 'Delivery', oneParcel: 'Delivery (one parcel)', protection: 'Buyer protection', admin: 'Administration fee' },
  lv: { delivery: 'Piegāde', oneParcel: 'Piegāde (viens sūtījums)', protection: 'Pircēja aizsardzība', admin: 'Administrēšanas maksa' },
  et: { delivery: 'Tarne', oneParcel: 'Tarne (üks pakk)', protection: 'Ostjakaitse', admin: 'Haldustasu' },
  pl: { delivery: 'Dostawa', oneParcel: 'Dostawa (jedna przesyłka)', protection: 'Ochrona kupującego', admin: 'Opłata administracyjna' },
  ru: { delivery: 'Доставка', oneParcel: 'Доставка (одна посылка)', protection: 'Защита покупателя', admin: 'Административный сбор' },
  de: { delivery: 'Lieferung', oneParcel: 'Lieferung (ein Paket)', protection: 'Käuferschutz', admin: 'Bearbeitungsgebühr' },
};
const EU = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];

const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const SITE = (Deno.env.get('SITE_URL') ?? 'https://partaza.eu').replace(/\/$/, '');
const FEE_PERCENT = Math.max(0, Number(Deno.env.get('PARTAZA_FEE_PERCENT') ?? '4.5') || 0);
const FEE_FIXED = Math.max(0, Math.round(Number(Deno.env.get('PARTAZA_FEE_FIXED_CENTS') ?? '45') || 0));
const ADMIN_FEE = Math.max(0, Math.round(Number(Deno.env.get('PARTAZA_ADMIN_FEE_CENTS') ?? '100') || 0));

function key(dictionaryName: string, legacyName: string): string {
  try {
    const dictionary = JSON.parse(Deno.env.get(dictionaryName) ?? '{}');
    if (dictionary.default) return dictionary.default;
  } catch (_) {
    // fall through to the legacy key
  }
  return Deno.env.get(legacyName) ?? '';
}

function reply(body: Json, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

/* ---------- Stripe REST API (form-encoded, no SDK) ---------- */

class StripeError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

function encode(value: unknown, prefix: string, out: URLSearchParams) {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) value.forEach((v, i) => encode(v, `${prefix}[${i}]`, out));
  else if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Json)) encode(v, prefix ? `${prefix}[${k}]` : k, out);
  } else out.append(prefix, String(value));
}

async function stripe(method: 'GET' | 'POST', path: string, params?: Json, idempotencyKey?: string): Promise<Json> {
  const body = new URLSearchParams();
  if (params) encode(params, '', body);
  const query = method === 'GET' && [...body.keys()].length > 0 ? `?${body}` : '';
  const response = await fetch(`https://api.stripe.com/v1/${path}${query}`, {
    method,
    headers: {
      Authorization: `Bearer ${STRIPE_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: method === 'GET' ? undefined : body,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new StripeError(json?.error?.message ?? `stripe_${response.status}`, json?.error?.code ?? json?.error?.type ?? 'stripe_error');
  return json;
}

/** Accounts v2 API: JSON bodies and a dated version header. Stripe requires it for new connected accounts. */
const V2_VERSION = '2026-11-18.endive';
async function stripeV2(method: 'GET' | 'POST', path: string, body?: Json, idempotencyKey?: string): Promise<Json> {
  let query = '';
  if (method === 'GET' && body) {
    const params = new URLSearchParams();
    encode(body, '', params);
    query = `?${params}`;
  }
  const response = await fetch(`https://api.stripe.com/v2/${path}${query}`, {
    method,
    headers: {
      Authorization: `Bearer ${STRIPE_KEY}`,
      'Stripe-Version': V2_VERSION,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new StripeError(json?.error?.message ?? `stripe_${response.status}`, json?.error?.code ?? json?.error?.type ?? 'stripe_error');
  return json;
}

/** Can this connected account receive transfers? Read from the v2 recipient configuration. */
function recipientState(account: Json): { ready: boolean; submitted: boolean } {
  const balance = account.configuration?.recipient?.capabilities?.stripe_balance ?? {};
  const transfers = balance.stripe_transfers?.status;
  const payouts = balance.payouts?.status;
  const ready = transfers === 'active' && (payouts === undefined || payouts === 'active');
  return { ready, submitted: ready || transfers === 'pending' };
}

async function validSignature(payload: string, header: string): Promise<boolean> {
  const pairs = header.split(',').map((p) => p.trim().split('='));
  const timestamp = pairs.find(([k]) => k === 't')?.[1] ?? '';
  const signatures = pairs.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(`${timestamp}.${payload}`)));
  const expected = [...mac].map((b) => b.toString(16).padStart(2, '0')).join('');
  return signatures.some((candidate) => {
    if (candidate.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i += 1) diff |= candidate.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  });
}

/* ---------- Orders ---------- */

/** Where to send the person back after Stripe: the site they came from, if it is one of ours. */
function siteFor(req: Request): string {
  const origin = req.headers.get('Origin') ?? '';
  if (/^https:\/\/(www\.)?partaza\.eu$/.test(origin)) return origin;
  if (/^https:\/\/partaza(-[a-z0-9-]+)?\.vercel\.app$/.test(origin)) return origin;
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return origin;
  return SITE;
}

/** The parts of an order with their prices in cents. Orders made before multi-part orders have only listing_id. */
async function orderItems(admin: SupabaseClient, order: Json): Promise<{ listing_id: string; item_amount: number }[]> {
  const { data } = await admin.from('payment_order_items').select('listing_id, item_amount').eq('order_id', order.id);
  const items = (data ?? []).filter((row: Json) => isUuid(row.listing_id));
  if (items.length > 0) return items;
  return order.listing_id ? [{ listing_id: order.listing_id, item_amount: order.item_amount }] : [];
}

async function reopenListing(admin: SupabaseClient, order: Json) {
  for (const item of await orderItems(admin, order)) {
    await admin.from('listings').update({ status: 'active' }).eq('id', item.listing_id).eq('status', 'sold');
    await admin.from('listing_finance').update({ sold_price: null, sold_at: null }).eq('listing_id', item.listing_id);
  }
}

/** Marks the order paid from a completed Checkout Session. Safe to call more than once. */
async function markPaid(admin: SupabaseClient, session: Json): Promise<void> {
  const orderId = session.metadata?.order_id ?? session.client_reference_id;
  if (!isUuid(orderId) || session.payment_status !== 'paid') return;
  const intentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
  if (!intentId) return;

  const { data: order } = await admin.from('payment_orders').select('*').eq('id', orderId).maybeSingle();
  if (!order) return;
  if (order.status === 'cancelled') {
    // Paid after the order was cancelled (two tabs racing): give the money straight back.
    await stripe('POST', 'refunds', { payment_intent: intentId, metadata: { order_id: orderId } }, `refund-${orderId}`).catch(() => {});
    return;
  }
  if (order.status !== 'pending') return;
  if (Number(session.amount_total) !== order.total_amount) {
    console.error('amount mismatch', orderId, session.amount_total, order.total_amount);
    return;
  }

  const intent = await stripe('GET', `payment_intents/${intentId}`).catch(() => null);
  const charge = intent ? (typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id ?? null) : null;
  const shipping = session.collected_information?.shipping_details ?? session.shipping_details ?? null;
  const phone = session.customer_details?.phone ?? null;
  const shipTo = shipping || phone ? { name: shipping?.name ?? session.customer_details?.name ?? null, phone, address: shipping?.address ?? null } : null;

  const { data: paid } = await admin
    .from('payment_orders')
    .update({ status: 'paid', paid_at: new Date().toISOString(), stripe_payment_intent_id: intentId, stripe_charge_id: charge, ship_to: shipTo })
    .eq('id', orderId)
    .eq('status', 'pending')
    .select()
    .maybeSingle();
  if (!paid) return;
  for (const item of await orderItems(admin, paid)) {
    await admin.from('listings').update({ status: 'sold' }).eq('id', item.listing_id);
    await admin
      .from('listing_finance')
      .upsert({ listing_id: item.listing_id, seller_id: paid.seller_id, sold_price: item.item_amount / 100, sold_at: new Date().toISOString() }, { onConflict: 'listing_id' });
  }
}

/** Brings a 'pending' order in line with Stripe: paid, expired, or (optionally) cancelled now. */
async function settlePending(admin: SupabaseClient, order: Json, cancelIfOpen: boolean): Promise<void> {
  if (order.status !== 'pending') return;
  if (!order.stripe_session_id) {
    await admin.from('payment_orders').update({ status: 'cancelled' }).eq('id', order.id).eq('status', 'pending');
    return;
  }
  let session = await stripe('GET', `checkout/sessions/${order.stripe_session_id}`);
  if (session.status === 'open' && cancelIfOpen) {
    session = await stripe('POST', `checkout/sessions/${order.stripe_session_id}/expire`).catch(() => session);
  }
  if (session.payment_status === 'paid') return markPaid(admin, session);
  if (session.status === 'expired') {
    await admin.from('payment_orders').update({ status: 'cancelled' }).eq('id', order.id).eq('status', 'pending');
  }
}

/** Transfers the held money to the seller. Returns null on success or a reason. */
async function release(admin: SupabaseClient, order: Json): Promise<string | null> {
  const { data: account } = await admin.from('seller_accounts').select('stripe_account_id').eq('seller_id', order.seller_id).maybeSingle();
  if (!account) return 'seller_not_ready';
  let charge: string | null = order.stripe_charge_id;
  if (!charge && order.stripe_payment_intent_id) {
    const intent = await stripe('GET', `payment_intents/${order.stripe_payment_intent_id}`);
    charge = typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id ?? null;
  }
  if (!charge) return 'no_charge';
  const transfer = await stripe(
    'POST',
    'transfers',
    {
      amount: order.item_amount + order.shipping_amount,
      currency: order.currency,
      destination: account.stripe_account_id,
      source_transaction: charge,
      transfer_group: order.id,
      metadata: { order_id: order.id },
    },
    `release-${order.id}`,
  );
  await admin
    .from('payment_orders')
    .update({ status: 'completed', completed_at: new Date().toISOString(), release_at: null, stripe_transfer_id: transfer.id, stripe_charge_id: charge })
    .eq('id', order.id)
    .in('status', ['shipped', 'received']);
  return null;
}

async function refund(admin: SupabaseClient, order: Json): Promise<void> {
  await stripe('POST', 'refunds', { payment_intent: order.stripe_payment_intent_id, metadata: { order_id: order.id } }, `refund-${order.id}`);
  await admin.from('payment_orders').update({ status: 'refunded', release_at: null }).eq('id', order.id);
  await reopenListing(admin, order);
}

async function releaseDue(admin: SupabaseClient): Promise<Response> {
  if (!STRIPE_KEY) return reply({ skipped: 'not_configured' });
  const { data: due } = await admin
    .from('payment_orders')
    .select('*')
    .in('status', ['shipped', 'received'])
    .lte('release_at', new Date().toISOString())
    .order('release_at')
    .limit(25);
  // Payments whose buyer never came back to the site (closed the tab): confirm them with Stripe here.
  const { data: waiting } = await admin
    .from('payment_orders')
    .select('*')
    .eq('status', 'pending')
    .lte('created_at', new Date(Date.now() - 3 * 60_000).toISOString())
    .limit(25);
  for (const order of waiting ?? []) await settlePending(admin, order, false).catch(() => {});

  let released = 0;
  for (const order of due ?? []) {
    try {
      if ((await release(admin, order)) === null) released += 1;
    } catch (error) {
      console.error('release failed', order.id, (error as Error).message);
    }
  }
  return reply({ released, due: (due ?? []).length });
}

/* ---------- Webhook ---------- */

async function webhook(admin: SupabaseClient, payload: string, signature: string): Promise<Response> {
  if (!WEBHOOK_SECRET || !STRIPE_KEY) return reply({ error: 'not_configured' }, 503);
  if (!(await validSignature(payload, signature))) return reply({ error: 'bad_signature' }, 400);
  const event = JSON.parse(payload);
  const object: Json = event.data?.object ?? {};
  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await markPaid(admin, object);
        break;
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed': {
        const orderId = object.metadata?.order_id;
        if (isUuid(orderId)) await admin.from('payment_orders').update({ status: 'cancelled' }).eq('id', orderId).eq('status', 'pending');
        break;
      }
      case 'charge.refunded': {
        // A full refund made in the Stripe dashboard (e.g. after a dispute was decided for the buyer).
        const intentId = typeof object.payment_intent === 'string' ? object.payment_intent : null;
        if (!object.refunded || !intentId) break;
        const { data: order } = await admin.from('payment_orders').select('*').eq('stripe_payment_intent_id', intentId).maybeSingle();
        if (order && ['paid', 'shipped', 'received', 'disputed'].includes(order.status)) {
          await admin.from('payment_orders').update({ status: 'refunded', release_at: null }).eq('id', order.id);
          await reopenListing(admin, order);
        }
        break;
      }
      case 'account.updated': {
        const ready = !!object.payouts_enabled && object.capabilities?.transfers === 'active';
        await admin.from('seller_accounts').update({ payouts_ready: ready, updated_at: new Date().toISOString() }).eq('stripe_account_id', object.id);
        break;
      }
    }
  } catch (error) {
    console.error('webhook failed', event.type, (error as Error).message);
    return reply({ error: 'handler_failed' }, 500); // Stripe retries
  }
  return reply({ received: true });
}

/* ---------- Actions of a signed-in user ---------- */

async function connectStatus(admin: SupabaseClient, userId: string): Promise<Json> {
  const { data: row } = await admin.from('seller_accounts').select('*').eq('seller_id', userId).maybeSingle();
  if (!row) return { configured: true, exists: false, ready: false };
  const account = await stripeV2('GET', `core/accounts/${row.stripe_account_id}`, { include: ['configuration.recipient'] });
  const { ready, submitted } = recipientState(account);
  if (ready !== row.payouts_ready) {
    await admin.from('seller_accounts').update({ payouts_ready: ready, updated_at: new Date().toISOString() }).eq('seller_id', userId);
  }
  return { configured: true, exists: true, ready, submitted };
}

async function connectStart(admin: SupabaseClient, user: Json, site: string, country2?: unknown): Promise<Json> {
  let { data: row } = await admin.from('seller_accounts').select('*').eq('seller_id', user.id).maybeSingle();
  if (!row) {
    const { data: profile } = await admin.from('profiles').select('kind, name').eq('id', user.id).maybeSingle();
    const country = typeof country2 === 'string' && /^[A-Za-z]{2}$/.test(country2) ? country2.toUpperCase() : 'LT';
    const account = await stripeV2(
      'POST',
      'core/accounts',
      {
        contact_email: user.email,
        display_name: profile?.name ?? undefined,
        identity: { country, entity_type: profile?.kind === 'business' ? 'company' : 'individual' },
        dashboard: 'express',
        defaults: { responsibilities: { fees_collector: 'application', losses_collector: 'application' } },
        configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
        metadata: { profile_id: user.id },
      },
      `account-v2-${user.id}`,
    );
    const inserted = await admin.from('seller_accounts').insert({ seller_id: user.id, stripe_account_id: account.id }).select().maybeSingle();
    row = inserted.data ?? (await admin.from('seller_accounts').select('*').eq('seller_id', user.id).maybeSingle()).data;
    if (!row) return { error: 'server_error' };
  }
  const status = await connectStatus(admin, user.id);
  if (status.ready) {
    // The seller's own Stripe page; if a personal link cannot be made, Stripe's general sign-in page works too.
    const login = await stripe('POST', `accounts/${row.stripe_account_id}/login_links`).catch(() => null);
    return { url: login?.url ?? 'https://connect.stripe.com/express_login', ready: true };
  }
  const link = await stripeV2('POST', 'core/account_links', {
    account: row.stripe_account_id,
    use_case: {
      type: 'account_onboarding',
      account_onboarding: { configurations: ['recipient'], refresh_url: `${site}/payouts?again=1`, return_url: `${site}/payouts?done=1` },
    },
  });
  return { url: link.url, ready: false };
}

/** The price this buyer pays for one listing: its price, or the latest offer both sides accepted in the buyer's chat. */
async function agreedPrice(admin: SupabaseClient, userId: string, listing: Json): Promise<number> {
  let price = Number(listing.price);
  const { data: thread } = await admin.from('threads').select('id').eq('listing_id', listing.id).eq('buyer_id', userId).maybeSingle();
  if (thread) {
    const { data: accepted } = await admin
      .from('messages')
      .select('amount')
      .eq('thread_id', thread.id)
      .eq('kind', 'offer')
      .eq('status', 'accepted')
      .order('created_at', { ascending: false })
      .limit(1);
    if (accepted && accepted.length > 0) price = Math.min(price, Number(accepted[0].amount));
  }
  return price;
}

async function checkout(admin: SupabaseClient, user: Json, body: Json, site: string): Promise<Json> {
  const listingId = body.listing_id;
  const delivery = body.delivery;
  if (!isUuid(listingId) || (delivery !== 'shipping' && delivery !== 'pickup')) return { error: 'bad_request' };
  // More parts of the same seller in the same parcel: one delivery charge for all of them.
  const extraIds: string[] = Array.isArray(body.extra_ids) ? [...new Set(body.extra_ids.filter(isUuid) as string[])].filter((id) => id !== listingId) : [];
  if (extraIds.length > 9) return { error: 'bad_request' };

  const { data: listing } = await admin.from('listings').select('*').eq('id', listingId).maybeSingle();
  if (!listing || listing.status !== 'active') return { error: 'listing_not_active' };
  if (listing.seller_id === user.id) return { error: 'own_listing' };
  let parts: Json[] = [listing];
  if (extraIds.length > 0) {
    const { data: extras } = await admin.from('listings').select('*').in('id', extraIds);
    if (!extras || extras.length !== extraIds.length) return { error: 'listing_not_active' };
    if (extras.some((l: Json) => l.status !== 'active')) return { error: 'listing_not_active' };
    if (extras.some((l: Json) => l.seller_id !== listing.seller_id)) return { error: 'bundle_other_seller' };
    parts = [listing, ...extraIds.map((id) => extras.find((l: Json) => l.id === id))];
  }
  if (delivery === 'shipping' && parts.some((l) => l.shipping === null)) return { error: parts.length > 1 ? 'bundle_no_shipping' : 'no_shipping' };
  if (delivery === 'pickup' && parts.some((l) => !l.pickup)) return { error: parts.length > 1 ? 'bundle_no_pickup' : 'no_pickup' };
  // Delivery is charged for one named country: the seller's own price at home, the seller's price
  // for abroad elsewhere. Without a price for that country there is nothing to charge - the buyer asks first.
  // Several parts go in one parcel, so the highest of their delivery prices is charged once.
  const home = String(listing.country ?? 'LT').toUpperCase();
  const shipCountry = delivery === 'shipping' ? (typeof body.country === 'string' ? body.country.toUpperCase() : home) : null;
  let rate = 0;
  if (shipCountry) {
    if (!/^[A-Z]{2}$/.test(shipCountry) || (shipCountry !== home && !EU.includes(shipCountry))) return { error: 'no_shipping_abroad' };
    for (const part of parts) {
      const partRate = shipCountry === String(part.country ?? 'LT').toUpperCase() ? part.shipping : part.shipping_abroad;
      if (partRate === null || partRate === undefined) return { error: 'no_shipping_abroad' };
      rate = Math.max(rate, Number(partRate));
    }
  }

  const { data: blocks } = await admin
    .from('blocks')
    .select('blocker_id')
    .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${listing.seller_id}),and(blocker_id.eq.${listing.seller_id},blocked_id.eq.${user.id})`)
    .limit(1);
  if (blocks && blocks.length > 0) return { error: 'user_blocked' };

  const { data: account } = await admin.from('seller_accounts').select('payouts_ready').eq('seller_id', listing.seller_id).maybeSingle();
  if (!account?.payouts_ready) return { error: 'seller_not_ready' };

  // Prices are decided here, never taken from the app.
  const items: { listing: Json; cents: number }[] = [];
  for (const part of parts) items.push({ listing: part, cents: Math.round((await agreedPrice(admin, user.id, part)) * 100) });
  const item = items.reduce((sum, i) => sum + i.cents, 0);
  const shipping = shipCountry ? Math.round(rate * 100) : 0;
  const protection = FEE_PERCENT > 0 || FEE_FIXED > 0 ? Math.round(((item + shipping) * FEE_PERCENT) / 100) + FEE_FIXED : 0;
  const fee = protection + ADMIN_FEE;
  const total = item + shipping + fee;
  if (total < 50) return { error: 'amount_too_small' };

  // Clear earlier unfinished attempts on any of these parts: the buyer's own are cancelled, other people's only if stale.
  const partIds = parts.map((l) => l.id);
  const { data: holding } = await admin.from('payment_order_items').select('order_id').in('listing_id', partIds).eq('released', false);
  const holdingIds = [...new Set((holding ?? []).map((row: Json) => row.order_id))];
  const { data: pendingByMain } = await admin.from('payment_orders').select('*').in('listing_id', partIds).eq('status', 'pending');
  const { data: pendingByItem } = holdingIds.length > 0 ? await admin.from('payment_orders').select('*').in('id', holdingIds).eq('status', 'pending') : { data: [] };
  const pending = [...(pendingByMain ?? []), ...(pendingByItem ?? [])].filter((o, i, all) => all.findIndex((x) => x.id === o.id) === i);
  for (const old of pending) {
    const own = old.buyer_id === user.id;
    const stale = Date.now() - new Date(old.created_at).getTime() > 32 * 60_000;
    if (own || stale) await settlePending(admin, old, own).catch(() => {});
  }

  const title = parts.length > 1 ? `${String(listing.title).slice(0, 150)} + ${parts.length - 1} ${parts.length - 1 === 1 ? 'dalis' : 'dalys'}` : listing.title;
  const { data: order, error } = await admin
    .from('payment_orders')
    .insert({
      listing_id: listingId, buyer_id: user.id, seller_id: listing.seller_id, title,
      item_amount: item, shipping_amount: shipping, fee_amount: fee, total_amount: total, delivery, ship_country: shipCountry,
    })
    .select()
    .single();
  if (error || !order) return { error: error?.code === '23505' ? 'listing_reserved' : 'server_error' };
  // Every part is held for this order; if any is already held by someone else's unfinished order, nothing is bought.
  const { error: itemsError } = await admin
    .from('payment_order_items')
    .insert(items.map((i) => ({ order_id: order.id, listing_id: i.listing.id, title: String(i.listing.title).slice(0, 200), item_amount: i.cents })));
  if (itemsError) {
    await admin.from('payment_orders').delete().eq('id', order.id);
    return { error: itemsError.code === '23505' ? 'listing_reserved' : 'server_error' };
  }

  const lang = typeof body.lang === 'string' && WORDS[body.lang] ? body.lang : 'lt';
  const words = WORDS[lang];
  const lines: Json[] = items.map((i) => ({ quantity: 1, price_data: { currency: 'eur', unit_amount: i.cents, product_data: { name: String(i.listing.title).slice(0, 120) } } }));
  if (shipping > 0) lines.push({ quantity: 1, price_data: { currency: 'eur', unit_amount: shipping, product_data: { name: parts.length > 1 ? words.oneParcel : words.delivery } } });
  if (protection > 0) lines.push({ quantity: 1, price_data: { currency: 'eur', unit_amount: protection, product_data: { name: words.protection } } });
  if (ADMIN_FEE > 0) lines.push({ quantity: 1, price_data: { currency: 'eur', unit_amount: ADMIN_FEE, product_data: { name: words.admin } } });

  try {
    const session = await stripe(
      'POST',
      'checkout/sessions',
      {
        mode: 'payment',
        locale: lang,
        line_items: lines,
        client_reference_id: order.id,
        customer_email: user.email,
        metadata: { order_id: order.id },
        payment_intent_data: { transfer_group: order.id, metadata: { order_id: order.id }, description: `Partaza: ${String(title).slice(0, 100)}` },
        phone_number_collection: { enabled: true },
        ...(delivery === 'shipping' ? { shipping_address_collection: { allowed_countries: [shipCountry] } } : {}),
        expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
        success_url: `${site}/payment/${order.id}?paid=1`,
        cancel_url: `${site}/listing/${listingId}`,
      },
      `checkout-${order.id}`,
    );
    await admin.from('payment_orders').update({ stripe_session_id: session.id }).eq('id', order.id);
    return { url: session.url, order_id: order.id };
  } catch (failure) {
    await admin.from('payment_orders').delete().eq('id', order.id);
    throw failure;
  }
}

async function orderAction(admin: SupabaseClient, user: Json, body: Json): Promise<Json> {
  if (!isUuid(body.order_id)) return { error: 'bad_request' };
  const { data: order } = await admin.from('payment_orders').select('*').eq('id', body.order_id).maybeSingle();
  if (!order || (order.buyer_id !== user.id && order.seller_id !== user.id)) return { error: 'not_a_participant' };
  const buyer = order.buyer_id === user.id;
  const now = new Date().toISOString();
  const move = async (from: string[], changes: Json) => {
    const { data } = await admin.from('payment_orders').update(changes).eq('id', order.id).in('status', from).select('id');
    return data && data.length > 0 ? { ok: true } : { error: 'wrong_status' };
  };

  switch (body.do) {
    case 'ship': {
      if (buyer) return { error: 'not_allowed' };
      const tracking = typeof body.tracking === 'string' ? body.tracking.trim().slice(0, 200) : '';
      return move(['paid'], { status: 'shipped', shipped_at: now, release_at: days(SILENT_DAYS), tracking: tracking || null });
    }
    case 'received':
      if (!buyer) return { error: 'not_allowed' };
      return move(['shipped'], { status: 'received', received_at: now, release_at: days(CHECK_DAYS) });
    case 'confirm': {
      if (!buyer) return { error: 'not_allowed' };
      if (!['shipped', 'received'].includes(order.status)) return { error: 'wrong_status' };
      let problem: string | null;
      try {
        problem = await release(admin, order);
      } catch (error) {
        problem = (error as Error).message;
      }
      if (problem === null) return { ok: true };
      // The buyer has done their part; the timer retries the transfer.
      console.error('release delayed', order.id, problem);
      await admin.from('payment_orders').update({ release_at: now, received_at: order.received_at ?? now, status: 'received' }).eq('id', order.id).in('status', ['shipped', 'received']);
      return { ok: true, delayed: true };
    }
    case 'dispute': {
      if (!buyer) return { error: 'not_allowed' };
      const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 2000) : '';
      if (reason.length < 10) return { error: 'reason_required' };
      const kind = DISPUTE_KINDS.includes(body.kind) ? body.kind : 'other';
      return move(['paid', 'shipped', 'received'], { status: 'disputed', dispute_reason: reason, dispute_kind: kind, release_at: null });
    }
    case 'dispute_withdraw': {
      // The buyer says the problem is solved: the order goes back to where it was, with a short wait before the money is released.
      if (!buyer) return { error: 'not_allowed' };
      if (!order.shipped_at) return move(['disputed'], { status: 'paid', release_at: null });
      if (!order.received_at) return move(['disputed'], { status: 'shipped', release_at: days(SILENT_DAYS) });
      return move(['disputed'], { status: 'received', release_at: days(2) });
    }
    case 'dispute_refund': {
      // The seller agrees with the buyer and gives the money back.
      if (buyer) return { error: 'not_allowed' };
      if (order.status !== 'disputed') return { error: 'wrong_status' };
      await refund(admin, order);
      return { ok: true };
    }
    case 'cancel': {
      if (order.status !== 'paid') return { error: 'wrong_status' };
      // The seller may always back out before dispatch; the buyer only once the seller is late.
      if (buyer && Date.now() - new Date(order.paid_at).getTime() < DISPATCH_DAYS * 86_400_000) return { error: 'too_early' };
      await refund(admin, order);
      return { ok: true };
    }
    default:
      return { error: 'bad_request' };
  }
}

/* ---------- Entry point ---------- */

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const admin = createClient(url, key('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'));
  const payload = await req.text();

  const signature = req.headers.get('Stripe-Signature');
  if (signature) return webhook(admin, payload, signature);

  let body: Json;
  try {
    body = JSON.parse(payload || '{}');
  } catch (_) {
    return reply({ error: 'bad_request' }, 400);
  }
  if (body.action === 'release_due') return releaseDue(admin);

  const asUser = createClient(url, key('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: who } = await asUser.auth.getUser();
  if (!who?.user) return reply({ error: 'not_authenticated' });
  const user = who.user;
  // Business answers always come back as 200 with { error } so the app can show a clear message.
  if (!STRIPE_KEY) return reply({ error: 'not_configured', configured: false });

  try {
    switch (body.action) {
      case 'connect_status':
        return reply(await connectStatus(admin, user.id));
      case 'connect_start':
        return reply(await connectStart(admin, user, siteFor(req), body.country));
      case 'checkout':
        return reply(await checkout(admin, user, body, siteFor(req)));
      case 'sync_order': {
        if (!isUuid(body.order_id)) return reply({ error: 'bad_request' });
        const { data: order } = await admin.from('payment_orders').select('*').eq('id', body.order_id).maybeSingle();
        if (!order || (order.buyer_id !== user.id && order.seller_id !== user.id)) return reply({ error: 'not_a_participant' });
        await settlePending(admin, order, false);
        return reply({ ok: true });
      }
      case 'order_action':
        return reply(await orderAction(admin, user, body));
      default:
        return reply({ error: 'bad_request' });
    }
  } catch (error) {
    const failure = error as StripeError;
    console.error('payments failed', body.action, failure.code, failure.message);
    const connectOff = /signed up for Connect|platform profile|Connect/i.test(failure.message ?? '') && body.action === 'connect_start';
    return reply({ error: connectOff ? 'connect_not_enabled' : 'stripe_error', detail: failure.message });
  }
});
