import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { ReviewBox } from '@/components/ReviewBox';
import { Button, Card, Heading, Muted, Notice, Page, Row } from '@/components/ui';
import { useStore } from '@/store';
import { colors, money } from '@/theme';
import type { Order } from '@/types';
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

export default function OrdersScreen() {
  const router = useRouter();
  const { orders, me, userById, orderAction, registered, ready } = useStore();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const act = async (orderId: string, action: 'cancel' | 'hand' | 'complete') => {
    setBusy(orderId);
    const problem = await orderAction(orderId, action);
    setBusy('');
    setError(problem ?? '');
  };

  const buying = orders.filter((o) => o.buyerId === me.id);
  const selling = orders.filter((o) => o.sellerId === me.id);

  const card = (order: Order) => {
    const iAmSeller = order.sellerId === me.id;
    const other = userById(iAmSeller ? order.buyerId : order.sellerId);
    const waiting = busy === order.id;
    return (
      <Card key={order.id} style={{ gap: 0 }}>
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

  return (
    <Page>
      <Notice>Mokėjimai per „Partaza“ dar neįjungti. Užsakymas fiksuoja, kas, ką ir už kiek perka; dėl apmokėjimo susitariate tarpusavyje.</Notice>
      {error ? <Notice tone="warn">{error}</Notice> : null}
      {!ready ? <Muted>Kraunama…</Muted> : null}
      {ready && orders.length === 0 ? <Muted>{registered ? 'Užsakymų dar nėra.' : 'Užsakymų dar nėra. Kai ką nors pirksite arba parduosite, jie atsiras čia.'}</Muted> : null}
      {buying.length > 0 ? <Heading>Perku ({buying.length})</Heading> : null}
      {buying.map(card)}
      {selling.length > 0 ? <Heading>Parduodu ({selling.length})</Heading> : null}
      {selling.map(card)}
    </Page>
  );
}
