import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, View, useWindowDimensions } from 'react-native';

import { CarPicker } from '@/components/CarPicker';
import { DestinationPicker } from '@/components/DestinationPicker';
import { FilterBar } from '@/components/FilterBar';
import { ListingGrid } from '@/components/ListingCard';
import { Button, Card, Chip, Field, Muted, Notice, Page } from '@/components/ui';
import { fitVerdict } from '@/services/fitment';
import { modelSearchTerm, readVin } from '@/services/vin';
import { countryLabel, countryName, useDestination } from '@/services/geo';
import { EU, EUROPE_NON_EU, shippingTo, shipsTo } from '@/services/shipping';
import { tr, useLang } from '@/i18n';
import { newMatches, normalize, promoted, textMatches } from '@/services/match';
import { useStore } from '@/store';
import { MAX_WIDTH, colors, radius } from '@/theme';
import { Listing, SavedSearch, VEHICLE_LABELS, VehicleType } from '@/types';
import { Text, TextInput } from '@/components/Text';

type Sort = 'cheapest' | 'newest' | 'place';
/** reach = parts that can get to the buyer; home = only in the buyer's country; country = one chosen country. */
type Area = 'reach' | 'home' | 'eu' | 'europe' | 'all' | 'country';
const AREAS: Area[] = ['reach', 'home', 'eu', 'europe', 'all', 'country'];
const AREA_KEY = 'partaza.searchArea';
let savedArea: Area | null = null;
/** The buyer's last choice of place, kept on the device so the next search starts there. */
function rememberArea(next: Area) {
  savedArea = next;
  AsyncStorage.setItem(AREA_KEY, next).catch(() => {});
}
async function loadArea(): Promise<Area | null> {
  if (savedArea) return null;
  const v = await AsyncStorage.getItem(AREA_KEY).catch(() => null);
  if (!v || !AREAS.includes(v as Area)) return null;
  savedArea = v as Area;
  return savedArea;
}
const SORT_LABELS: Record<Sort, string> = {
  cheapest: 'Pigiausi su pristatymu',
  newest: 'Naujausi',
  place: 'Pagal šalį ir miestą',
};
const TYPES = Object.keys(VEHICLE_LABELS) as VehicleType[];

/** Price with delivery to the buyer's country, or null when the delivery price there is not known (pickup only, on request, or another country). */
function totalPrice(listing: Listing, destination: string | null): number | null {
  const shipping = shippingTo(listing, destination);
  return shipping === null ? null : listing.price + shipping;
}

