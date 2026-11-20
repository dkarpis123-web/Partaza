// Partaza AI helpers for sellers, run on Claude:
//   { action: 'recognize', photos: [public photo URLs], lang }       → title, part number, fit, vehicle type, visible damage
//   { action: 'match', photo: public photo URL, lang }               → which listings on the marketplace show the same kind of part
//   { action: 'improve', listing_id, lang }                        → corrected title, description, part number and fit for the caller's own listing
//   { action: 'price', title, oem, fits, condition, defects, country, lang } → price range in EUR from public web pages, with sources
// Only signed-in users may call it, and each user has a daily limit, because every call costs money.
//
// Edge Function secrets:
//   ANTHROPIC_API_KEY   required
//   AI_DAILY_LIMIT      optional, calls per user per day, default 40
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

// deno-lint-ignore no-explicit-any
type Json = Record<string, any>;

const KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const DAILY_LIMIT = Math.max(1, Number(Deno.env.get('AI_DAILY_LIMIT') ?? '40') || 40);
const VISION_MODEL = 'claude-sonnet-5-5';
const SEARCH_MODEL = 'claude-sonnet-5-5';
const VEHICLE_TYPES = ['car', 'motorcycle', 'truck', 'boat', 'moped', 'scooter', 'kart', 'bicycle'];

const PHOTO_URL = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/listing-photos\//;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};
const reply = (body: Json, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

function secret(dictionaryName: string, legacyName: string): string {
  try {
    const dictionary = JSON.parse(Deno.env.get(dictionaryName) ?? '{}');
    if (dictionary.default) return dictionary.default;
  } catch (_) {
    // fall through to the legacy key
  }
  return Deno.env.get(legacyName) ?? '';
}

async function claude(body: Json): Promise<Json> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json?.error?.message ?? `anthropic_${response.status}`);
  return json;
}

/** The arguments Claude passed to our tool; if it answered in text instead, the JSON object in that text. */
function toolInput(result: Json, name: string): Json {
  const blocks: Json[] = result.content ?? [];
  const call = blocks.find((b) => b.type === 'tool_use' && b.name === name);
  if (call?.input) return call.input;
  const written = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  const object = written.match(/\{[\s\S]*\}/);
  if (object) {
    try {
      return JSON.parse(object[0]);
    } catch (_) {
      // not JSON after all
    }
  }
  console.error('ai: no tool call', name, result.stop_reason, written.slice(0, 200));
  return {};
}

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const language = (lang: unknown) => (lang === 'en' ? 'English' : 'Lithuanian');

/** Looks a part number up on the web and returns the vehicles the part fits ('' if nothing reliable was found). */
async function fitsByNumber(oem: string, title: string, lang: unknown): Promise<string> {
  if (oem.replace(/[^A-Za-z0-9]/g, '').length < 5) return '';
  try {
    const result = await claude({
      model: SEARCH_MODEL,
      max_tokens: 2000,
      tools: [
        { type: 'web_search_20250305', name: 'web_search', max_uses: 3 },
        {
          name: 'report_fitment',
          description: 'Reports which vehicles the part with this number fits. Call it once, after searching.',
          input_schema: {
            type: 'object',
            properties: {
              found: { type: 'boolean', description: 'true only if the search results clearly show this exact part number and its vehicles.' },
              fits: { type: 'string', description: 'Makes, models and generations/years the part fits, comma-separated, most common first, at most 300 characters, e.g. "BMW 3 (F30) 2012-2019, BMW 4 (F32)". Empty if not found.' },
            },
            required: ['found', 'fits'],
          },
        },
      ],
      messages: [{
        role: 'user',
        content:
          `Vehicle part number: ${oem}\nPart: ${title || '(unknown)'}\n\n` +
          `Search the web for this exact part number and find which vehicle makes, models and generations it fits (parts catalogues and shops list this). ` +
          `Then call the report_fitment tool exactly once (do not answer in plain text). Write model names as they are commonly written; any words in ${language(lang)}. ` +
          `If the results are about a different number or disagree with each other, set found to false rather than guess.`,
      }],
    });
    const found = toolInput(result, 'report_fitment');
    return found.found === true ? text(found.fits, 300) : '';
  } catch (error) {
    console.error('ai: fitment lookup failed', (error as Error).message);
    return '';
  }
}

