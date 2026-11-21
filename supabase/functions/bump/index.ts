// Partaza paid promotion: the seller pays 5 % of the part's price and the listing is shown first for 7 days.
//   { action: 'start', listing_id }   → { url } of the Stripe payment page
//   { action: 'sync', listing_id }    → checks the seller's unfinished payments for this listing and, if one was paid,
//                                       promotes the listing; returns { bumped_until }
// Works with a Stripe TEST key only: real money is not taken until the owner switches it on on purpose
// (remove the TEST_ONLY check below together with a decision on VAT and invoices for this fee).
//
// Edge Function secrets: STRIPE_SECRET_KEY (shared with the payments function), SITE_URL (optional).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

// deno-lint-ignore no-explicit-any
type Json = Record<string, any>;

const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const TEST_ONLY = true;
const SITE = (Deno.env.get('SITE_URL') ?? 'https://partaza.eu').replace(/\/$/, '');
const RATE = 0.05;
const DAYS = 7;
const MIN_CENTS = 50; // Stripe does not take card payments under 0.50 EUR.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: Json, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);

function secret(dictionaryName: string, legacyName: string): string {
  try {
    const dictionary = JSON.parse(Deno.env.get(dictionaryName) ?? '{}');
    if (dictionary.default) return dictionary.default;
  } catch (_) {
    // fall through to the legacy key
  }
  return Deno.env.get(legacyName) ?? '';
}

async function stripe(method: 'GET' | 'POST', path: string, params?: Record<string, string>, idempotencyKey?: string): Promise<Json> {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${STRIPE_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: method === 'GET' ? undefined : new URLSearchParams(params ?? {}),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json?.error?.message ?? `stripe_${response.status}`);
  return json;
}

/** "Promotion for 7 days" in the seller's language, for Stripe's payment page. */
const PROMOTE: Record<string, (days: number) => string> = {
  lt: (d) => `skelbimo iškėlimas ${d} d.`, en: (d) => `listing promotion, ${d} days`, lv: (d) => `sludinājuma izcelšana, ${d} d.`,
  et: (d) => `kuulutuse esiletõstmine, ${d} päeva`, pl: (d) => `wyróżnienie ogłoszenia, ${d} dni`, ru: (d) => `продвижение объявления, ${d} дн.`,
  de: (d) => `Hervorhebung der Anzeige, ${d} Tage`,
  es: (d) => `destacar el anuncio, ${d} días`,
  fr: (d) => `mise en avant de l'annonce, ${d} jours`,
};

/** The fee in cents: 5 % of the price, at least the smallest amount a card payment can be. */
const feeCents = (price: number) => Math.max(MIN_CENTS, Math.round(price * 100 * RATE));

// deno-lint-ignore no-explicit-any
async function start(admin: any, userId: string, listingId: string, lang: string): Promise<Json> {
  const { data: listing } = await admin.from('listings').select('id, seller_id, title, price, status').eq('id', listingId).maybeSingle();
  if (!listing || listing.seller_id !== userId) return { error: 'not_yours' };
  if (listing.status !== 'active') return { error: 'listing_not_active' };
  const amount = feeCents(Number(listing.price));
  const session = await stripe('POST', 'checkout/sessions', {
    mode: 'payment',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': String(amount),
    'line_items[0][price_data][product_data][name]': `Partaza: ${(PROMOTE[lang] ?? PROMOTE.lt)(DAYS)} – ${String(listing.title).slice(0, 80)}`,
    locale: PROMOTE[lang] ? lang : 'lt',
    success_url: `${SITE}/listing/${listingId}?bump=paid`,
    cancel_url: `${SITE}/listing/${listingId}`,
    'metadata[kind]': 'bump',
    'metadata[listing_id]': listingId,
    'metadata[user_id]': userId,
  });
  const { error } = await admin.from('listing_bumps').insert({ listing_id: listingId, seller_id: userId, session_id: session.id, amount_cents: amount });
  if (error) throw new Error(error.message);
  return { url: session.url, amount_cents: amount };
}

// deno-lint-ignore no-explicit-any
async function sync(admin: any, userId: string, listingId: string): Promise<Json> {
  const since = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const { data: open } = await admin.from('listing_bumps').select('id, session_id').eq('listing_id', listingId).eq('seller_id', userId).eq('status', 'open').gte('created_at', since).order('created_at', { ascending: false }).limit(5);
  for (const row of open ?? []) {
    const session = await stripe('GET', `checkout/sessions/${row.session_id}`);
    if (session.payment_status !== 'paid' || session.metadata?.kind !== 'bump' || session.metadata?.listing_id !== listingId) continue;
    // Only the request that flips the row from open to paid extends the promotion, so a payment counts once.
    const { data: flipped } = await admin.from('listing_bumps').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', row.id).eq('status', 'open').select('id');
    if (!flipped || flipped.length === 0) continue;
    const { data: listing } = await admin.from('listings').select('bumped_until').eq('id', listingId).maybeSingle();
    const from = Math.max(Date.now(), listing?.bumped_until ? new Date(listing.bumped_until).getTime() : 0);
    await admin.from('listings').update({ bumped_until: new Date(from + DAYS * 86_400_000).toISOString() }).eq('id', listingId);
    console.log('bump paid', listingId, row.session_id);
  }
  const { data: now } = await admin.from('listings').select('bumped_until').eq('id', listingId).maybeSingle();
  return { bumped_until: now?.bumped_until ?? null };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const admin = createClient(url, secret('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'));
  const asUser = createClient(url, secret('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: who } = await asUser.auth.getUser();
  if (!who?.user) return reply({ error: 'not_authenticated' });
  if (!STRIPE_KEY || (TEST_ONLY && !STRIPE_KEY.startsWith('sk_test_'))) return reply({ error: 'not_configured' });

  let body: Json;
  try {
    body = await req.json();
  } catch (_) {
    return reply({ error: 'bad_request' });
  }
  if (!isUuid(body.listing_id)) return reply({ error: 'bad_request' });
  try {
    if (body.action === 'start') return reply(await start(admin, who.user.id, body.listing_id, typeof body.lang === 'string' ? body.lang : 'lt'));
    if (body.action === 'sync') return reply(await sync(admin, who.user.id, body.listing_id));
    return reply({ error: 'bad_request' });
  } catch (error) {
    console.error('bump failed', body.action, (error as Error).message);
    return reply({ error: 'payment_error' });
  }
});
