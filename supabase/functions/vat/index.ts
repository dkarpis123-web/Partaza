// Checks a seller's VAT number in the EU's official register (VIES) and, if it is valid and is
// registered to the same name as the seller's account, records it. Only then may the seller mark
// listings as "price includes VAT". { action: 'check', code } or { action: 'remove' }.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

// deno-lint-ignore no-explicit-any
type Json = Record<string, any>;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: Json) => new Response(JSON.stringify(body), { headers: { ...cors, 'Content-Type': 'application/json' } });

function secret(dictionaryName: string, legacyName: string): string {
  try {
    const dictionary = JSON.parse(Deno.env.get(dictionaryName) ?? '{}');
    if (dictionary.default) return dictionary.default;
  } catch (_) {
    // fall through to the legacy key
  }
  return Deno.env.get(legacyName) ?? '';
}

/** Words of a name without legal forms, punctuation and accents: "UAB „Dalių centras“" → ["daliu", "centras"]. */
function words(name: string): string[] {
  const forms = new Set(['uab', 'mb', 'ab', 'ii', 'vsi', 'tub', 'kub', 'sia', 'ou', 'as', 'gmbh', 'ag', 'kg', 'ug', 'sp', 'zoo', 'z', 'o', 'sa', 'srl', 'sro', 'ltd', 'limited', 'oy', 'aps', 'bv', 'nv', 'sarl', 'sas', 'ek', 'ik', 'uzdaroji', 'akcine', 'bendrove', 'mazoji', 'bendrija', 'individuali', 'imone']);
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w.length > 0 && !forms.has(w));
}

/** Same name? Every word of the shorter name must appear in the longer one (order and legal form do not matter). */
function sameName(a: string, b: string): boolean {
  const first = words(a);
  const second = words(b);
  if (first.length === 0 || second.length === 0) return false;
  const [short, long] = first.length <= second.length ? [first, second] : [second, first];
  return short.every((w) => long.includes(w));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const admin = createClient(url, secret('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'));
  const asUser = createClient(url, secret('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: who } = await asUser.auth.getUser();
  if (!who?.user) return reply({ error: 'not_authenticated' });

  let body: Json;
  try {
    body = await req.json();
  } catch (_) {
    return reply({ error: 'bad_request' });
  }

  if (body.action === 'remove') {
    await admin.from('seller_vat').delete().eq('user_id', who.user.id);
    return reply({ ok: true });
  }
  if (body.action !== 'check') return reply({ error: 'bad_request' });

  const code = String(body.code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const parts = code.match(/^([A-Z]{2})([A-Z0-9]{2,14})$/);
  if (!parts) return reply({ error: 'bad_format' });

  let answer: Json;
  try {
    const response = await fetch(`https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${parts[1]}/vat/${parts[2]}`);
    answer = await response.json();
  } catch (_) {
    return reply({ error: 'register_unavailable' });
  }
  if (answer.isValid !== true) {
    // "INVALID" means the number does not exist; anything else is the register having a problem.
    return reply({ error: answer.userError === 'INVALID' || answer.userError === 'INVALID_INPUT' ? 'not_valid' : 'register_unavailable' });
  }

  const registered = typeof answer.name === 'string' && answer.name !== '---' && answer.name !== 'N/A' ? answer.name.trim() : '';
  const { data: profile } = await admin.from('profiles').select('name').eq('id', who.user.id).maybeSingle();
  // Some countries do not publish the name; then a valid number is all that can be checked.
  if (registered && !sameName(registered, profile?.name ?? '')) {
    return reply({ error: 'name_mismatch', registered_name: registered });
  }

  const saved = await admin
    .from('seller_vat')
    .upsert({ user_id: who.user.id, vat_code: code, registered_name: registered, verified_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (saved.error) return reply({ error: 'server_error' });
  return reply({ ok: true, vat_code: code, registered_name: registered });
});
