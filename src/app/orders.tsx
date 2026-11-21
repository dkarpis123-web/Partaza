import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { ReviewBox, stars } from '@/components/ReviewBox';
import { Button, Card, Chip, Muted, Notice, Page, Row } from '@/components/ui';
import { tr } from '@/i18n';
import { useStore } from '@/store';
import { colors, money } from '@/theme';
import { type Order, PAID_ORDER_LABELS, type PaidOrder } from '@/types';
import { Text } from '@/components/Text';

const OPEN = ['agreed', 'handed'];

function statusText(order: Order, iAmSeller: boolean): string {
  switch (order.status) {
    case 'agreed':
      return iAmSeller ? 'Pirkėjas patvirtino pirkimą. Susitarkite dėl apmokėjimo ir perdavimo.' : 'Pirkimas patvirtintas. Susitarkite su pardavėju dėl apmokėjimo ir perdavimo.';
    case 'handed':
      return iAmSeller ? 'Pažymėjote, kad dalį perdavėte arba išsiuntėte. Laukiama pirkėjo patvirtinimo.' : 'Pardavėjas pažymėjo, kad dalį perdavė arba išsiuntė. Gavę patvirtinkite.';
    case 'completed':
      return 'Užbaigta: pirkėjas patvirtino, kad dalį gavo.';
    default:
      return 'Atšaukta.';
  }
}

type Tab = 'active' | 'paid' | 'done' | 'returns';
const TABS: { key: Tab; label: string }[] = [
  { key: 'active', label: 'Vykdomi' },
  { key: 'paid', label: 'Apmokėti' },
  { key: 'done', label: 'Įvykdyti' },
  { key: 'returns', label: 'Grąžinimai ir ginčai' },
];

/** Which tab an order belongs to. */
const tabOfOrder = (o: Order): Tab => (OPEN.includes(o.status) ? 'active' : o.status === 'completed' ? 'done' : 'returns');
const tabOfPaid = (o: PaidOrder): Tab =>
  o.status === 'pending' ? 'active' : o.status === 'completed' ? 'done' : ['paid', 'shipped', 'received'].includes(o.status) ? 'paid' : 'returns';

const day = (value: number) => new Date(value).toLocaleDateString('lt-LT');

function Tile({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: '45%', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: strong ? colors.accent : colors.border, backgroundColor: strong ? colors.accentSoft : colors.surface, gap: 2 }}>
      <Text style={{ fontSize: 20, fontWeight: '800', color: colors.ink }}>{value}</Text>
      <Text style={{ fontSize: 12, color: colors.muted }}>{label}</Text>
    </View>
  );
}

/**
 * The buyer's and the seller's control panel: everything bought or sold in one place - what is in
 * progress, what is paid, what is finished and what was returned or disputed - with the next step on each.
 */
