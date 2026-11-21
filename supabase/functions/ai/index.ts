// Partaza AI helpers for sellers, run on Claude:
//   { action: 'recognize', photos: [public photo URLs], label_photos: [close-ups of the labels], codes: [barcodes / QR codes read on the device], lang }
//                                                                  → title, part number, other codes on the part, fit, vehicle type, visible damage; the part is named by its number,
//                                                                    failing that by a barcode / QR code, failing that by its look - and the look is always checked
//   { action: 'labels', photos: [public photo URLs] }              → where the labels and stamped numbers are on the photos and how they are turned,
//                                                                    so the app can cut them out upright and large and send them back as label_photos
//   { action: 'match', photo: public photo URL, lang }               → which listings on the marketplace show the same kind of part
//   { action: 'improve', listing_id, lang }                        → corrected title, description, part number and fit for the caller's own listing
//   { action: 'shipping', title, oem, fits, from, to, lang }       → rough parcel weight/size and a postage estimate between two countries, with sources
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
const LANGUAGE_NAMES: Record<string, string> = { lt: 'Lithuanian', en: 'English', lv: 'Latvian', et: 'Estonian', pl: 'Polish', ru: 'Russian', de: 'German', es: 'Spanish', fr: 'French' };
/** The language the app is shown in; texts written by the AI come back in it. */
const language = (lang: unknown) => LANGUAGE_NAMES[typeof lang === 'string' ? lang : ''] ?? 'Lithuanian';

interface Candidate {
  title: string;
  fits: string;
  /** false when no page showed the number and the vehicles were found by the part's name and make instead. */
  exact: boolean;
  /** The code the supporting pages showed: the part number or one of the other codes on the part. */
  matched: string;
}

// How production years are written, said the same way everywhere so the answers do not copy an example's years.
const YEARS_RULE =
  'Each vehicle as make, model, generation code and the years this part is fitted to it, in the form "Make Model (code) YYYY-YYYY". ' +
  'Take the years from the sources for this part; if they give none, use the production years of that generation. ' +
  'If the vehicle is still produced, or the sources show the part on the newest model years, leave the range open: "YYYY-". ' +
  'Check each vehicle separately - different vehicles have different years; never repeat one range for all of them and never close a range by guessing.';

/**
 * Looks a part number up on the web: what the part really is and which vehicles it fits.
 * The number decides, not the look of the part - control units and sensors look alike. Returns up to
 * three candidates, the best-supported first; when sources disagree each reading is its own candidate,
 * so the seller chooses instead of the AI guessing. Empty when nothing was found.
 */
