import { Link } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { BlockedUsers } from '@/components/BlockedUsers';
import { Button, Heading, Muted, Notice, Page } from '@/components/ui';
import { useStore } from '@/store';
import { colors, money, radius } from '@/theme';
import { Text } from '@/components/Text';

export default function MessagesScreen() {
  const { threads, listingById, userById, me, unreadThreadIds, answerOffer, markRead } = useStore();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const answer = async (threadId: string, messageId: string, status: 'accepted' | 'declined') => {
    setBusy(messageId);
    const problem = await answerOffer(threadId, messageId, status);
    setBusy('');
    setError(problem ?? '');
    if (!problem) markRead(threadId);
  };

  return (
    <Page>
      <Heading>Žinutės ir derybos</Heading>
      <BlockedUsers />
      {error ? <Notice tone="warn">{error}</Notice> : null}
      {threads.length === 0 ? (
        <Muted>Pokalbių dar nėra. Atidarykite skelbimą ir parašykite pardavėjui arba pasiūlykite savo kainą.</Muted>
      ) : null}
      {threads.map((thread) => {
        const listing = listingById(thread.listingId);
        if (!listing) return null;
        const last = thread.messages[thread.messages.length - 1];
        const unread = unreadThreadIds.includes(thread.id);
        const preview = !last
          ? 'Pokalbis pradėtas'
          : last.kind === 'offer'
            ? `${last.senderId === me.id ? 'Jūsų pasiūlymas' : 'Gautas pasiūlymas'}: ${money(last.amount ?? 0)}`
            : last.text ?? '';
        // An offer from the other person that still waits for my answer can be answered right here.
        const waiting = thread.messages.find((m) => m.kind === 'offer' && m.status === 'pending' && m.senderId !== me.id);
        return (
          <View key={thread.id} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden' }}>
            <Link href={`/chat/${thread.id}`} asChild>
              <Pressable accessibilityRole="link" style={{ padding: 14, gap: 4 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.ink }}>{userById(thread.sellerId === me.id ? thread.buyerId : thread.sellerId).name}{thread.sellerId === me.id ? ' · pirkėjas' : ''}</Text>
                <Text style={{ fontSize: 13, color: colors.muted }}>{listing.title} · {money(listing.price)}</Text>
                <Text numberOfLines={1} style={{ fontSize: 14, color: colors.ink, fontWeight: unread ? '700' : '400' }}>{unread ? 'Nauja · ' : ''}{preview}</Text>
              </Pressable>
            </Link>
            {waiting ? (
              <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 8 }}>
                <Text style={{ fontSize: 14, color: colors.ink }}>
                  Siūloma kaina: <Text style={{ fontWeight: '700' }}>{money(waiting.amount ?? 0)}</Text>
                  {waiting.text ? ` · „${waiting.text}“` : ''}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button label={`Priimti ${money(waiting.amount ?? 0)}`} disabled={busy === waiting.id} onPress={() => answer(thread.id, waiting.id, 'accepted')} style={{ flex: 1 }} />
                  <Button label="Atmesti" kind="outline" disabled={busy === waiting.id} onPress={() => answer(thread.id, waiting.id, 'declined')} style={{ flex: 1 }} />
                </View>
              </View>
            ) : null}
          </View>
        );
      })}
    </Page>
  );
}
