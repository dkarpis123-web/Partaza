import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, TextInput, View, useWindowDimensions } from 'react-native';

import { ListingGrid } from '@/components/ListingCard';
import { Button, Chip, Heading, Muted, Notice, Page } from '@/components/ui';
import { useStore } from '@/store';
import { MAX_WIDTH, colors, radius } from '@/theme';
import { VEHICLE_LABELS, VehicleType } from '@/types';

const TYPES = Object.keys(VEHICLE_LABELS) as VehicleType[];

export default function HomeScreen() {
  const router = useRouter();
  const { listings, ready, live } = useStore();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<VehicleType | null>(null);

  const shown = [...listings]
    .filter((l) => l.status !== 'sold' && (type ? l.vehicleType === type : true))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 12);

  const search = () => router.push({ pathname: '/search', params: { q: query, type: type ?? '' } });

  return (
    <Page>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          accessibilityLabel="Paieška"
          placeholder="Dalis, kodas arba modelis"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
          returnKeyType="search"
          style={{
            flex: 1, minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border,
            borderRadius: radius.md, backgroundColor: colors.surface, fontSize: 15, color: colors.ink,
          }}
        />
        <Button label="Ieškoti" kind="dark" onPress={search} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip label="Visi" selected={type === null} onPress={() => setType(null)} />
        {TYPES.map((t) => (
          <Chip key={t} label={VEHICLE_LABELS[t]} selected={type === t} onPress={() => setType(t)} />
        ))}
      </ScrollView>
      {live ? null : <Notice tone="warn">Bandomoji versija: skelbimai pavyzdiniai, niekas neparduodama ir niekur nesaugoma.</Notice>}
      <Heading>Nauji skelbimai</Heading>
      {!ready ? <Muted>Kraunama…</Muted> : null}
      {ready && shown.length === 0 ? (
        <Muted>{live && listings.length === 0 ? 'Skelbimų dar nėra. Būkite pirmas – įdėkite dalį skiltyje „Parduoti“.' : 'Šioje kategorijoje skelbimų dar nėra.'}</Muted>
      ) : null}
      <ListingGrid listings={shown} width={Math.min(width, MAX_WIDTH)} />
    </Page>
  );
}
