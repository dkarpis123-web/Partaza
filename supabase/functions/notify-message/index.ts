// Sends an e-mail to the other person in a chat: "you have a new message".
// Called by the app right after a message or an offer is sent.
//
// Safe by design:
// - only a signed-in participant of the thread can trigger it;
// - the e-mail never contains the message text, only the listing title and a link;
// - it is wholly Lithuanian, or English for a recipient who chose another language in the app;
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
  // Wholly Lithuanian, or English for anyone who chose another language in the app.
  const english = typeof recipient?.user?.user_metadata?.lang === 'string' && recipient.user.user_metadata.lang !== 'lt';
  const title = listing?.title ?? (english ? 'your listing' : 'skelbimą');
  const site = Deno.env.get('SITE_URL') ?? 'https://partaza.eu';
  const link = `${site}/chat/${threadId}`;
  const words = english
    ? { subject: `New message about “${title}” – Partaza`, heading: 'You have a new message', body: `Someone wrote to you about “${title}” on Partaza.`, button: 'Read and reply', note: `This e-mail was sent automatically. For the same conversation we remind you at most once every ${THROTTLE_MINUTES} minutes.`, footer: 'Partaza – marketplace for new and used vehicle parts · MB „Sintela“, company code 304127980, Brastos g. 7/4, Kaunas, Lithuania', hello: 'Hello,' }
    : { subject: `Nauja žinutė apie „${title}“ – Partaza`, heading: 'Gavote naują žinutę', body: `Jums parašė dėl „${title}“ „Partaza“ platformoje.`, button: 'Skaityti ir atsakyti', note: `Šis laiškas išsiųstas automatiškai. Apie tą patį pokalbį primename ne dažniau kaip kas ${THROTTLE_MINUTES} minučių.`, footer: 'Partaza – naujų ir naudotų transporto dalių rinka · MB „Sintela“, į. k. 304127980, Brastos g. 7/4, Kaunas, Lietuva', hello: 'Sveiki,' };
  const text = `${words.hello}\n\n${words.body}\n\n${words.button}: ${link}\n\n${words.note}\n\n${words.footer}`;
  const escape = (value: string) => value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:Arial,Helvetica,sans-serif;color:#15181C;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:14px;border:1px solid #DDE1E6;">
<tr><td style="padding:24px 28px 8px 28px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td><img src="${site}/logo192.png" width="40" height="40" alt="Partaza" style="display:block;border-radius:10px;"></td>
<td style="padding-left:10px;font-size:22px;font-weight:bold;">Partaza</td></tr></table></td></tr>
<tr><td style="padding:16px 28px 0 28px;">
<h1 style="margin:0 0 12px 0;font-size:20px;line-height:1.3;">${escape(words.heading)}</h1>
<p style="margin:0 0 20px 0;font-size:15px;line-height:1.5;">${escape(words.body)}</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:#C2410C;">
<a href="${link}" style="display:inline-block;padding:13px 22px;font-size:16px;font-weight:bold;color:#FFFFFF;text-decoration:none;border-radius:10px;">${escape(words.button)}</a></td></tr></table>
<p style="margin:16px 0 0 0;font-size:13px;line-height:1.5;color:#5B6470;">${escape(words.note)}</p></td></tr>
<tr><td style="padding:24px 28px;font-size:12px;line-height:1.5;color:#5B6470;">${escape(words.footer)}</td></tr>
</table></td></tr></table></body></html>`;

  const fromName = Deno.env.get('MAIL_FROM_NAME') ?? 'Partaza';
  const fromEmail = Deno.env.get('MAIL_FROM_EMAIL') ?? 'pranesimai@partaza.eu';
  const subject = words.subject;
  const sent = brevoKey
    ? await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': brevoKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ sender: { name: fromName, email: fromEmail }, to: [{ email }], subject, textContent: text, htmlContent: html }),
      })
    : await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to: [email], subject, text, html }),
      });
  if (!sent.ok) return reply({ error: 'mail_failed', status: sent.status }, 502);

  await admin.from('notification_log').upsert({ thread_id: threadId, recipient_id: recipientId, sent_at: new Date().toISOString() });
  return reply({ sent: true });
});
