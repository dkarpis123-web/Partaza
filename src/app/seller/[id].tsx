import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';

import { ListingGrid } from '@/components/ListingCard';
import { SellerLogo } from '@/components/SellerLogo';
import { Text } from '@/components/Text';
import { Button, Card, Heading, Muted, Notice, Page } from '@/components/ui';
import { useStore } from '@/store';
import { MAX_WIDTH, colors } from '@/theme';

/** A seller's public page: who they are and everything they have on sale. */
export default function SellerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { listings, userById, ready, following, toggleFollow, me, live, registered } = useStore();
  const router = useRouter();
  const [problem, setProblem] = useState('');
  const followed = following.includes(id);
  const follow = async () => {
    if (live && !registered) return router.push('/register');
    setProblem((await toggleFollow(id)) ?? '');
  };
  const { width } = useWindowDimensions();
  const seller = userById(id);
  const active = listings.filter((l) => l.sellerId === id && (l.status ?? 'active') === 'active').sort((a, b) => b.createdAt - a.createdAt);

  return (
    <Page>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <SellerLogo uri={seller.logo} name={seller.name} size={72} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.ink }}>{seller.name}</Text>
            <Muted>{seller.kind === 'business' ? 'Verslo pardavėjas · taikoma 14 dienų grąžinimo teisė' : 'Privatus pardavėjas'}</Muted>
            {seller.since ? <Muted>Prekiauja nuo {seller.since}</Muted> : null}
          </View>
        </View>
        {id === me.id ? null : <Button label={followed ? 'Nebesekti pardavėjo' : 'Sekti pardavėją'} kind={followed ? 'outline' : 'dark'} onPress={follow} />}
        {followed ? <Muted>Naujus šio pardavėjo skelbimus matysite pradžios puslapyje.</Muted> : null}
        {problem ? <Notice tone="warn">{problem}</Notice> : null}
      </Card>
      <Heading>Pardavėjo skelbimai ({active.length})</Heading>
      {!ready ? <Muted>Kraunama…</Muted> : null}
      {ready && active.length === 0 ? <Muted>Šis pardavėjas šiuo metu nieko neparduoda.</Muted> : null}
      <ListingGrid listings={active} width={Math.min(width, MAX_WIDTH)} />
    </Page>
  );
}