async function recognize(body: Json): Promise<Json> {
  const photos = (Array.isArray(body.photos) ? body.photos : [])
    .filter((u: unknown) => typeof u === 'string' && PHOTO_URL.test(u))
    .slice(0, 4);
  if (photos.length === 0) return { error: 'no_photos' };

  const result = await claude({
    model: VISION_MODEL,
    max_tokens: 2000,
    tools: [{
      name: 'describe_part',
      description: 'Records what the photographed vehicle part is.',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short listing title naming the part, e.g. "Front brake discs, pair". Empty if the photos do not show a vehicle part.' },
          oem: { type: 'string', description: 'Part / OEM number exactly as readable on the part or its label. Empty if none is clearly readable. Never guess.' },
          fits: { type: 'string', description: 'Vehicles the part fits, only if a make/model is visible or follows from a readable part number. Otherwise empty.' },
          vehicle_type: { type: 'string', enum: VEHICLE_TYPES },
          defects: { type: 'array', items: { type: 'string' }, description: 'Visible damage or wear, one short phrase each. Empty if none is visible.' },
        },
        required: ['title', 'oem', 'fits', 'vehicle_type', 'defects'],
      },
    }],
    messages: [{
      role: 'user',
      content: [
        ...photos.map((url: string) => ({ type: 'image', source: { type: 'url', url } })),
        { type: 'text', text: `These are a seller's photos of one vehicle part for a marketplace listing. Read every number and label you can see, then call the describe_part tool exactly once with the result (do not answer in plain text). Write the title, fits and defects in ${language(body.lang)}. Report only what you can see or read; leave a field empty rather than guess.` },
      ],
    }],
  });
  const found = toolInput(result, 'describe_part');
  // With a readable part number, the vehicles are looked up by that number rather than guessed from the photo.
  const byNumber = await fitsByNumber(text(found.oem, 60), text(found.title, 120), body.lang);
  return {
    title: text(found.title, 120),
    oem: text(found.oem, 60),
    fits: byNumber || text(found.fits, 200),
    vehicle_type: VEHICLE_TYPES.includes(found.vehicle_type) ? found.vehicle_type : 'car',
    defects: (Array.isArray(found.defects) ? found.defects : []).map((d: unknown) => text(d, 120)).filter(Boolean).slice(0, 6),
  };
}

/** Search by photo: Claude looks at the buyer's photo and picks the listings that are the same kind of part. */
// deno-lint-ignore no-explicit-any
async function match(body: Json, admin: any): Promise<Json> {
  if (typeof body.photo !== 'string' || !PHOTO_URL.test(body.photo)) return { error: 'no_photos' };
  const { data: rows } = await admin
    .from('listings')
    .select('id, title, oem, fits, vehicle_type')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(250);
  const listings: Json[] = rows ?? [];
  const catalogue = listings.map((l, i) => `${i + 1} | ${text(l.title, 90)} | ${text(l.oem, 30) || '-'} | ${text(l.fits, 60) || '-'} | ${l.vehicle_type}`).join('\n');

  const result = await claude({
    model: VISION_MODEL,
    max_tokens: 2000,
    tools: [{
      name: 'report_matches',
      description: 'Reports what part the photo shows and which listings offer the same kind of part.',
      input_schema: {
        type: 'object',
        properties: {
          part_name: { type: 'string', description: 'Short name of the part in the photo. Empty if it is not a vehicle part.' },
          oem: { type: 'string', description: 'Part number readable in the photo, exactly as written. Empty if none is clearly readable.' },
          matches: { type: 'array', items: { type: 'integer' }, description: 'Numbers of the listings that are the same kind of part, best match first, at most 12. Empty if none.' },
        },
        required: ['part_name', 'oem', 'matches'],
      },
    }],
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'url', url: body.photo } },
        {
          type: 'text',
          text:
            `A buyer photographed a vehicle part they are looking for. Name the part in ${language(body.lang)} and read its part number if one is clearly visible. ` +
            `Then choose from the listings below those that offer the same kind of part (the same component; an identical part number is the best match). ` +
            `Do not include listings for a different component just because they fit the same vehicle. Answer by calling the report_matches tool exactly once (do not answer in plain text).\n\n` +
            `Listings (number | title | part number | fits | vehicle type):\n${catalogue || '(no listings)'}`,
        },
      ],
    }],
  });
  const found = toolInput(result, 'report_matches');
  const ids = (Array.isArray(found.matches) ? found.matches : [])
    .map((n: unknown) => listings[Number(n) - 1]?.id)
    .filter((id: unknown, i: number, all: unknown[]) => typeof id === 'string' && all.indexOf(id) === i)
    .slice(0, 12);
  return { part_name: text(found.part_name, 120), oem: text(found.oem, 60), ids };
}

