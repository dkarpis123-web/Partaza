import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, Muted, Notice } from '@/components/ui';
import { useStore } from '@/store';
import { MAX_WIDTH, colors, money, radius } from '@/theme';
import { PAID_ORDER_LABELS, type Message } from '@/types';
import { Text, TextInput } from '@/components/Text';

const STATUS_TEXT: Record<NonNullable<Message['status']>, string> = {
  pending: 'Laukia atsakymo',
  accepted: 'Priimta',
  declined: 'Atmesta',
  countered: 'Pateiktas kitas pasiūlymas',
};

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { listingById, userById, threadById, me, live, ready, sendText, answerOffer, blockUser, markRead, payReady, paidOrders } = useStore();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const thread = threadById(id);
  const messageCount = thread?.messages.length ?? 0;
  // Opening the chat, or receiving a message while it is open, counts as reading it.
  useEffect(() => {
    if (messageCount > 0) markRead(id);
  }, [id, messageCount, markRead]);
  const listing = thread ? listingById(thread.listingId) : undefined;

  if (!thread || !listing) {
    return (
      <View style={{ padding: 16 }}>
        <Muted>{ready ? 'Šio pokalbio neberandame.' : 'Kraunama…'}</Muted>
      </View>
    );
  }

  const iAmSeller = thread.sellerId === me.id;
  const other = userById(iAmSeller ? thread.buyerId : thread.sellerId);
  const messages = thread.messages;
  const accepted = [...messages].reverse().find((m) => m.kind === 'offer' && m.status === 'accepted');
  const canPay = live && (listing.status ?? 'active') === 'active' && payReady.includes(thread.sellerId);
  const order = paidOrders.find((o) => o.listingId === listing.id && o.buyerId === thread.buyerId && o.status !== 'refunded');

  const run = async (action: Promise<string | null>) => {
    setBusy(true);
    const problem = await action;
    setBusy(false);
    setError(problem ?? '');
    return problem === null;
  };

  const send = async () => {
    const value = text.trim();
    if (!value || busy) return;
    if (await run(sendText(thread.id, value))) setText('');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: MAX_WIDTH }}>
        <View style={{ padding: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 2 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.ink }}>{other.name}{iAmSeller ? ' · pirkėjas' : ''}</Text>
          <Text style={{ fontSize: 13, color: colors.muted }}>{listing.title} · {money(listing.price)}</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {messages.length === 0 ? <Muted>{iAmSeller ? 'Pirkėjas dar nieko neparašė.' : 'Parašykite pardavėjui arba pasiūlykite savo kainą.'}</Muted> : null}
          {messages.map((m) => {
            const mine = m.senderId === me.id;
            if (m.kind === 'text') {
              return (
                <View
                  key={m.id}
                  style={{
                    alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: 300, padding: 12, borderRadius: 16,
                    backgroundColor: mine ? colors.ink : colors.surface, borderWidth: mine ? 0 : 1, borderColor: colors.border,
                  }}>
                  <Text style={{ fontSize: 14, lineHeight: 20, color: mine ? '#FFFFFF' : colors.ink }}>{m.text}</Text>
                </View>
              );
            }
            const canAnswer = !mine && m.status === 'pending';
            return (
              <View
                key={m.id}
                style={{
                  alignSelf: mine ? 'flex-end' : 'flex-start', width: 290, maxWidth: '100%', padding: 14, borderRadius: 16, gap: 8,
                  backgroundColor: mine ? colors.ink : colors.surface,
                  borderWidth: mine ? 0 : 2, borderColor: colors.accent,
                }}>
                <Text style={{ fontSize: 12, color: mine ? '#C9CED6' : colors.muted }}>{mine ? 'Jūsų pasiūlymas' : m.senderId === thread.sellerId ? 'Pardavėjo pasiūlymas' : 'Pirkėjo pasiūlymas'}</Text>
                <Text style={{ fontSize: 26, fontWeight: '700', color: mine ? '#FFFFFF' : colors.ink }}>{money(m.amount ?? 0)}</Text>
                {m.text ? <Text style={{ fontSize: 14, color: mine ? '#FFFFFF' : colors.ink }}>{m.text}</Text> : null}
                {m.status ? <Text style={{ fontSize: 12, fontWeight: '600', color: mine ? '#C9CED6' : colors.muted }}>{STATUS_TEXT[m.status]}</Text> : null}
                {canAnswer ? (
                  <View style={{ gap: 8 }}>
                    <Button
                      label={`Priimti ${money(m.amount ?? 0)}`}
                      disabled={busy}
                      onPress={() => run(answerOffer(thread.id, m.id, 'accepted'))}
                    />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Button label="Siūlyti kitą" kind="outline" onPress={() => router.push(`/offer/${listing.id}?thread=${thread.id}`)} style={{ flex: 1 }} />
                      <Button
                        label="Atmesti"
                        kind="outline"
                        disabled={busy}
                        onPress={() => run(answerOffer(thread.id, m.id, 'declined'))}
                        style={{ flex: 1 }}
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
          {order ? (
            <Button label={`Užsakymas: ${PAID_ORDER_LABELS[order.status].toLowerCase()}`} kind="outline" onPress={() => router.push(`/payment/${order.id}`)} />
          ) : accepted ? (
            canPay ? (
              iAmSeller ? (
                <Notice>Sutarta kaina: {money(accepted.amount ?? 0)}. Pirkėjas gali ją apmokėti per Partaza – apmokėtas užsakymas atsiras čia ir skiltyje „Profilis“.</Notice>
              ) : (
                <>
                  <Notice>Sutarta kaina: {money(accepted.amount ?? 0)}. Sumokėkite per Partaza – pardavėjas pinigus gaus tik jums patvirtinus, kad dalį gavote.</Notice>
                  <Button label={`Apmokėti ${money(accepted.amount ?? 0)}`} onPress={() => router.push(`/buy/${listing.id}`)} />
                </>
              )
            ) : (
              <Notice>Sutarta kaina: {money(accepted.amount ?? 0)}. Pardavėjas mokėjimų per Partaza dar nepriima, todėl dėl atsiskaitymo ir atsiėmimo susitarkite žinutėmis.</Notice>
            )
          ) : null}
          {error ? <Notice tone="warn">{error}</Notice> : null}
          {live ? null : <Muted>Bandomasis režimas: pokalbis lieka tik šiame įrenginyje.</Muted>}
          <Button
            label={`Blokuoti „${other.name}“`}
            kind="quiet"
            onPress={async () => {
              const problem = await blockUser(other.id);
              if (problem) return setError(problem);
              router.back();
            }}
          />
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: 8, padding: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
          <TextInput
            accessibilityLabel="Žinutė"
            placeholder="Rašyti žinutę"
            placeholderTextColor={colors.muted}
            value={text}
            onChangeText={setText}
            onSubmitEditing={send}
            style={{ flex: 1, minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, backgroundColor: colors.bg, fontSize: 15, color: colors.ink }}
          />
          <Button label="Siųsti" kind="dark" onPress={send} disabled={!text.trim() || busy} />
        </View>
      </View>
    </View>
  );
}
