// Sends an e-mail to the other person in a chat: "you have a new message".
// Called by the app right after a message or an offer is sent.
//
// Safe by design:
// - only a signed-in participant of the thread can trigger it;
// - the e-mail never contains the message text, only the listing title and a link;
// - at most one e-mail per thread and recipient every 30 minutes;
// - nothing is sent if either person has blocked the other;
// - does nothing until BREVO_API_KEY or RESEND_API_KEY is set in the project's Edge Function secrets.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function key(dictionaryName: string, legacyName: string): string {
  try {
    const dictionary = JSON.parse(Deno.env.get(dictionaryName) ?? '{}');
    if (dictionary.default) return dictionary.default;
  } catch (_) {
    // fall through to the legacy key
  }
  return Deno.env.get(legacyName) ?? '';
}

function reply(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

const THROTTLE_MINUTES = 30;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);

  const authorization = req.headers.get('Authorization') ?? '';
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const asUser = createClient(url, key('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
  });
  const { data: who } = await asUser.auth.getUser();
  if (!who?.user) return reply({ error: 'not_authenticated' }, 401);

  let threadId = '';
  try {
    threadId = String((await req.json()).thread_id ?? '');
  } catch (_) {
    return reply({ error: 'bad_request' }, 400);
  }
  if (!/^[0-9a-f-]{36}$/i.test(threadId)) return reply({ error: 'bad_request' }, 400);

  // Read the thread with the caller's own rights: only participants can see it.
  const { data: thread } = await asUser.from('threads').select('id, listing_id, buyer_id, seller_id').eq('id', threadId).maybeSingle();
  if (!thread) return reply({ error: 'not_a_participant' }, 403);
  const recipientId = thread.buyer_id === who.user.id ? thread.seller_id : thread.buyer_id;

  const admin = createClient(url, key('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'));

  const { data: blocks } = await admin
    .from('blocks')
    .select('blocker_id')
    .or(`and(blocker_id.eq.${who.user.id},blocked_id.eq.${recipientId}),and(blocker_id.eq.${recipientId},blocked_id.eq.${who.user.id})`)
    .limit(1);
  if (blocks && blocks.length > 0) return reply({ skipped: 'blocked' });

  const { data: last } = await admin.from('notification_log').select('sent_at').eq('thread_id', threadId).eq('recipient_id', recipientId).maybeSingle();
  if (last && Date.now() - new Date(last.sent_at).getTime() < THROTTLE_MINUTES * 60_000) return reply({ skipped: 'recent' });

  // Either provider works; whichever key is set in the Edge Function secrets is used.
  const brevoKey = Deno.env.get('BREVO_API_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!brevoKey && !resendKey) return reply({ skipped: 'not_configured' });

  const { data: recipient } = await admin.auth.admin.getUserById(recipientId);
  const email = recipient?.user?.email;
  if (!email) return reply({ skipped: 'no_email' });

  const { data: listing } = await admin.from('listings').select('title').eq('id', thread.listing_id).maybeSingle();
  const title = listing?.title ?? 'skelbimą';
  const site = Deno.env.get('SITE_URL') ?? 'https://partaza.eu';
  const link = `${site}/chat/${threadId}`;
  const text = `Sveiki,\n\ngavote naują žinutę apie „${title}“.\n\nPerskaityti ir atsakyti: ${link}\n\nŠis laiškas išsiųstas automatiškai. Apie tą patį pokalbį primename ne dažniau kaip kas ${THROTTLE_MINUTES} minučių.\n\nPartaza`;

  const fromName = Deno.env.get('MAIL_FROM_NAME') ?? 'Partaza';
  const fromEmail = Deno.env.get('MAIL_FROM_EMAIL') ?? 'pranesimai@partaza.eu';
  const subject = `Nauja žinutė apie „${title}“`;
  const sent = brevoKey
    ? await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': brevoKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ sender: { name: fromName, email: fromEmail }, to: [{ email }], subject, textContent: text }),
      })
    : await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to: [email], subject, text }),
      });
  if (!sent.ok) return reply({ error: 'mail_failed', status: sent.status }, 502);

  await admin.from('notification_log').upsert({ thread_id: threadId, recipient_id: recipientId, sent_at: new Date().toISOString() });
  return reply({ sent: true });
});