async function price(body: Json): Promise<Json> {
  const title = text(body.title, 120);
  const oem = text(body.oem, 60);
  if (!title && !oem) return { error: 'nothing_to_search' };
  const country = /^[A-Z]{2}$/.test(body.country ?? '') ? body.country : 'LT';

  const result = await claude({
    model: SEARCH_MODEL,
    max_tokens: 3000,
    tools: [
      // No user_location: the search tool rejects some countries (e.g. LT); the country is named in the request instead.
      { type: 'web_search_20250305', name: 'web_search', max_uses: 4 },
      {
        name: 'report_prices',
        description: 'Reports the asking prices found for this part. Call it once, after searching.',
        input_schema: {
          type: 'object',
          properties: {
            found: { type: 'boolean', description: 'false if no usable prices for this part were found.' },
            low: { type: 'number', description: 'Lowest relevant asking price in EUR.' },
            typical: { type: 'number', description: 'Typical (middle) asking price in EUR.' },
            high: { type: 'number', description: 'Highest relevant asking price in EUR.' },
            note: { type: 'string', description: `One or two sentences in ${language(body.lang)}: what the prices refer to (new or used, which markets) and how sure you are.` },
            sources: {
              type: 'array',
              items: {
                type: 'object',
                properties: { title: { type: 'string' }, url: { type: 'string' }, price: { type: 'number', description: 'Price on that page in EUR.' } },
                required: ['title', 'url'],
              },
              description: 'Pages the prices were read from (at most 5). Only pages returned by the search.',
            },
          },
          required: ['found', 'note', 'sources'],
        },
      },
    ],
    messages: [{
      role: 'user',
      content:
        `A seller is listing this vehicle part on a marketplace and wants to know what similar parts are currently offered for.\n` +
        `Part: ${title || '(no title)'}\nPart number: ${oem || '(unknown)'}\nFits: ${text(body.fits, 200) || '(unknown)'}\n` +
        `Condition: ${text(body.condition, 20) || 'used'}${body.defects ? ', with visible damage' : ''}\nSeller country: ${country}\n\n` +
        `Search the web for current asking prices of this part in the same condition, preferring the part number and European marketplaces and shops. ` +
        `Convert prices to EUR. Then call the report_prices tool exactly once (do not answer in plain text). If you cannot find this specific part, set found to false rather than estimating.`,
    }],
  });
  const blocks: Json[] = result.content ?? [];
  const found = toolInput(result, 'report_prices');
  if (!found || found.found !== true || !(Number(found.typical) > 0)) return { found: false, note: text(found?.note, 400) };
  // Only pages the search really returned may be shown as sources.
  const seen = new Set<string>();
  for (const block of blocks) {
    if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) block.content.forEach((r: Json) => r.url && seen.add(r.url));
  }
  const sources = (Array.isArray(found.sources) ? found.sources : [])
    .filter((s: Json) => typeof s.url === 'string' && seen.has(s.url))
    .slice(0, 5)
    .map((s: Json) => ({ title: text(s.title, 120), url: s.url, price: Number(s.price) > 0 ? Number(s.price) : null }));
  if (sources.length === 0) return { found: false, note: text(found.note, 400) };
  const typical = Number(found.typical);
  return {
    found: true,
    low: Number(found.low) > 0 ? Number(found.low) : typical,
    typical,
    high: Number(found.high) > 0 ? Number(found.high) : typical,
    note: text(found.note, 400),
    sources,
  };
}

