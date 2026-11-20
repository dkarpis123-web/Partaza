import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, View, useWindowDimensions } from 'react-native';

import { CarPicker } from '@/components/CarPicker';
import { ListingGrid } from '@/components/ListingCard';
import { Button, Card, Chip, Field, Muted, Notice, Page } from '@/components/ui';
import { fitsCar, modelSearchTerm, readVin } from '@/services/vin';
import { countryLabel, countryName, useGeo } from '@/services/geo';
import { tr, useLang } from '@/i18n';
import { newMatches, normalize } from '@/services/match';
import { useStore } from '@/store';
import { MAX_WIDTH, colors, radius } from '@/theme';
import { Listing, SavedSearch, VEHICLE_LABELS, VehicleType } from '@/types';
import { VEHICLE_ICONS } from '@/components/VehicleIcon';
import { Text, TextInput } from '@/components/Text';

type Sort = 'cheapest' | 'newest' | 'place';
const SORT_LABELS: Record<Sort, string> = {
  cheapest: 'Pigiausi su pristatymu',
  newest: 'Naujausi',
  place: 'Pagal šalį ir miestą',
};
const TYPES = Object.keys(VEHICLE_LABELS) as VehicleType[];

/** Price with delivery to the buyer's country, or null when the delivery price there is not known (pickup only, on request, or another country). */
function totalPrice(listing: Listing, destination: string | null): number | null {
  if (!destination || listing.shipping === null || listing.country !== destination) return null;
  return listing.price + listing.shipping;
}