async function lookupNumber(oem: string, guess: string, lang: unknown, hint = '', others: string[] = []): Promise<Candidate[]> {
  const compact = oem.replace(/[^A-Za-z0-9]/g, '');
  if (compact.length < 5) return [];
  // Sellers and catalogues often list a part under a supplier, casting or label code instead of the part number.
  const also = others.length > 0
    ? `Other codes on the part or its labels: ${others.join(', ')}. They may be supplier, casting or catalogue codes rather than the part number, but parts are often listed online under them. ` +
      `Search these too (each with the make or the part name, since short codes are ambiguous); a page showing one of them on this kind of part counts as a source - say in matched which code it was. `
    : '';
  try {
    const result = await claude({
      model: SEARCH_MODEL,
      max_tokens: 3500,
      tools: [
        { type: 'web_search_20250305', name: 'web_search', max_uses: 7 },
        {
          name: 'report_part',
          description: 'Reports what the part with this number is and which vehicles it fits. Call it once, after searching.',
          input_schema: {
            type: 'object',
            properties: {
              candidates: {
                type: 'array',
                description: 'What the sources say this number is, best-supported first, at most 3. One entry if the sources agree. Empty only if no page shows this number or its base number.',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string', description: `Listing title in ${language(lang)}: the part name as catalogues and sellers of this exact number call it, with side or position if they give it. At most 90 characters.` },
                    fits: { type: 'string', description: `Vehicles the sources list for this part, comma-separated, most common first, up to 8 vehicles and 300 characters. ${YEARS_RULE}` },
                    sources: { type: 'integer', description: 'How many separate pages in the results support this reading.' },
                    by_number: { type: 'boolean', description: 'true if pages showing this number, its base number or one of the other codes support this reading; false if no page showed any of them and this comes from searching the part by its name and make.' },
                    matched: { type: 'string', description: 'The number or code, exactly as given above, that the supporting pages showed. Empty if by_number is false.' },
                  },
                  required: ['title', 'fits', 'sources', 'by_number', 'matched'],
                },
              },
            },
            required: ['candidates'],
          },
        },
      ],
      messages: [{
        role: 'user',
        content:
          `Vehicle part number as read from the part: ${oem}\nThe same number without spaces: ${compact}\n` +
          `From the photo the part looks like: ${guess || '(unknown)'} - this is only a guess from its shape and may be wrong.${hint ? `\nOther clues: ${hint}` : ''}\n\n` +
          `Find out what part this number really is and which vehicles (with production years) it fits. Search the web for the number both ways - with its spaces ("${oem}") and without ("${compact}") - ` +
          `and, if results are thin, with the manufacturer's name, on parts catalogues, dismantlers and marketplaces. ` +
          `Many makers end the number with a revision or colour suffix (for example "-00-B", a trailing letter, or a last digit group): if the full number gives nothing, search it without that suffix too - ` +
          `a page showing the same base number with another revision is the same part and counts as a source. Keep searching with different wordings until the searches are used up before reporting nothing. ` +
          also +
          `Read what the pages that show this exact number call the part. The number decides: if the sources name a different part than the photo guess, the sources are right. ` +
          `If the sources agree, give one candidate. If they name different parts, give each as its own candidate with how many pages support it - do not pick one by guessing. ` +
          `If after all that no page shows the number or any of the codes, do not stop: use the remaining searches to look the part up by its name and make (from the photo guess and clues) and find which vehicles and model years use such a part, ` +
          `and report that as one candidate with by_number false. ` +
          `Years matter: buyers filter by them. Look for the years in the sources and check whether the part is still fitted to current models. ` +
          `Ignore pages about other numbers. Then call the report_part tool exactly once (do not answer in plain text).`,
      }],
    });
    const found = toolInput(result, 'report_part');
    console.log('ai number', oem, result.stop_reason, JSON.stringify(found).slice(0, 400));
    return (Array.isArray(found.candidates) ? found.candidates : [])
      .filter((c: Json) => text(c?.title, 120))
      .sort((a: Json, b: Json) => (Number(b.sources) || 0) - (Number(a.sources) || 0))
      .slice(0, 3)
      .map((c: Json) => ({ title: text(c.title, 120), fits: text(c.fits, 300), exact: c.by_number !== false, matched: text(c.matched, 60) }));
  } catch (error) {
    console.error('ai: number lookup failed', (error as Error).message);
    return [];
  }
}

const bare = (value: string) => value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

/**
 * Barcode and QR contents that can be a part number, best first. Labels prefix each value with a data
 * identifier - "(P)" or "(1P)" is the part number, "(1T)", "(S)", "(Q)", "(V)" are lot, serial, quantity
 * and supplier, which say nothing about what the part is. The identifier is dropped; anything equal to
 * the number already looked up is skipped.
 */
function partCodes(codes: string[], number: string): string[] {
  const known = bare(number);
  const ranked: { code: string; rank: number }[] = [];
  for (const raw of codes) {
    const tagged = raw.trim().match(/^[\[(]\s*(\d{0,2}[A-Za-z])\s*[\])]\s*(.+)$/);
    const id = tagged ? tagged[1].toUpperCase() : '';
    if (id && !['P', '1P', '30P'].includes(id)) continue;
    const code = (tagged ? tagged[2] : raw).trim();
    const key = bare(code);
    if (key.length < 5 || key === known || /^https?:/i.test(code) || ranked.some((r) => bare(r.code) === key)) continue;
    ranked.push({ code, rank: id ? 0 : 1 });
  }
  return ranked.sort((a, b) => a.rank - b.rank).map((r) => r.code);
}

const sameText = (a: string, b: string) => a.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim() === b.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * Does the part in the photos look like what its number says it is? Judged by shape, connectors and
 * mounting only - a label can be moved onto another part. One verdict per candidate title.
 */