/** Reviews the seller's own listing against its photos and proposes corrections; nothing is saved here. */
// deno-lint-ignore no-explicit-any
async function improve(body: Json, admin: any, userId: string): Promise<Json> {
  if (typeof body.listing_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.listing_id)) return { error: 'bad_request' };
  const { data: listing } = await admin.from('listings').select('seller_id, title, description, oem, fits, condition, vehicle_type, photos').eq('id', body.listing_id).maybeSingle();
  if (!listing || listing.seller_id !== userId) return { error: 'not_yours' };
  const photos = (Array.isArray(listing.photos) ? listing.photos : []).filter((u: unknown) => typeof u === 'string' && PHOTO_URL.test(u)).slice(0, 4);

  const result = await claude({
    model: VISION_MODEL,
    max_tokens: 2500,
    tools: [{
      name: 'propose_listing',
      description: 'Proposes the corrected listing texts.',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Clear listing title: part name, side/position if known, make and model if known. At most 90 characters.' },
          description: { type: 'string', description: 'Tidy description built only from the seller\'s own text and what is visible in the photos. Empty if there is nothing to say.' },
          oem: { type: 'string', description: 'Part number: the seller\'s, or one clearly readable in the photos. Never guess.' },
          fits: { type: 'string', description: 'Only the vehicles this part fits. Drop vehicles the seller listed that the part number, labels or the make visible in the photos rule out, or that plainly do not belong to this part. Keep the rest, tidied up; add only what is visible or follows from a readable part number.' },
          notes: { type: 'array', items: { type: 'string' }, description: 'What you changed and why, one short sentence each; also anything the seller should check or add (e.g. a number in the photo differs from the text). At most 6.' },
        },
        required: ['title', 'description', 'oem', 'fits', 'notes'],
      },
    }],
    messages: [{
      role: 'user',
      content: [
        ...photos.map((url: string) => ({ type: 'image', source: { type: 'url', url } })),
        {
          type: 'text',
          text:
            `A seller wrote this vehicle-part listing by hand and asks you to review and improve it. Photos of the part are above (there may be none).\n\n` +
            `Title: ${text(listing.title, 200)}\nDescription: ${text(listing.description, 2000) || '(empty)'}\nPart number: ${text(listing.oem, 80) || '(empty)'}\n` +
            `Fits: ${text(listing.fits, 400) || '(empty)'}\nCondition: ${text(listing.condition, 20)}\nVehicle type: ${text(listing.vehicle_type, 20)}\n\n` +
            `Fix spelling and wording, make the title clear and searchable, read part numbers and labels from the photos and correct the part number and fit if the photos show otherwise. ` +
            `Remove from the title, description and fits anything that does not belong to the part shown or that the photos contradict (for example a vehicle model which the part number, labels or visible make rule out), and say in notes what you removed and why. ` +
            `If you cannot tell whether a vehicle the seller stated is right, keep it and ask the seller in notes to check it. ` +
            `Do not invent facts, do not add praise or sales talk, and keep everything the seller stated about condition and defects. ` +
            `Write in ${language(body.lang)}. Answer by calling the propose_listing tool exactly once (do not answer in plain text).`,
        },
      ],
    }],
  });
  const found = toolInput(result, 'propose_listing');
  if (!text(found.title, 120)) return { error: 'ai_error' };
  const notes = (Array.isArray(found.notes) ? found.notes : []).map((n: unknown) => text(n, 240)).filter(Boolean).slice(0, 6);
  // The part number decides the fit: vehicles found for it on the web replace the seller's list.
  const byNumber = await fitsByNumber(text(found.oem, 60), text(found.title, 120), body.lang);
  if (byNumber) notes.push(body.lang === 'en' ? 'Fitment was chosen by the part number from public sources – please check it.' : 'Tinkamumas parinktas pagal dalies numerį iš viešų šaltinių – patikrinkite.');
  return {
    title: text(found.title, 120),
    description: text(found.description, 3000),
    oem: text(found.oem, 60),
    fits: byNumber || text(found.fits, 400),
    notes,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method === 'GET') {
    if (!KEY) return reply({ configured: false });
    const check = await fetch('https://api.anthropic.com/v1/models?limit=1', { headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01' } });
    return reply({ configured: true, key_works: check.ok, status: check.status });
  }
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const admin = createClient(url, secret('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'));
  const asUser = createClient(url, secret('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: who } = await asUser.auth.getUser();
  if (!who?.user) return reply({ error: 'not_authenticated' });
  if (!KEY) return reply({ error: 'not_configured' });

  let body: Json;
  try {
    body = await req.json();
  } catch (_) {
    return reply({ error: 'bad_request' });
  }
  if (!['recognize', 'price', 'match', 'improve'].includes(body.action)) return reply({ error: 'bad_request' });

  const { data: used } = await admin.rpc('ai_use', { p_user: who.user.id, p_limit: DAILY_LIMIT });
  if (used === false) return reply({ error: 'daily_limit' });

  try {
    if (body.action === 'match') return reply(await match(body, admin));
    if (body.action === 'improve') return reply(await improve(body, admin, who.user.id));
    return reply(body.action === 'recognize' ? await recognize(body) : await price(body));
  } catch (error) {
    console.error('ai failed', body.action, (error as Error).message);
    return reply({ error: 'ai_error', detail: (error as Error).message });
  }
});
