import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { ListingGrid } from '@/components/ListingCard';
import { Card, Chip, Muted, Page } from '@/components/ui';
import { useStore } from '@/store';
import { MAX_WIDTH, colors, radius } from '@/theme';
import { Listing, VEHICLE_LABELS, VehicleType } from '@/types';

type Sort = 'cheapest' | 'newest' | 'place';
const SORT_LABELS: Record<Sort, string> = {
  cheapest: 'Pigiausi su pristatymu',
  newest: 'Naujausi',
  place: 'Pagal šalį ir miestą',
};
const TYPES = Object.keys(VEHICLE_LABELS) as VehicleType[];

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '');
}

function totalPrice(listing: Listing): number {
  return listing.price + (listing.shipping ?? 0);
}

export default function SearchScreen() {
  const params = useLocalSearchParams<{ q?: string; type?: string }>();
  const { listings } = useStore();
  const { width } = useWindowDimensions();

  const [query, setQuery] = useState(params.q ?? '');
  const [type, setType] = useState<VehicleType | null>((params.type as VehicleType) || null);
  const [country, setCountry] = useState<string | null>(null);
  const [city, setCity] = useState('');
  const [onlyNoDefects, setOnlyNoDefects] = useState(false);
  const [onlyClassic, setOnlyClassic] = useState(false);
  const [delivery, setDelivery] = useState(true);
  const [pickup, setPickup] = useState(true);
  const [sort, setSort] = useState<Sort>('cheapest');
  const [showFilters, setShowFilters] = useState(false);

  // Parameters arrive again when the user searches from the home screen.
  useEffect(() => {
    if (params.q !== undefined) setQuery(params.q);
    if (params.type !== undefined) setType((params.type as VehicleType) || null);
  }, [params.q, params.type]);

  const countries = useMemo(() => Array.from(new Set(listings.map((l) => l.country))).sort(), [listings]);

  const results = useMemo(() => {
    const q = normalize(query);
    const c = normalize(city);
    const filtered = listings.filter((l) => {
      if (q && !normalize(`${l.title} ${l.oem} ${l.fits}`).includes(q)) return false;
      if (type && l.vehicleType !== type) return false;
      if (country && l.country !== country) return false;
      if (c && !normalize(l.city).includes(c)) return false;
      if (onlyNoDefects && l.defects.length > 0) return false;
      if (onlyClassic && !l.classic) return false;
      if (l.status === 'sold') return false;
      const deliverable = l.shipping !== null;
      if (!((delivery && deliverable) || (pickup && l.pickup))) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      if (sort === 'newest') return b.createdAt - a.createdAt;
      if (sort === 'place') return `${a.country} ${a.city}`.localeCompare(`${b.country} ${b.city}`, 'lt');
      return totalPrice(a) - totalPrice(b);
    });
  }, [listings, query, type, country, city, onlyNoDefects, onlyClassic, delivery, pickup, sort]);

  return (
    <Page>
      <TextInput
        accessibilityLabel="Paieška"
        placeholder="Dalis, kodas arba modelis"
        placeholderTextColor={colors.muted}
        value={query}
        onChangeText={setQuery}
        style={{
          minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border,
          borderRadius: radius.md, backgroundColor: colors.surface, fontSize: 16, fontWeight: '600', color: colors.ink,
        }}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip label={showFilters ? 'Slėpti filtrus' : 'Vieta, gavimas ir rikiavimas'} selected={showFilters} onPress={() => setShowFilters((v) => !v)} />
        <Chip label="Istoriniai" selected={onlyClassic} onPress={() => setOnlyClassic((v) => !v)} />
        <Chip label="Visi" selected={type === null} onPress={() => setType(null)} />
        {TYPES.map((t) => (
          <Chip key={t} label={VEHICLE_LABELS[t]} selected={type === t} onPress={() => setType(t)} />
        ))}
      </ScrollView>

      {showFilters ? (
        <Card>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>Šalis</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label="Visos" selected={country === null} onPress={() => setCountry(null)} />
            {countries.map((c) => (
              <Chip key={c} label={c} selected={country === c} onPress={() => setCountry(c)} />
            ))}
          </View>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>Miestas</Text>
          <TextInput
            accessibilityLabel="Miestas"
            placeholder="Pvz., Kaunas"
            placeholderTextColor={colors.muted}
            value={city}
            onChangeText={setCity}
            style={{ minHeight: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, fontSize: 15, color: colors.ink }}
          />
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>Kaip gausite dalį</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label="Pristatymas" selected={delivery} onPress={() => setDelivery((v) => !v)} />
            <Chip label="Atsiėmimas vietoje" selected={pickup} onPress={() => setPickup((v) => !v)} />
            <Chip label="Tik be defektų" selected={onlyNoDefects} onPress={() => setOnlyNoDefects((v) => !v)} />
          </View>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>Rikiuoti</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(Object.keys(SORT_LABELS) as Sort[]).map((s) => (
              <Chip key={s} label={SORT_LABELS[s]} selected={sort === s} onPress={() => setSort(s)} />
            ))}
          </View>
        </Card>
      ) : null}

      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>
        {results.length} {results.length === 1 ? 'skelbimas' : 'skelbimai'} · {SORT_LABELS[sort]}
      </Text>
      {results.length === 0 ? (
        <Muted>Pagal šiuos filtrus nieko neradome. Pabandykite kitą kodą arba išjunkite dalį filtrų.</Muted>
      ) : (
        <ListingGrid listings={results} width={Math.min(width, MAX_WIDTH)} />
      )}
    </Page>
  );
}
