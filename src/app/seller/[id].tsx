import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';

import { ListingGrid } from '@/components/ListingCard';
import { stars } from '@/components/ReviewBox';
import { SellerLogo } from '@/components/SellerLogo';
import { tr, useLang } from '@/i18n';
import { Text } from '@/components/Text';
import { Button, Card, Heading, Muted, Notice, Page } from '@/components/ui';
import { useStore } from '@/store';
import { MAX_WIDTH, colors } from '@/theme';

/** A seller's public page: who they are and everything they have on sale. */
export default function SellerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useLang();
  const { listings, userById, ready, reviews, following, toggleFollow, me, live, registered } = useStore();
  const router = useRouter();
  const [problem, setProblem] = useState('');
  const followed = following.includes(id);
  const follow = async () => {
    if (live && !registered) return router.push('/register');
    setProblem((await toggleFollow(id)) ?? '');
  };
  const { width } = useWindowDimensions();
  const seller = userById(id);
  const about = reviews.filter((r) => r.subjectId === id);
  const active = listings.filter((l) => l.sellerId === id && (l.status ?? 'active') === 'active').sort((a, b) => b.createdAt - a.createdAt);

  return (
    <Page>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <SellerLogo uri={seller.logo} name={seller.name} size={72} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.ink }}>{seller.name}</Text>
            <Muted>{seller.kind === 'business' ? 'Verslo pardavėjas · taikoma 14 dienų grąžinimo teisė' : 'Privatus pardavėjas'}</Muted>
            <Muted>{seller.reviews > 0 ? `${stars(Math.round(seller.rating))} ${seller.rating.toFixed(1).replace('.', ',')} ${tr('iš 5')} (${seller.reviews})` : tr('atsiliepimų dar nėra')}</Muted>
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
      {about.length > 0 ? <Heading>Atsiliepimai ({about.length})</Heading> : null}
      {about.slice(0, 30).map((r) => (
        <Card key={r.id} style={{ gap: 4 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.ink }}>{`${stars(r.stars)} · ${tr(r.subjectRole === 'seller' ? 'kaip pardavėjas' : 'kaip pirkėjas')}`}</Text>
          {r.comment ? <Text style={{ fontSize: 14, lineHeight: 20, color: colors.ink }}>{r.comment}</Text> : null}
          <Muted>{`${r.authorId ? userById(r.authorId).name : ''} · ${new Date(r.createdAt).toLocaleDateString('lt-LT')}`}</Muted>
        </Card>
      ))}
    </Page>
  );
}