export default function SearchScreen() {
  const params = useLocalSearchParams<{ q?: string; type?: string; special?: string }>();
  useLang();
  const router = useRouter();
  const { listings, myCar, setMyCar, savedSearches, saveSearch, removeSearch, markSearchSeen, me, live, registered, aiMatch } = useStore();
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
  const home = useGeo().place?.country ?? null;
  const [suggestedFor, setSuggestedFor] = useState<string | null | undefined>(undefined);
  const [editPlace, setEditPlace] = useState(false);
  if (countries.length > 0 && suggestedFor !== home) {
    setSuggestedFor(home);
    if (home && countries.includes(home) && (country === null || country === suggestedFor)) setCountry(home);
  }

  const current = { query: query.trim(), vehicleType: type, country, city: city.trim() };
  const canSave = !!(current.query || current.vehicleType || current.country || current.city);
  const alreadySaved = savedSearches.some(
    (s) => normalize(s.query) === normalize(current.query) && s.vehicleType === current.vehicleType && s.country === current.country && normalize(s.city) === normalize(current.city),
  );
  const [saveProblem, setSaveProblem] = useState('');
  const saveCurrent = async () => {
    if (live && !registered) return router.push('/register');
    setSaveProblem((await saveSearch(current)) ?? '');
  };
  const searchLabel = (s: SavedSearch) =>
    [s.query, s.vehicleType ? tr(VEHICLE_LABELS[s.vehicleType]) : '', [s.city, s.country ? countryName(s.country) : ''].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || tr('Visi skelbimai');
  const openSaved = (s: SavedSearch) => {
    setQuery(s.query);
    setType(s.vehicleType);
    setCountry(s.country);
    setCity(s.city);
    markSearchSeen(s.id);
  };

  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoProblem, setPhotoProblem] = useState('');
  const [photoHit, setPhotoHit] = useState<{ name: string; oem: string; ids: string[] } | null>(null);
  const searchByPhoto = async (source: 'camera' | 'library') => {
    if (!registered) return router.push('/register');
    setPhotoProblem('');
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return setPhotoProblem('Kad nufotografuotumėte dalį, leiskite programėlei naudoti kamerą.');
      }
      const picked = source === 'camera' ? await ImagePicker.launchCameraAsync({ quality: 0.6 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
      if (picked.canceled || !picked.assets[0]) return;
      setPhotoBusy(true);
      const answer = await aiMatch(picked.assets[0].uri);
      setPhotoBusy(false);
      if (answer.error) return setPhotoProblem(answer.error);
      setPhotoHit({ name: answer.name ?? '', oem: answer.oem ?? '', ids: answer.ids ?? [] });
      // With nothing found, the recognised name or number becomes an ordinary search the person can save.
      if ((answer.ids ?? []).length === 0) setQuery(answer.oem || answer.name || '');
    } catch {
      setPhotoBusy(false);
      setPhotoProblem('Nepavyko atidaryti kameros. Pasirinkite nuotrauką iš galerijos.');
    }
  };

  const results = useMemo(() => {
    if (photoHit && photoHit.ids.length > 0) {
      return photoHit.ids.map((id) => listings.find((l) => l.id === id)).filter((l): l is Listing => !!l && (l.status ?? 'active') === 'active');
    }
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
      if (sort === 'place') return `${countryName(a.country)} ${a.city}`.localeCompare(`${countryName(b.country)} ${b.city}`, 'lt');
      // With a destination: known totals first, cheapest first; the rest after them by price alone.
      const ta = totalPrice(a, home);
      const tb = totalPrice(b, home);
      if (ta !== null && tb !== null) return ta - tb;
      if (ta !== null) return -1;
      if (tb !== null) return 1;
      return a.price - b.price;
    });
  }, [listings, query, type, country, city, onlyNoDefects, onlyClassic, onlyMotorsport, onlyWhole, onlyMyCar, myCar, delivery, pickup, sort, photoHit, home]);

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
      {live ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button label={photoBusy ? 'Ieškoma pagal nuotrauką…' : 'Ieškoti pagal nuotrauką'} kind="outline" disabled={photoBusy} onPress={() => searchByPhoto('library')} style={{ flex: 1 }} />
            {Platform.OS === 'web' ? null : <Button label="Fotografuoti" kind="outline" disabled={photoBusy} onPress={() => searchByPhoto('camera')} />}
          </View>
          {photoBusy ? <Muted>DI žiūri į nuotrauką ir lygina su skelbimais. Tai užtrunka keliolika sekundžių.</Muted> : null}
          {photoProblem ? <Notice tone="warn">{photoProblem}</Notice> : null}
          {photoHit ? (
            <Notice>
              {`${tr('Nuotraukoje')}: ${photoHit.name || tr('dalies atpažinti nepavyko')}${photoHit.oem ? ` · ${photoHit.oem}` : ''}. ${photoHit.ids.length > 0 ? `${tr('Rasta panašių skelbimų')}: ${photoHit.ids.length}.` : tr('Tokios dalies skelbimų dabar nėra – galite išsaugoti paiešką ir sulaukti, kol atsiras.')}`}
            </Notice>
          ) : null}
          {photoHit ? <Button label="Baigti paiešką pagal nuotrauką" kind="quiet" onPress={() => setPhotoHit(null)} /> : null}
        </View>
      ) : null}
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
          <Muted>Arba pasirinkite iš sąrašo:</Muted>
          <CarPicker
            picked={[`${makeText} ${modelText}`.trim()]}
            onPick={(make, model) => {
              setMakeText(make);
              setModelText(model);
              setCarError('');
            }}
          />
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, color: colors.muted }}>Ieškoma čia</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>
              {`${country ? countryLabel(country) : tr('Visos šalys')}${city.trim() ? ` · ${city.trim()}` : ''}`}
            </Text>
          </View>
          <Button label={editPlace ? 'Gerai' : 'Keisti'} kind="outline" onPress={() => setEditPlace((v) => !v)} />
        </View>
        {editPlace ? (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Chip label="Visos šalys" selected={country === null} onPress={() => setCountry(null)} />
              {countries.map((c) => (
                <Chip key={c} label={countryLabel(c)} selected={country === c} onPress={() => setCountry(c)} />
              ))}
            </View>
            <TextInput
              accessibilityLabel="Miestas"
              placeholder="Miestas, pvz., Kaunas"
              placeholderTextColor={colors.muted}
              value={city}
              onChangeText={setCity}
              style={{ minHeight: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, fontSize: 15, color: colors.ink }}
            />
          </>
        ) : home && country === home ? (
          <Muted>Šalis parinkta pagal jūsų vietą.</Muted>
        ) : null}
      </Card>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip label={showFilters ? 'Slėpti filtrus' : 'Gavimas ir rikiavimas'} selected={showFilters} onPress={() => setShowFilters((v) => !v)} />
        <Chip icon="car-convertible" label="Senoviniai automobiliai" selected={onlyClassic} onPress={() => setOnlyClassic((v) => !v)} />
        <Chip icon="flag-checkered" label="Automotosportas" selected={onlyMotorsport} onPress={() => setOnlyMotorsport((v) => !v)} />
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
          <Muted>{home ? `${tr('Kaina su siuntimu skaičiuojama pristatymui į')}: ${countryLabel(home)}. ${tr('Kitų šalių skelbimams ir skelbimams be siuntimo kainos rodoma tik dalies kaina.')}` : tr('Kad rikiuotume kartu su siuntimo kaina, leiskite naudoti vietą – tada žinosime gavėjo šalį. Dabar rikiuojama tik pagal dalies kainą.')}</Muted>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(Object.keys(SORT_LABELS) as Sort[]).map((s) => (
              <Chip key={s} label={SORT_LABELS[s]} selected={sort === s} onPress={() => setSort(s)} />
            ))}
          </View>
        </Card>
      ) : null}

      {savedSearches.length > 0 ? (
        <Card>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.ink }}>Išsaugotos paieškos</Text>
          {savedSearches.map((s) => {
            const fresh = newMatches(listings, s, me.id).length;
            return (
              <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1, alignItems: 'flex-start' }}>
                  <Chip label={`${searchLabel(s)}${fresh > 0 ? ` · ${tr('nauji')}: ${fresh}` : ''}`} selected={fresh > 0} onPress={() => openSaved(s)} />
                </View>
                <Button label="Pašalinti" kind="quiet" onPress={() => removeSearch(s.id)} />
              </View>
            );
          })}
        </Card>
      ) : null}

      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>
        {results.length} {results.length === 1 ? 'skelbimas' : 'skelbimai'} · {SORT_LABELS[sort]}
      </Text>
      {canSave ? (
        alreadySaved ? (
          <Muted>Ši paieška išsaugota: naujus atitinkančius skelbimus pažymėsime čia ir paieškos skirtuke.</Muted>
        ) : (
          <Button label="Išsaugoti paiešką ir matyti naujus skelbimus" kind="outline" onPress={saveCurrent} />
        )
      ) : null}
      {saveProblem ? <Notice tone="warn">{saveProblem}</Notice> : null}
      {results.length === 0 ? (
        <Muted>Pagal šiuos filtrus nieko neradome. Pabandykite kitą kodą arba išjunkite dalį filtrų.</Muted>
      ) : (
        <ListingGrid listings={results} width={Math.min(width, MAX_WIDTH)} />
      )}
    </Page>
  );
}