async function looksRight(photos: string[], titles: string[], lang: unknown): Promise<{ verdicts: ('match' | 'mismatch' | 'unsure')[]; note: string }> {
  try {
    const result = await claude({
      model: VISION_MODEL,
      max_tokens: 800,
      tools: [{
        name: 'report_look',
        description: 'Records whether the photographed part looks like each named part.',
        input_schema: {
          type: 'object',
          properties: {
            verdicts: { type: 'array', items: { type: 'string', enum: ['match', 'mismatch', 'unsure'] }, description: 'One per name, in the same order.' },
            note: { type: 'string', description: `If the first name is not a clear match: one sentence in ${language(lang)} saying what the part looks like instead, or what cannot be told from the photos.` },
          },
          required: ['verdicts', 'note'],
        },
      }],
      messages: [{
        role: 'user',
        content: [
          ...photos.slice(0, 3).map((url) => ({ type: 'image', source: { type: 'url', url } })),
          {
            type: 'text',
            text:
              `According to the number on its label, the part in these photos is one of:\n${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n` +
              `Ignore the label and every number on it - a label can be stuck onto a different part. Look only at the shape, size, housing, connectors and mounting points. ` +
              `For each name say whether the part could be that: "match" if its look is consistent with it, "mismatch" if it plainly is a different kind of part ` +
              `(for example a headlight labelled as a control unit), "unsure" if the photos do not show enough. Electronic modules of different functions often look alike - that is a match, not a mismatch. ` +
              `Answer by calling the report_look tool exactly once (do not answer in plain text).`,
          },
        ],
      }],
    });
    const found = toolInput(result, 'report_look');
    const verdicts = (Array.isArray(found.verdicts) ? found.verdicts : []).map((v: unknown) => (v === 'match' || v === 'mismatch' ? v : 'unsure'));
    console.log('ai look', titles[0], JSON.stringify(found).slice(0, 200));
    return { verdicts, note: text(found.note, 240) };
  } catch (error) {
    console.error('ai: look check failed', (error as Error).message);
    return { verdicts: [], note: '' };
  }
}

/**
 * Finds the labels and stamped numbers on the photos. Small or upside-down print is misread from the whole
 * photo, so the app cuts these areas out of the original photo, turns them upright and sends them back enlarged.
 */
async function labels(body: Json): Promise<Json> {
  const photos = (Array.isArray(body.photos) ? body.photos : [])
    .filter((u: unknown) => typeof u === 'string' && PHOTO_URL.test(u))
    .slice(0, 4);
  if (photos.length === 0) return { error: 'no_photos' };
  const result = await claude({
    model: VISION_MODEL,
    max_tokens: 800,
    tools: [{
      name: 'report_labels',
      description: 'Reports where the labels and stamped or moulded numbers are on the photos.',
      input_schema: {
        type: 'object',
        properties: {
          labels: {
            type: 'array',
            description: 'Areas with a sticker label, a type plate, or numbers stamped or moulded into the part. The ones with part numbers first, at most 3. Empty if there are none.',
            items: {
              type: 'object',
              properties: {
                photo: { type: 'integer', description: 'Which photo, counting from 1.' },
                x: { type: 'number', description: 'Left edge of the area as a fraction of the photo width, 0 to 1.' },
                y: { type: 'number', description: 'Top edge as a fraction of the photo height, 0 to 1.' },
                w: { type: 'number', description: 'Width as a fraction of the photo width.' },
                h: { type: 'number', description: 'Height as a fraction of the photo height.' },
                turn: { type: 'integer', enum: [0, 90, 180, 270], description: 'Degrees the photo must be turned clockwise for this text to read upright, left to right. 180 if the text is upside down.' },
              },
              required: ['photo', 'x', 'y', 'w', 'h', 'turn'],
            },
          },
        },
        required: ['labels'],
      },
    }],
    messages: [{
      role: 'user',
      content: [
        ...photos.map((url: string) => ({ type: 'image', source: { type: 'url', url } })),
        { type: 'text', text: 'These are photos of a vehicle part. Find every area with printed, stamped or moulded numbers: sticker labels, type plates, numbers in the plastic or metal. For each give its position and how the text is turned - look at the letters themselves to tell whether it is upside down or sideways. Be generous with the area rather than tight. Answer by calling the report_labels tool exactly once (do not answer in plain text).' },
      ],
    }],
  });
  const found = toolInput(result, 'report_labels');
  const unit = (n: unknown) => Math.min(1, Math.max(0, Number(n) || 0));
  return {
    labels: (Array.isArray(found.labels) ? found.labels : [])
      .map((l: Json) => ({ photo: Math.round(Number(l.photo)) - 1, x: unit(l.x), y: unit(l.y), w: unit(l.w), h: unit(l.h), turn: [0, 90, 180, 270].includes(Number(l.turn)) ? Number(l.turn) : 0 }))
      .filter((l: Json) => l.photo >= 0 && l.photo < photos.length && l.w > 0.01 && l.h > 0.01)
      .slice(0, 3),
  };
}

