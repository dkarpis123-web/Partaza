import { useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import { ListingGrid } from '@/components/ListingCard';
import { Button, Card, Chip, Field, Muted, Notice, Page } from '@/components/ui';
import { fitsCar, modelSearchTerm, readVin } from '@/services/vin';
import { detectCountry } from '@/services/geo';
import { useStore } from '@/store';
import { MAX_WIDTH, colors, radius } from '@/theme';
import { Listing, VEHICLE_LABELS, VehicleType } from '@/types';
import { VEHICLE_ICONS } from '@/components/VehicleIcon';
import { Text, TextInput } from '@/components/Text';

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
  const params = useLocalSearchParams<{ q?: string; type?: string; special?: string }>();
  const { listings, myCar, setMyCar } = useStore();
  const { width } = useWindowDimensions();

  const [query, setQuery] = useState(params.q ?? '');
  const [type, setType] = useState<VehicleType | null>((params.type as VehicleType) || null);
  const [country, setCountry] = useState<string | null>(null);
  const [city, setCity] = useState('');
  const [onlyNoDefects, setOnlyNoDefects] = useState(false);
  const [onlyClassic, setOnlyClassic] = useState(params.special === 'classic');
  const [onlyMotorsport, setOnlyMotorsport] = useState(params.special === 'motorsport');
  const [onlyWhole, setOnlyWhole] = useState(false);
  const [delivery, setDelivery] = useState(true);
  const [pickup, setPickup] = useState(true);
  const [sort, setSort] = useState<Sort>('cheapest');
  const [showFilters, setShowFilters] = useState(false);
  const [onlyMyCar, setOnlyMyCar] = useState(false);
  const [editCar, setEditCar] = useState(false);
  const [vinText, setVinText] = useState('');
  const [makeText, setMakeText] = useState('');
  const [modelText, setModelText] = useState('');
  const [carError, setCarError] = useState('');
  const vinInfo = readVin(vinText);

  const saveCar = () => {
    const make = makeText.trim() || vinInfo?.make || '';
    if (vinText.trim() && !vinInfo) return setCarError('VIN turi būti 17 ženklų, be raidžių I, O ir Q.');
    if (!make) return setCarError('Įrašykite markę, pvz., Volkswagen.');
    // A model read from the VIN (e.g. "Passat B6 / B7") is narrowed to its name so it matches sellers' wording.
    const guessed = modelSearchTerm(vinInfo);
    setMyCar({ make, model: modelText.trim() || guessed, vin: vinInfo?.vin ?? '', year: vinInfo?.year ?? null });
    setOnlyMyCar(true);
    setEditCar(false);
    setCarError('');
  };

  // Parameters arrive again when the user searches from the home screen.
  const [seenParams, setSeenParams] = useState({ q: params.q, type: params.type, special: params.special });
  if (seenParams.q !== params.q || seenParams.type !== params.type || seenParams.special !== params.special) {
    setSeenParams({ q: params.q, type: params.type, special: params.special });
    if (params.special !== undefined) {
      setOnlyClassic(params.special === 'classic');
      setOnlyMotorsport(params.special === 'motorsport');
    }
    if (params.q !== undefined) setQuery(params.q);
    if (params.type !== undefined) setType((params.type as VehicleType) || null);
  }

  const countries = useMemo(() => Array.from(new Set(listings.map((l) => l.country))).sort(), [listings]);
  // Once the listings are known, start in the visitor's own country if there is anything to show there.
  const [home] = useState(detectCountry);
  const [suggested, setSuggested] = useState(false);
  if (!suggested && countries.length > 0) {
    setSuggested(true);
    if (home && countries.includes(home) && country === null) setCountry(home);
  }

  const results = useMemo(() => {
    const q = normalize(query);
    const c = normalize(city);
    const filtered = listings.filter((l) => {
      if (q && !normalize(`${l.title} ${l.oem} ${l.fits} ${l.description ?? ''}`).includes(q)) return false;
      if (type && l.vehicleType !== type) return false;
      if (country && l.country !== country) return false;
      if (c && !normalize(l.city).includes(c)) return false;
      if (onlyNoDefects && l.defects.length > 0) return false;
      if (onlyClassic && !l.classic) return false;
      if (onlyMotorsport && !l.motorsport) return false;
      if (onlyWhole && !l.wholeVehicle) return false;
      if (onlyMyCar && myCar && !fitsCar(`${l.fits} ${l.title}`, myCar.make, myCar.model)) return false;
      if ((l.status ?? 'active') !== 'active') return false;
      const deliverable = l.shipping !== null;
      if (!((delivery && deliverable) || (pickup && l.pickup))) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      if (sort === 'newest') return b.createdAt - a.createdAt;
      if (sort === 'place') return `${a.country} ${a.city}`.localeCompare(`${b.country} ${b.city}`, 'lt');
      return totalPrice(a) - totalPrice(b);
    });
  }, [listings, query, type, country, city, onlyNoDefects, onlyClassic, onlyMotorsport, onlyWhole, onlyMyCar, myCar, delivery, pickup, sort]);

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
      {myCar && !editCar ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <Chip label={`Tinka: ${myCar.make}${myCar.model ? ` ${myCar.model}` : ''}`} selected={onlyMyCar} onPress={() => setOnlyMyCar((v) => !v)} />
          <Button
            label="Keisti automobilį"
            kind="quiet"
            onPress={() => {
              setVinText(myCar.vin);
              setMakeText(myCar.make);
              setModelText(myCar.model);
              setEditCar(true);
            }}
          />
        </View>
      ) : null}
      {!myCar && !editCar ? <Button label="Rodyti tik mano automobiliui tinkančias dalis" kind="outline" onPress={() => setEditCar(true)} /> : null}
      {editCar ? (
        <Card>
          <Field label="VIN (nebūtina)" value={vinText} onChangeText={(t) => { setVinText(t); setCarError(''); }} autoCapitalize="characters" hint="Iš VIN atpažįstame markę ir metus, kai kurioms markėms – ir modelį. Patikrinkite ir pataisykite." />
          {vinInfo ? (
            <Muted>
              {vinInfo.make ? `Markė: ${vinInfo.make}` : 'Markės pagal šį VIN neatpažinome'}{vinInfo.model ? ` · modelis: ${vinInfo.model}` : ''}{vinInfo.year ? ` · apie ${vinInfo.year} m.` : ''}
            </Muted>
          ) : null}
          <Field label="Markė" value={makeText || vinInfo?.make || ''} onChangeText={(t) => { setMakeText(t); setCarError(''); }} placeholder="Pvz., Volkswagen" />
          <Field label="Modelis" value={modelText} onChangeText={setModelText} placeholder={modelSearchTerm(vinInfo) || 'Pvz., Transporter'} />
          {carError ? <Notice tone="warn">{carError}</Notice> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button label="Išsaugoti" onPress={saveCar} style={{ flex: 1 }} />
            <Button label="Atšaukti" kind="outline" onPress={() => { setEditCar(false); setCarError(''); }} style={{ flex: 1 }} />
          </View>
          {myCar ? (
            <Button
              label="Pašalinti automobilį"
              kind="quiet"
              onPress={() => {
                setMyCar(null);
                setOnlyMyCar(false);
                setEditCar(false);
              }}
            />
          ) : null}
          <Muted>Automobilis saugomas tik šiame įrenginyje. Tinkamumą tikriname pagal pardavėjo įrašytą tekstą „Kam tinka“, todėl prieš pirkdami sutikrinkite dalies numerį.</Muted>
        </Card>
      ) : null}
      <Card>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.ink }}>Ieškoti tik šioje vietoje</Text>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>Šalis</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label="Visos" selected={country === null} onPress={() => setCountry(null)} />
          {countries.map((c) => (
            <Chip key={c} label={c} selected={country === c} onPress={() => setCountry(c)} />
          ))}
        </View>
        {home && country === home ? <Muted>Pagal jūsų vietą parinkta šalis. Kitų šalių skelbimus matysite pasirinkę „Visos“.</Muted> : null}
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>Miestas</Text>
        <TextInput
          accessibilityLabel="Miestas"
          placeholder="Pvz., Kaunas"
          placeholderTextColor={colors.muted}
          value={city}
          onChangeText={setCity}
          style={{ minHeight: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, fontSize: 15, color: colors.ink }}
        />
      </Card>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip label={showFilters ? 'Slėpti filtrus' : 'Gavimas ir rikiavimas'} selected={showFilters} onPress={() => setShowFilters((v) => !v)} />
        <Chip label="Senoviniai automobiliai" selected={onlyClassic} onPress={() => setOnlyClassic((v) => !v)} />
        <Chip label="Automotosportas" selected={onlyMotorsport} onPress={() => setOnlyMotorsport((v) => !v)} />
        <Chip label="Visas automobilis" selected={onlyWhole} onPress={() => setOnlyWhole((v) => !v)} />
        <Chip icon="view-grid-outline" label="Visi" selected={type === null} onPress={() => setType(null)} />
        {TYPES.map((t) => (
          <Chip key={t} icon={VEHICLE_ICONS[t]} label={VEHICLE_LABELS[t]} selected={type === t} onPress={() => setType(t)} />
        ))}
      </ScrollView>

      {showFilters ? (
        <Card>
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
