import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Field, Muted, Notice, Page, Row } from '@/components/ui';
import { type OrderStep, useStore } from '@/store';
import { colors, money } from '@/theme';
import { PAID_ORDER_LABELS, type PaidOrder } from '@/types';
import { Text } from '@/components/Text';

function date(value: number | null): string {
  return value ? new Date(value).toLocaleDateString('lt-LT') : '';
}

function addressLines(order: PaidOrder): string[] {
  const to = order.shipTo;
  if (!to) return [];
  const a = to.address;
  return [
    to.name ?? '',
    a ? [a.line1, a.line2].filter(Boolean).join(', ') : '',
    a ? [a.postal_code, a.city, a.country].filter(Boolean).join(' ') : '',
    to.phone ? `Tel. ${to.phone}` : '',
  ].filter(Boolean);
}

export default function OrderScreen() {
  const { id, paid } = useLocalSearchParams<{ id: string; paid?: string }>();
  const router = useRouter();
  const { paidOrderById, userById, me, ready, registered, syncOrder, orderStep, openThread } = useStore();
  const order = paidOrderById(id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [tracking, setTracking] = useState('');
  const [reason, setReason] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const asked = useRef(false);
  const [now] = useState(() => Date.now());

  // Coming back from the payment page: ask the server to confirm the payment right away
  // instead of waiting for the payment provider's own notification.
  const status = order?.status;
  useEffect(() => {
    if (!ready || !registered || asked.current) return;
    if (status ? status !== 'pending' : !paid) return;
    asked.current = true;
    syncOrder(id).finally(() => setChecked(true));
  }, [ready, registered, status, paid, id, syncOrder]);

  if (!order) {
    return (
      <Page>
        <Muted>{!ready || (paid && !checked) ? 'Kraunama…' : registered ? 'Šio užsakymo neberandame.' : 'Norėdami matyti užsakymą, prisijunkite.'}</Muted>
        {ready && !registered ? <Button label="Prisijungti" onPress={() => router.push('/register')} /> : null}
      </Page>
    );
  }

  const buyer = order.buyerId === me.id;
  const other = userById(buyer ? order.sellerId : order.buyerId);
  const pickup = order.delivery === 'pickup';
  const payout = Math.round((order.itemAmount + order.shippingAmount) * 100) / 100;

  const run = async (step: OrderStep, text?: string, done?: string) => {
    setBusy(true);
    const problem = await orderStep(order.id, step, text);
    setBusy(false);
    setError(problem ?? '');
    if (!problem) {
      setNote(done ?? '');
      setReason(null);
    }
  };

  const chat = async () => {
    if (!order.listingId || !buyer) return router.push('/messages');
    const opened = await openThread(order.listingId);
    router.push(opened.id ? `/chat/${opened.id}` : '/messages');
  };

  const explain: Record<PaidOrder['status'], string> = {
    pending: 'Mokėjimas dar nepatvirtintas. Jei ką tik sumokėjote, palaukite kelias sekundes.',
    paid: buyer
      ? `Apmokėta. Pinigai laikomi, kol gausite dalį. Pardavėjas turi ją ${pickup ? 'perduoti' : 'išsiųsti'}; jei to nepadarys per 7 dienas, galėsite atšaukti ir atgauti pinigus.`
      : `Pirkėjas sumokėjo. ${pickup ? 'Susitarkite dėl atsiėmimo ir perdavę dalį pažymėkite tai čia.' : 'Išsiųskite dalį žemiau nurodytu adresu ir pažymėkite tai čia.'} Pinigus gausite, kai pirkėjas patvirtins gavimą.`,
    shipped: buyer
      ? `Pardavėjas pažymėjo, kad dalį ${pickup ? 'perdavė' : 'išsiuntė'}. Kai gausite, paspauskite „Gavau“ – tada turėsite 5 dienas jai patikrinti.${order.releaseAt ? ` Jei nieko nepažymėsite, ${date(order.releaseAt)} pinigai bus pervesti pardavėjui.` : ''}`
      : `Laukiame, kol pirkėjas patvirtins gavimą.${order.releaseAt ? ` Jei jis nieko nepažymės, pinigai jums bus pervesti ${date(order.releaseAt)}.` : ''}`,
    received: buyer
      ? `Patikrinkite dalį. Jei viskas gerai – patvirtinkite, ir pardavėjas gaus pinigus. Jei ne – praneškite apie problemą iki ${date(order.releaseAt)}; vėliau pinigai bus pervesti savaime.`
      : `Pirkėjas dalį gavo ir tikrina. Pinigai jums bus pervesti, kai jis patvirtins, arba savaime ${date(order.releaseAt)}.`,
    completed: buyer ? 'Užsakymas užbaigtas, pinigai pervesti pardavėjui.' : 'Užsakymas užbaigtas. Pinigai pervesti į jūsų „Stripe“ paskyrą ir iš jos išmokami į banko sąskaitą.',
    disputed: 'Pranešta apie problemą. Pinigai sulaikyti, kol Partaza administratorius išnagrinės situaciją ir susisieks su abiem pusėmis.',
    refunded: buyer ? 'Pinigai grąžinti į jūsų mokėjimo priemonę. Bankas juos įskaito per 5–10 dienų.' : 'Užsakymas atšauktas, pinigai grąžinti pirkėjui. Skelbimas vėl aktyvus.',
    cancelled: 'Mokėjimas neįvyko, užsakymas atšauktas.',
  };

  const late = order.status === 'paid' && order.paidAt !== null && now - order.paidAt > 7 * 86400000;
  const lines = addressLines(order);

  return (
    <Page>
      <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '600', color: colors.ink }}>{order.title}</Text>
      <Muted>{buyer ? 'Pardavėjas' : 'Pirkėjas'}: {other.name}</Muted>
      <Notice tone={order.status === 'disputed' || order.status === 'cancelled' ? 'warn' : 'ok'}>
        {PAID_ORDER_LABELS[order.status]}. {explain[order.status]}
      </Notice>
      {note ? <Notice>{note}</Notice> : null}

      <Card style={{ gap: 0 }}>
        <Row label="Dalis" value={money(order.itemAmount)} />
        <Row label={pickup ? 'Atsiėmimas' : 'Pristatymas'} value={pickup ? 'nemokamai' : money(order.shippingAmount)} />
        {order.feeAmount > 0 ? <Row label="Pirkėjo apsauga ir administravimas" value={money(order.feeAmount)} /> : null}
        <Row label={buyer ? 'Sumokėta' : 'Pirkėjas sumokėjo'} value={money(order.total)} />
        {buyer ? null : <Row label="Jums bus pervesta" value={money(payout)} strong />}
        {order.paidAt ? <Row label="Apmokėta" value={date(order.paidAt)} /> : null}
        {order.shippedAt ? <Row label={pickup ? 'Perduota' : 'Išsiųsta'} value={date(order.shippedAt)} /> : null}
        {order.tracking ? <Row label="Siuntos numeris" value={order.tracking} /> : null}
        {order.receivedAt ? <Row label="Gauta" value={date(order.receivedAt)} /> : null}
      </Card>

      {lines.length > 0 && order.status !== 'pending' ? (
        <Card>
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.ink }}>{pickup ? 'Pirkėjo kontaktai' : 'Pristatymo adresas'}</Text>
          {lines.map((line) => (
            <Text key={line} style={{ fontSize: 14, color: colors.ink }}>{line}</Text>
          ))}
        </Card>
      ) : null}

      {order.disputeReason ? (
        <Card>
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.ink }}>Pirkėjo aprašyta problema</Text>
          <Text style={{ fontSize: 14, lineHeight: 20, color: colors.ink }}>{order.disputeReason}</Text>
        </Card>
      ) : null}

      {!buyer && order.status === 'paid' ? (
        <Card>
          {pickup ? null : <Field label="Siuntos numeris (nebūtina)" value={tracking} onChangeText={setTracking} placeholder="pvz., LP paštomato ar kurjerio numeris" />}
          <Button label={pickup ? 'Perdaviau dalį pirkėjui' : 'Išsiunčiau'} disabled={busy} onPress={() => run('ship', tracking)} />
          <Button label="Negaliu parduoti – grąžinti pinigus pirkėjui" kind="quiet" disabled={busy} onPress={() => run('cancel')} />
        </Card>
      ) : null}

      {buyer && order.status === 'shipped' ? <Button label="Gavau dalį" disabled={busy} onPress={() => run('received')} /> : null}
      {buyer && (order.status === 'shipped' || order.status === 'received') ? (
        <Button
          label="Viskas gerai – pervesti pinigus pardavėjui"
          kind={order.status === 'received' ? 'primary' : 'outline'}
          disabled={busy}
          onPress={() => run('confirm', undefined, 'Ačiū! Pinigai pervedami pardavėjui.')}
        />
      ) : null}
      {buyer && late ? <Button label="Pardavėjas neišsiuntė – atšaukti ir atgauti pinigus" kind="outline" disabled={busy} onPress={() => run('cancel')} /> : null}

      {buyer && ['paid', 'shipped', 'received'].includes(order.status) ? (
        reason === null ? (
          <Button label="Pranešti apie problemą" kind="quiet" onPress={() => setReason('')} />
        ) : (
          <Card>
            <Field
              label="Kas negerai?"
              hint="Aprašykite: dalis negauta, neatitinka skelbimo, sugadinta ir pan. Pinigai bus sulaikyti, kol situaciją išnagrinės administratorius."
              value={reason}
              onChangeText={setReason}
              multiline
              style={{ minHeight: 90, textAlignVertical: 'top' }}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button label="Atšaukti" kind="outline" onPress={() => setReason(null)} style={{ flex: 1 }} />
              <Button label="Siųsti" kind="dark" disabled={busy} onPress={() => run('dispute', reason)} style={{ flex: 1 }} />
            </View>
          </Card>
        )
      ) : null}

      {error ? <Notice tone="warn">{error}</Notice> : null}
      <Button label={buyer ? 'Rašyti pardavėjui' : 'Žinutės'} kind="outline" onPress={chat} />
    </Page>
  );
}