async function recognize(body: Json): Promise<Json> {
  const photos = (Array.isArray(body.photos) ? body.photos : [])
    .filter((u: unknown) => typeof u === 'string' && PHOTO_URL.test(u))
    .slice(0, 4);
  if (photos.length === 0) return { error: 'no_photos' };
  // Close-ups of the labels, cut out of the original photos by the app, upright and enlarged.
  const closeUps = (Array.isArray(body.label_photos) ? body.label_photos : [])
    .filter((u: unknown) => typeof u === 'string' && PHOTO_URL.test(u))
    .slice(0, 3);

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
          oem: { type: 'string', description: 'Part / OEM number exactly as readable on the part or its label, without a label prefix such as "(P)" or "P/N". Empty if none is readable. Never guess a character.' },
          oem_sure: { type: 'boolean', description: 'true only if every character of the part number is sharp and unmistakable. false if any character could be another one (1/7, 5/6, 8/3/6, 0/O/D, B/8), the print is small, blurred, worn, dirty, or was read upside down or at an angle.' },
          fits: { type: 'string', description: 'Vehicles the part fits, comma-separated and nothing else (no explanations in brackets): any make or model visible on the part, its label or packaging, or that follows from the part number and the manufacturer\'s numbering scheme. Several candidates are fine. Add production years only when you are sure of them, open-ended ("2020-") for vehicles still produced. Empty only if nothing points to a vehicle.' },
          vehicle_type: { type: 'string', enum: VEHICLE_TYPES },
          defects: { type: 'array', items: { type: 'string' }, description: 'Visible damage or wear, one short phrase each. Empty if none is visible.' },
          codes: { type: 'array', items: { type: 'string' }, description: 'Every other code readable on the part or its labels besides the part number: supplier and manufacturer codes, casting numbers, short catalogue codes, the digits under a barcode or next to a QR code. Exactly as written, one per entry. Leave out dates, serial numbers and lot numbers when they are marked as such. Empty if none.' },
          looks_like: { type: 'string', description: 'What the part is judging ONLY by its shape, size, connectors and mounting points, as if it had no label at all. A short phrase.' },
        },
        required: ['title', 'oem', 'oem_sure', 'fits', 'vehicle_type', 'defects', 'codes', 'looks_like'],
      },
    }],
    messages: [{
      role: 'user',
      content: [
        ...photos.map((url: string) => ({ type: 'image', source: { type: 'url', url } })),
        ...closeUps.map((url: string) => ({ type: 'image', source: { type: 'url', url } })),
        {
          type: 'text',
          text:
            `These are a seller's photos of one vehicle part for a marketplace listing.` +
            (closeUps.length > 0 ? ` The first ${photos.length} show the part; the last ${closeUps.length} are enlarged close-ups of its labels, turned upright - read the numbers from the close-ups, they are the sharpest view.` : '') +
            ` Read every number and label you can see, then call the describe_part tool exactly once with the result (do not answer in plain text). Write the title, fits and defects in ${language(body.lang)}. ` +
            `Labels are often upside down or sideways: work out which way the text runs before reading it. Read the part number one character at a time, exactly as written, and never invent or tidy a character; ` +
            `if two readings are possible, give the likelier one and set oem_sure to false. On labels a value after "(P)" or "P/N" is the part number; "(1T)", "(S)" and dates are lot and serial data, not the part number. ` +
            `For the vehicles it fits, use every clue: logos, labels, the numbering scheme and the shape of the part.`,
        },
      ],
    }],
  });
  const found = toolInput(result, 'describe_part');
  // Order of trust: the part number first, then barcodes / QR codes, then the look of the part.
  const seen = text(found.title, 120);
  const number = text(found.oem, 60);
  // Every other code on the part: read by the phone from barcodes and QR codes, or printed on the labels.
  const scanned = (Array.isArray(body.codes) ? body.codes : []).map((c: unknown) => text(c, 120));
  const printed = (Array.isArray(found.codes) ? found.codes : []).map((c: unknown) => text(c, 60));
  const others = partCodes([...scanned, ...printed], number).slice(0, 5);
  // One search over all of them: the part number first; with no part number, the first code stands in for it.
  const main = number || others[0] || '';
  const all = await lookupNumber(main, seen, body.lang, text(found.fits, 200), others.filter((c) => c !== main));
  // Vehicles and years found by the part's name when no page showed any code: used for the fit only.
  const byName = all.find((c) => !c.exact)?.fits ?? '';
  const candidates = all.filter((c) => c.exact);
  const viaNumber = !!number && candidates.length > 0 && (!candidates[0].matched || bare(candidates[0].matched) === bare(number) || bare(number).startsWith(bare(candidates[0].matched)));
  const source: 'number' | 'code' | 'photo' = candidates.length === 0 ? 'photo' : viaNumber ? 'number' : 'code';
  const best = candidates[0];
  // The look of the part is checked every time: a label can be swapped onto another part.
  const check = best ? await looksRight(photos, candidates.map((c) => c.title), body.lang) : { verdicts: [], note: '' };
  const appearance = best ? check.verdicts[0] ?? 'unsure' : 'unsure';
  // Everything else the seller may choose from: other readings of the number, and what the photo alone suggested.
  const alternatives: Json[] = candidates.slice(1).map((c) => ({ title: c.title, fits: c.fits, from: source }));
  if (best && seen && !sameText(seen, best.title)) alternatives.push({ title: seen, fits: text(found.fits, 200), from: 'photo' });
  return {
    title: best?.title || seen,
    oem: number,
    number_unsure: !!number && found.oem_sure !== true,
    codes: others,
    fits: best?.fits || byName || text(found.fits, 200),
    by_number: !!best,
    source,
    appearance,
    appearance_note: appearance === 'match' ? '' : check.note,
    alternatives,
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

/** A rough postage estimate: typical weight and packed size of this part, and what carriers charge between the two countries. */
async function shipping(body: Json): Promise<Json> {
  const title = text(body.title, 120);
  const oem = text(body.oem, 60);
  const from = /^[A-Z]{2}$/.test(body.from ?? '') ? body.from : '';
  const to = /^[A-Z]{2}$/.test(body.to ?? '') ? body.to : '';
  if ((!title && !oem) || !from || !to) return { error: 'nothing_to_search' };

  const result = await claude({
    model: SEARCH_MODEL,
    max_tokens: 3000,
    tools: [
      { type: 'web_search_20250305', name: 'web_search', max_uses: 4 },
      {
        name: 'report_shipping',
        description: 'Reports the estimated parcel and postage cost. Call it once, after searching.',
        input_schema: {
          type: 'object',
          properties: {
            found: { type: 'boolean', description: 'true whenever you can give an estimate (from carrier pages found or, failing that, from typical published tariffs); false only if the part cannot be identified at all.' },
            confirmed: { type: 'boolean', description: 'true if the prices come from carrier or post pages returned by the search; false if they are your estimate from typical tariffs.' },
            weight_kg: { type: 'number', description: 'Estimated weight of the packed part in kg.' },
            size_cm: { type: 'string', description: 'Estimated packed size, e.g. "60 x 40 x 30".' },
            low: { type: 'number', description: 'Cheapest suitable service in EUR.' },
            high: { type: 'number', description: 'Dearest reasonable service in EUR (e.g. courier to the door).' },
            note: { type: 'string', description: `Two sentences at most in ${language(body.lang)}: which carriers and services the prices are for, and what the estimate assumes.` },
            sources: {
              type: 'array',
              items: { type: 'object', properties: { title: { type: 'string' }, url: { type: 'string' } }, required: ['title', 'url'] },
              description: 'Carrier or post price pages used (at most 4). Only pages returned by the search.',
            },
          },
          required: ['found', 'confirmed', 'note', 'sources'],
        },
      },
    ],
    messages: [{
      role: 'user',
      content:
        `A vehicle part is to be sent as a parcel.\nPart: ${title || '(no title)'}\nPart number: ${oem || '(unknown)'}\nFits: ${text(body.fits, 200) || '(unknown)'}\n` +
        `From country: ${from}\nTo country: ${to}\n\n` +
        `First estimate the weight and packed size of this part (search for the part if you are unsure). Then search for current parcel prices for that weight and size ` +
        `from ${from} to ${to}: the national post of ${from} and parcel carriers or parcel lockers that serve this route. Prices in EUR. ` +
        `If the search gives no usable price page, still give your best estimate from the typical tariffs of these carriers for that weight and size, set confirmed to false and say in the note that the price was not confirmed online. ` +
        `The buyer needs a rough figure, so always give low and high unless the part cannot be identified at all. Then call the report_shipping tool exactly once (do not answer in plain text).`,
    }],
  });
  const blocks: Json[] = result.content ?? [];
  const found = toolInput(result, 'report_shipping');
  console.log('ai shipping', from, to, result.stop_reason, JSON.stringify(found).slice(0, 300));
  if (found.found !== true || !(Number(found.low) > 0)) return { found: false, note: text(found.note, 400) };
  const seen = new Set<string>();
  for (const block of blocks) {
    if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) block.content.forEach((r: Json) => r.url && seen.add(r.url));
  }
  const low = Number(found.low);
  return {
    found: true,
    confirmed: found.confirmed === true,
    low,
    high: Number(found.high) >= low ? Number(found.high) : low,
    weight_kg: Number(found.weight_kg) > 0 ? Number(found.weight_kg) : null,
    size_cm: text(found.size_cm, 40),
    note: text(found.note, 400),
    sources: (Array.isArray(found.sources) ? found.sources : [])
      .filter((s: Json) => typeof s.url === 'string' && seen.has(s.url))
      .slice(0, 4)
      .map((s: Json) => ({ title: text(s.title, 120), url: s.url })),
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
  const candidates = (await lookupNumber(text(found.oem, 60), text(found.title, 120), body.lang, text(found.fits, 200))).filter((c) => c.exact);
  const byNumber = candidates[0]?.fits ?? '';
  if (byNumber) notes.push(body.lang && body.lang !== 'lt' ? 'Fitment was chosen by the part number from public sources – please check it.' : 'Tinkamumas parinktas pagal dalies numerį iš viešų šaltinių – patikrinkite.');
  if (candidates[0] && !sameText(candidates[0].title, text(found.title, 120))) {
    notes.push(`${body.lang && body.lang !== 'lt' ? 'By the part number, sources call this part' : 'Pagal dalies numerį šaltiniai šią dalį vadina'}: ${candidates.map((c) => c.title).join(' / ')}`);
  }
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
  if (!['recognize', 'labels', 'price', 'match', 'improve', 'shipping'].includes(body.action)) return reply({ error: 'bad_request' });

  const { data: used } = await admin.rpc('ai_use', { p_user: who.user.id, p_limit: DAILY_LIMIT });
  if (used === false) return reply({ error: 'daily_limit' });

  try {
    if (body.action === 'labels') return reply(await labels(body));
    if (body.action === 'match') return reply(await match(body, admin));
    if (body.action === 'improve') return reply(await improve(body, admin, who.user.id));
    if (body.action === 'shipping') return reply(await shipping(body));
    return reply(body.action === 'recognize' ? await recognize(body) : await price(body));
  } catch (error) {
    console.error('ai failed', body.action, (error as Error).message);
    return reply({ error: 'ai_error', detail: (error as Error).message });
  }
});