export default function OrdersScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const { orders, paidOrders, me, userById, orderAction, registered, ready } = useStore();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [chosenSide, setSide] = useState<'buy' | 'sell' | null>(role === 'sell' ? 'sell' : role === 'buy' ? 'buy' : null);
  const [tab, setTab] = useState<Tab>('active');

  const act = async (orderId: string, action: 'cancel' | 'hand' | 'complete') => {
    setBusy(orderId);
    const problem = await orderAction(orderId, action);
    setBusy('');
    setError(problem ?? '');
    // Follow the order to where it now lives, so the result (and the review box) is in view.
    if (!problem && action !== 'hand') setTab(action === 'complete' ? 'done' : 'returns');
  };

  const sold = orders.some((o) => o.sellerId === me.id) || paidOrders.some((o) => o.sellerId === me.id);
  const bought = orders.some((o) => o.buyerId === me.id) || paidOrders.some((o) => o.buyerId === me.id);
  // Opens on the side that has something in it.
  const side = chosenSide ?? (sold && !bought ? 'sell' : 'buy');
  const selling = side === 'sell';
  const mine = <T extends { buyerId: string; sellerId: string }>(o: T) => (selling ? o.sellerId : o.buyerId) === me.id;
  const myOrders = orders.filter(mine);
  const myPaid = paidOrders.filter(mine);
  const count = (t: Tab) => myOrders.filter((o) => tabOfOrder(o) === t).length + myPaid.filter((o) => tabOfPaid(o) === t).length;
  const payout = (o: PaidOrder) => o.itemAmount + o.shippingAmount;

  const held = myPaid.filter((o) => ['paid', 'shipped', 'received'].includes(o.status));
  const finished = myPaid.filter((o) => o.status === 'completed');
  const finishedDirect = myOrders.filter((o) => o.status === 'completed');
  const tiles = selling
    ? [
        { label: 'Laukia išsiuntimo', value: String(myPaid.filter((o) => o.status === 'paid').length + myOrders.filter((o) => o.status === 'agreed').length), strong: true },
        { label: 'Pinigai kelyje (sulaikyti iki patvirtinimo)', value: money(held.reduce((sum, o) => sum + payout(o), 0)) },
        { label: 'Uždirbta iš įvykdytų', value: money(finished.reduce((sum, o) => sum + payout(o), 0) + finishedDirect.reduce((sum, o) => sum + o.price, 0)) },
        { label: 'Atviri ginčai', value: String(myPaid.filter((o) => o.status === 'disputed').length) },
      ]
    : [
        { label: 'Reikia jūsų patvirtinimo', value: String(myPaid.filter((o) => o.status === 'shipped' || o.status === 'received').length + myOrders.filter((o) => o.status === 'handed').length), strong: true },
        { label: 'Laukia išsiuntimo', value: String(myPaid.filter((o) => o.status === 'paid').length + myOrders.filter((o) => o.status === 'agreed').length) },
        { label: 'Nupirkta dalių', value: String(finished.length + finishedDirect.length) },
        { label: 'Išleista', value: money(finished.reduce((sum, o) => sum + o.total, 0) + finishedDirect.reduce((sum, o) => sum + o.price + (o.shipping ?? 0), 0)) },
      ];

  const card = (order: Order) => {
    const iAmSeller = order.sellerId === me.id;
    const other = userById(iAmSeller ? order.buyerId : order.sellerId);
    const waiting = busy === order.id;
    return (
      <Card key={order.id} style={{ gap: 0 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.muted }}>{`${tr('Susitarimas tiesiogiai')} · ${day(order.createdAt)}`}</Text>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink, marginBottom: 6 }}>{order.title}</Text>
        <Row label="Kaina" value={money(order.price)} strong />
        <Row label="Gavimas" value={order.shipping === null ? 'Atsiėmimas vietoje' : `Siuntimas, ${money(order.shipping)}`} />
        <Row label={iAmSeller ? 'Pirkėjas' : 'Pardavėjas'} value={other.name} />
        <Text style={{ fontSize: 14, lineHeight: 20, color: colors.ink, marginTop: 8 }}>{statusText(order, iAmSeller)}</Text>
        {order.status === 'completed' ? <ReviewBox kind="order" orderId={order.id} subjectIsSeller={!iAmSeller} /> : null}
        <View style={{ gap: 8, marginTop: 10 }}>
          {iAmSeller && order.status === 'agreed' ? <Button label="Pažymėti: perdaviau arba išsiunčiau" disabled={waiting} onPress={() => act(order.id, 'hand')} /> : null}
          {!iAmSeller && OPEN.includes(order.status) ? <Button label="Patvirtinti, kad gavau" disabled={waiting} onPress={() => act(order.id, 'complete')} /> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {order.threadId ? <Button label="Pokalbis" kind="outline" onPress={() => router.push(`/chat/${order.threadId}`)} style={{ flex: 1 }} /> : null}
            {order.status === 'agreed' ? <Button label="Atšaukti užsakymą" kind="outline" disabled={waiting} onPress={() => act(order.id, 'cancel')} style={{ flex: 1 }} /> : null}
          </View>
        </View>
      </Card>
    );
  };

  const paidCard = (order: PaidOrder) => {
    const iAmSeller = order.sellerId === me.id;
    const other = userById(iAmSeller ? order.buyerId : order.sellerId);
    const needsMe = iAmSeller ? order.status === 'paid' || order.status === 'disputed' : order.status === 'shipped' || order.status === 'received';
    return (
      <Card key={order.id} style={{ gap: 0, borderColor: needsMe ? colors.accent : colors.border, borderWidth: needsMe ? 2 : 1 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.muted }}>{`${tr('Apmokėta per „Partaza“')} · ${day(order.paidAt ?? order.createdAt)}`}</Text>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink, marginBottom: 6 }}>{order.title}</Text>
        <Row label="Būsena" value={PAID_ORDER_LABELS[order.status]} strong={order.status === 'disputed'} />
        <Row label={iAmSeller ? 'Gausite' : 'Sumokėta'} value={money(iAmSeller ? payout(order) : order.total)} />
        <Row label="Gavimas" value={order.delivery === 'pickup' ? 'Atsiėmimas vietoje' : `Siuntimas, ${money(order.shippingAmount)}`} />
        <Row label={iAmSeller ? 'Pirkėjas' : 'Pardavėjas'} value={other.name} />
        {order.tracking ? <Row label="Siuntos numeris" value={order.tracking} /> : null}
        {needsMe ? <Text style={{ fontSize: 14, fontWeight: '700', color: colors.accent, marginTop: 8 }}>Laukia jūsų veiksmo</Text> : null}
        <View style={{ marginTop: 10 }}>
          <Button label={order.status === 'completed' ? 'Atidaryti ir palikti atsiliepimą' : 'Atidaryti užsakymą'} kind={needsMe ? 'primary' : 'outline'} onPress={() => router.push(`/payment/${order.id}`)} />
        </View>
      </Card>
    );
  };

  const shownOrders = myOrders.filter((o) => tabOfOrder(o) === tab);
  const shownPaid = myPaid.filter((o) => tabOfPaid(o) === tab);
  const empty: Record<Tab, string> = {
    active: selling ? 'Šiuo metu nėra vykdomų pardavimų.' : 'Šiuo metu nėra vykdomų pirkimų.',
    paid: 'Apmokėtų ir dar neužbaigtų užsakymų nėra.',
    done: 'Įvykdytų užsakymų dar nėra.',
    returns: 'Grąžinimų, ginčų ir atšauktų užsakymų nėra.',
  };

  return (
    <Page>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button label="Perku" kind={selling ? 'outline' : 'dark'} onPress={() => setSide('buy')} style={{ flex: 1 }} />
        <Button label="Parduodu" kind={selling ? 'dark' : 'outline'} onPress={() => setSide('sell')} style={{ flex: 1 }} />
      </View>
      {!ready ? <Muted>Kraunama…</Muted> : null}
      {ready && !registered ? <Muted>Kai ką nors pirksite arba parduosite, užsakymai atsiras čia.</Muted> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {tiles.map((t) => (
          <Tile key={t.label} label={t.label} value={t.value} strong={t.strong && t.value !== '0'} />
        ))}
      </View>
      <Card>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.ink }}>{me.reviews > 0 ? `${stars(Math.round(me.rating))} ${me.rating.toFixed(1).replace('.', ',')} ${tr('iš 5')} (${me.reviews})` : tr('Atsiliepimų apie jus dar nėra')}</Text>
        <Muted>Atsiliepimą galima palikti tik po įvykdyto užsakymo – vertina ir pirkėjas, ir pardavėjas.</Muted>
        {registered ? <Button label="Mano atsiliepimai" kind="outline" onPress={() => router.push(`/seller/${me.id}`)} /> : null}
      </Card>
      {selling ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button label="Pajamos ir pelnas" kind="outline" onPress={() => router.push('/dashboard')} style={{ flex: 1 }} />
          <Button label="Išmokos" kind="outline" onPress={() => router.push('/payouts')} style={{ flex: 1 }} />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {TABS.map((t) => (
          <Chip key={t.key} label={`${tr(t.label)} (${count(t.key)})`} selected={tab === t.key} onPress={() => setTab(t.key)} />
        ))}
      </View>
      {error ? <Notice tone="warn">{error}</Notice> : null}
      {shownPaid.map(paidCard)}
      {shownOrders.map(card)}
      {ready && shownPaid.length + shownOrders.length === 0 ? <Muted>{empty[tab]}</Muted> : null}
    </Page>
  );
}
