import { BlockedUsers } from '@/components/BlockedUsers';
import { Link } from 'expo-router';
import React from 'react';
import { Pressable, Text } from 'react-native';

import { Heading, Muted, Page } from '@/components/ui';
import { useStore } from '@/store';
import { colors, money, radius } from '@/theme';

export default function MessagesScreen() {
  const { threads, listingById, userById, me, unreadThreadIds } = useStore();
  return (
    <Page>
      <Heading>Žinutės ir derybos</Heading>
      <BlockedUsers />
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
        return (
          <Link key={thread.id} href={`/chat/${thread.id}`} asChild>
            <Pressable
              accessibilityRole="link"
              style={{ padding: 14, gap: 4, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.ink }}>{userById(thread.sellerId === me.id ? thread.buyerId : thread.sellerId).name}{thread.sellerId === me.id ? ' · pirkėjas' : ''}</Text>
              <Text style={{ fontSize: 13, color: colors.muted }}>{listing.title} · {money(listing.price)}</Text>
              <Text numberOfLines={1} style={{ fontSize: 14, color: colors.ink, fontWeight: unread ? '700' : '400' }}>{unread ? 'Nauja · ' : ''}{preview}</Text>
            </Pressable>
          </Link>
        );
      })}
    </Page>
  );
}