export default function SearchScreen() {
  const params = useLocalSearchParams<{ q?: string; type?: string; special?: string }>();
  useLang();
  const router = useRouter();
  const { listings, myCar, setMyCar, savedSearches, saveSearch, removeSearch, markSearchSeen, me, live, registered, aiMatch, searchServer } = useStore();
  const { width } = useWindowDimensions();

  const [query, setQuery] = useState(params.q ?? '');
  // The app holds the newest listings; older ones that match are fetched from the server as the person types.
  useEffect(() => {
    if (!live || query.trim().length < 2) return;
    const timer = setTimeout(() => searchServer(query), 450);
    return () => clearTimeout(timer);
  }, [query, live, searchServer]);
  const [type, setType] = useState<VehicleType | null>((params.type as VehicleType) || null);
  const [country, setCountry] = useState<string | null>(null);
  // Where the parts are: by default only those that can reach the buyer (sent there, or picked up in their own country).
  const [area, setAreaState] = useState<Area>(() => savedArea ?? 'reach');
  const setArea = (next: Area) => {
    setAreaState(next);
    rememberArea(next);
  };
  useEffect(() => {
    loadArea().then((v) => { if (v) setAreaState(v); }).catch(() => {});
  }, []);
  const [city, setCity] = useState('');
  const [onlyNoDefects, setOnlyNoDefects] = useState(false);
  const [onlyClassic, setOnlyClassic] = useState(params.special === 'classic');
  const [onlyMotorsport, setOnlyMotorsport] = useState(params.special === 'motorsport');
  const [onlyWhole, setOnlyWhole] = useState(false);
  const [delivery, setDelivery] = useState(true);
  const [pickup, setPickup] = useState(true);
  const [sort, setSort] = useState<Sort>('cheapest');
  const [onlyMyCar, setOnlyMyCar] = useState(false);
  const [editCar, setEditCar] = useState(false);
  const [vinText, setVinText] = useState('');
  const [makeText, setMakeText] = useState('');
  const [modelText, setModelText] = useState('');
  const [yearText, setYearText] = useState('');
  const [carError, setCarError] = useState('');
  const vinInfo = readVin(vinText);

  const saveCar = () => {
    const make = makeText.trim() || vinInfo?.make || '';
    if (vinText.trim() && !vinInfo) return setCarError('VIN turi būti 17 ženklų, be raidžių I, O ir Q.');
    if (!make) return setCarError('Įrašykite markę, pvz., Volkswagen.');
    // A model read from the VIN (e.g. "Passat B6 / B7") is narrowed to its name so it matches sellers' wording.
    const guessed = modelSearchTerm(vinInfo);
    const year = /^(19|20)\d\d$/.test(yearText.trim()) ? Number(yearText.trim()) : vinInfo?.year ?? null;
    setMyCar({ make, model: modelText.trim() || guessed, vin: vinInfo?.vin ?? '', year });
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

  const { country: dest } = useDestination();
  const countries = useMemo(() => Array.from(new Set(listings.map((l) => l.country))).sort(), [listings]);
  // Cities with parts in the chosen country (or everywhere), one entry per city however it is capitalised.
  const cities = useMemo(() => {
    const seen = new Map<string, string>();
    for (const l of listings) {
      const inside = area === 'home' ? dest : area === 'country' ? country : null;
      if ((l.status ?? 'active') !== 'active' || (inside && l.country !== inside) || !l.city?.trim()) continue;
      const key = normalize(l.city);
      if (!seen.has(key)) seen.set(key, l.city.trim());
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b, 'lt'));
  }, [listings, area, country, dest]);

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
    if (s.country) setArea('country');
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
    const c = normalize(city);
    const filtered = listings.filter((l) => {
      if (!textMatches(l, query)) return false;
      if (type && l.vehicleType !== type) return false;
      if (area === 'country' && country && l.country !== country) return false;
      if (area === 'reach' && dest && !(shipsTo(l, dest) || (l.pickup && l.country === dest))) return false;
      if (area === 'home' && dest && l.country !== dest) return false;
      if (area === 'eu' && !EU.includes(l.country)) return false;
      if (area === 'europe' && !EU.includes(l.country) && !EUROPE_NON_EU.includes(l.country)) return false;
      if (c && normalize(l.city) !== c) return false;
      if (onlyNoDefects && l.defects.length > 0) return false;
      if (onlyClassic && !l.classic) return false;
      if (onlyMotorsport && !l.motorsport) return false;
      if (onlyWhole && !l.wholeVehicle) return false;
      if (onlyMyCar && myCar && fitVerdict(l, myCar) !== 'fits') return false;
      if ((l.status ?? 'active') !== 'active') return false;
      // With a delivery country known, only parts the seller actually sends there count as deliverable.
      const deliverable = (l.shipping !== null || l.shippingQuote) && (!dest || shipsTo(l, dest));
      if (!((delivery && deliverable) || (pickup && l.pickup))) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      // Promoted listings come first in every order; they carry a badge so it is clear why.
      const lift = Number(promoted(b)) - Number(promoted(a));
      if (lift) return lift;
      if (sort === 'newest') return b.createdAt - a.createdAt;
      if (sort === 'place') return `${countryName(a.country)} ${a.city}`.localeCompare(`${countryName(b.country)} ${b.city}`, 'lt');
      // With a destination: known totals first, cheapest first; the rest after them by price alone.
      const ta = totalPrice(a, dest);
      const tb = totalPrice(b, dest);
      if (ta !== null && tb !== null) return ta - tb;
      if (ta !== null) return -1;
      if (tb !== null) return 1;
      return a.price - b.price;
    });
  }, [listings, query, type, area, country, city, onlyNoDefects, onlyClassic, onlyMotorsport, onlyWhole, onlyMyCar, myCar, delivery, pickup, sort, photoHit, dest]);

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
          <Chip label={`Tinka: ${myCar.make}${myCar.model ? ` ${myCar.model}` : ''}${myCar.year ? ` ${myCar.year}` : ''}`} selected={onlyMyCar} onPress={() => setOnlyMyCar((v) => !v)} />
          <Button
            label="Keisti automobilį"
            kind="quiet"
            onPress={() => {
              setVinText(myCar.vin);
              setMakeText(myCar.make);
              setModelText(myCar.model);
              setYearText(myCar.year ? String(myCar.year) : '');
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
          <Field label="Metai (nebūtina)" value={yearText || (vinInfo?.year ? String(vinInfo.year) : '')} onChangeText={(t) => setYearText(t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" placeholder="Pvz., 2016" />
          <Muted>Arba pasirinkite iš sąrašo:</Muted>
          <CarPicker
            addLabel="Pasirinkti"
            picked={[]}
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
        <DestinationPicker />
      </Card>
      <FilterBar
        filters={[
          {
            key: 'area', label: 'Vieta', value: area === 'country' && country ? `c:${country}` : area, active: area !== 'all',
            options: [
              ...(dest ? [{ value: 'reach', label: `${tr('Pasiekia mano šalį')} (${countryName(dest)})` }, { value: 'home', label: `${tr('Tik')} ${countryName(dest)}` }] : []),
              { value: 'eu', label: tr('Europos Sąjunga') },
              { value: 'europe', label: tr('Visa Europa') },
              { value: 'all', label: tr('Visas pasaulis') },
              ...countries.filter((c) => c !== dest).map((c) => ({ value: `c:${c}`, label: countryLabel(c) })),
            ],
            onSelect: (v) => {
              setCity('');
              if (v.startsWith('c:')) {
                setCountry(v.slice(2));
                setArea('country');
              } else {
                setCountry(null);
                setArea(v as Area);
              }
            },
          },
          ...(cities.length > 0 && (area === 'country' || area === 'home') ? [{
            key: 'city', label: 'Miestas', value: city ? normalize(city) : 'all', active: !!city,
            options: [{ value: 'all', label: tr('Visi miestai') }, ...cities.map((c) => ({ value: normalize(c), label: c }))],
            onSelect: (v: string) => setCity(v === 'all' ? '' : cities.find((c) => normalize(c) === v) ?? ''),
          }] : []),
          { key: 'sort', label: 'Rikiuoti', value: sort, options: (Object.keys(SORT_LABELS) as Sort[]).map((v) => ({ value: v, label: SORT_LABELS[v] })), onSelect: (v) => setSort(v as Sort) },
          {
            key: 'type', label: 'Transportas', value: type ?? 'all', active: type !== null,
            options: [{ value: 'all', label: 'Visi' }, ...TYPES.map((t) => ({ value: t as string, label: VEHICLE_LABELS[t] }))],
            onSelect: (v) => setType(v === 'all' ? null : (v as VehicleType)),
          },
          {
            key: 'get', label: 'Gavimas', value: delivery ? 'delivery' : pickup ? 'pickup' : 'any', active: delivery || pickup,
            options: [{ value: 'any', label: 'Bet koks' }, { value: 'delivery', label: 'Pristatymas' }, { value: 'pickup', label: 'Atsiėmimas vietoje' }],
            onSelect: (v) => { setDelivery(v === 'delivery'); setPickup(v === 'pickup'); },
          },
        ]}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip label="Tik be defektų" selected={onlyNoDefects} onPress={() => setOnlyNoDefects((v) => !v)} />
        <Chip icon="car-vintage" label="Senoviniai automobiliai" selected={onlyClassic} onPress={() => setOnlyClassic((v) => !v)} />
        <Chip icon="flag-checkered" label="Automotosportas" selected={onlyMotorsport} onPress={() => setOnlyMotorsport((v) => !v)} />
        <Chip label="Visas automobilis" selected={onlyWhole} onPress={() => setOnlyWhole((v) => !v)} />
      </ScrollView>
      {sort === 'cheapest' && !dest ? <Muted>Kad rikiuotume kartu su siuntimo kaina, nurodykite gavėjo šalį arba leiskite naudoti vietą. Dabar rikiuojama tik pagal dalies kainą.</Muted> : null}

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
