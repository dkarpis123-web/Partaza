import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import { ListingGrid } from '@/components/ListingCard';
import { Button, Chip, Heading, Muted, Notice, Page } from '@/components/ui';
import { promoted } from '@/services/match';
import { useStore } from '@/store';
import { MAX_WIDTH, colors, radius } from '@/theme';
import { VEHICLE_LABELS, VehicleType } from '@/types';
import { VEHICLE_ICONS } from '@/components/VehicleIcon';
import { TextInput } from '@/components/Text';

const TYPES = Object.keys(VEHICLE_LABELS) as VehicleType[];

export default function HomeScreen() {
  const router = useRouter();
  const { listings, ready, live, following } = useStore();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<VehicleType | null>(null);
  const [special, setSpecial] = useState<'classic' | 'motorsport' | null>(null);

  const shown = [...listings]
    .filter((l) => (l.status ?? 'active') === 'active' && (type ? l.vehicleType === type : true) && (special === 'classic' ? !!l.classic : special === 'motorsport' ? !!l.motorsport : true))
    .sort((a, b) => Number(promoted(b)) - Number(promoted(a)) || b.createdAt - a.createdAt)
    .slice(0, 12);

  const fromFollowed = [...listings]
    .filter((l) => following.includes(l.sellerId) && (l.status ?? 'active') === 'active')
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 6);

  const search = () => router.push({ pathname: '/search', params: { q: query, type: type ?? '', special: special ?? '' } });

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
            flex: 1, minWidth: 0, minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border,
            borderRadius: radius.md, backgroundColor: colors.surface, fontSize: 15, color: colors.ink,
          }}
        />
        <Button label="Ieškoti" kind="dark" onPress={search} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip icon="view-grid-outline" label="Visi" selected={type === null && special === null} onPress={() => { setType(null); setSpecial(null); }} />
        <Chip icon="car-vintage" label="Senoviniai automobiliai" selected={special === 'classic'} onPress={() => { setType(null); setSpecial((v) => (v === 'classic' ? null : 'classic')); }} />
        <Chip icon="flag-checkered" label="Automotosportas" selected={special === 'motorsport'} onPress={() => { setType(null); setSpecial((v) => (v === 'motorsport' ? null : 'motorsport')); }} />
        {TYPES.map((t) => (
          <Chip key={t} icon={VEHICLE_ICONS[t]} label={VEHICLE_LABELS[t]} selected={type === t} onPress={() => { setSpecial(null); setType((v) => (v === t ? null : t)); }} />
        ))}
      </ScrollView>
      {live ? null : <Notice tone="warn">Bandomoji versija: skelbimai pavyzdiniai, niekas neparduodama ir niekur nesaugoma.</Notice>}
      {fromFollowed.length > 0 ? (
        <>
          <Heading>Sekamų pardavėjų skelbimai</Heading>
          <ListingGrid listings={fromFollowed} width={Math.min(width, MAX_WIDTH)} />
        </>
      ) : null}
      <Heading>Nauji skelbimai</Heading>
      {!ready ? <Muted>Kraunama…</Muted> : null}
      {ready && shown.length === 0 ? (
        <Muted>{live && listings.length === 0 ? 'Skelbimų dar nėra. Būkite pirmas – įdėkite dalį skiltyje „Parduoti“.' : 'Šioje kategorijoje skelbimų dar nėra.'}</Muted>
      ) : null}
      <ListingGrid listings={shown} width={Math.min(width, MAX_WIDTH)} />
    </Page>
  );
}
