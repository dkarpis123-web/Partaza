import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { PhotoEditor } from '@/components/PhotoEditor';
import { Button, Card, Chip, Field, Heading, Muted, Notice, Page } from '@/components/ui';
import { priceAdviceFromMarket, recognizePart } from '@/services/ai';
import { COUNTRIES, countryLabel, countryName, detectCountry, locate } from '@/services/geo';
import { useLang } from '@/i18n';
import { useStore } from '@/store';
import { colors, money } from '@/theme';
import { CONDITION_LABELS, Condition, Listing, VEHICLE_LABELS, VehicleType } from '@/types';
import { VEHICLE_ICONS } from '@/components/VehicleIcon';
import { Text } from '@/components/Text';

const TYPES = Object.keys(VEHICLE_LABELS) as VehicleType[];
const CONDITIONS = Object.keys(CONDITION_LABELS) as Condition[];
const SHIPPING: { label: string; price: number | null }[] = [
  { label: 'Maža, iki 2 kg · 2,90 €', price: 2.9 },
  { label: 'Vidutinė, iki 10 kg · 3,50 €', price: 3.5 },
  { label: 'Didelė, iki 30 kg · 5,90 €', price: 5.9 },
  { label: 'Tik atsiėmimas vietoje', price: null },
];

function parsePrice(text: string): number | null {
  const value = Number(text.replace(',', '.').trim());
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
}

function toText(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace('.', ',');
}

/** New listing (photos arrive from the Sell tab) or editing an existing one (?edit=<listing id>). */
export default function ReviewScreen() {
  const params = useLocalSearchParams<{ edit?: string }>();
  const { listingById, ready, me } = useStore();
  const editId = typeof params.edit === 'string' && params.edit ? params.edit : undefined;
  const editing = editId ? listingById(editId) : undefined;
  if (editId && (!editing || editing.sellerId !== me.id)) {
    return (
      <Page>
        <Muted>{ready ? 'Šio skelbimo redaguoti negalima.' : 'Kraunama…'}</Muted>
      </Page>
    );
  }
  // The key gives the form a fresh start when switching between "new" and a listing being edited.
  return <ReviewForm key={editId ?? 'new'} editing={editing} />;
}

function ReviewForm({ editing }: { editing?: Listing }) {
  useLang();
  const router = useRouter();
  const params = useLocalSearchParams<{ photos?: string; donor?: string; whole?: string }>();
  const { listings, donors, registered, phone, addListing, updateListing } = useStore();
  const whole = editing ? !!editing.wholeVehicle : params.whole === '1';
  const donor = donors.find((d) => d.id === (editing ? editing.donorId : params.donor));

  const initialPhotos = useMemo<string[]>(() => {
    if (editing) return editing.photos;
    try {
      const parsed = JSON.parse(params.photos ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : [];
    } catch {
      return [];
    }
  }, [params.photos, editing]);
  // The seller can still add, remove or retake photos here before publishing.
  const [photos, setPhotos] = useState<string[]>(initialPhotos);

  const [loading, setLoading] = useState(!editing && !whole);
  const [isDemo, setIsDemo] = useState(false);
  const [title, setTitle] = useState(editing?.title ?? (whole && donor ? `${donor.name}, visas dalims` : ''));
  const [oem, setOem] = useState(editing?.oem ?? '');
  const [fits, setFits] = useState(editing?.fits ?? (whole && donor ? donor.name : ''));
  const [vehicleType, setVehicleType] = useState<VehicleType>(editing?.vehicleType ?? 'car');
  const [condition, setCondition] = useState<Condition>(editing?.condition ?? 'used');
  const [defects, setDefects] = useState<string[]>(editing?.defects ?? []);
  const [newDefect, setNewDefect] = useState('');
  const [priceText, setPriceText] = useState(editing ? toText(editing.price) : '');
  const [vat, setVat] = useState(editing?.vat ?? false);
  const [shipping, setShipping] = useState<number | null>(editing ? editing.shipping : whole ? null : 3.5);
  const [city, setCity] = useState(editing?.city ?? '');
  const [country, setCountry] = useState(() => editing?.country ?? detectCountry() ?? 'LT');
  const [countryFilter, setCountryFilter] = useState('');
  // A new listing starts with the place the seller is connected from; they can change both.
  const [placed, setPlaced] = useState(!!editing);
  useEffect(() => {
    if (placed) return;
    locate().then((place) => {
      setPlaced(true);
      if (place.country) setCountry((c) => (c === (detectCountry() ?? 'LT') ? (place.country as string) : c));
      if (place.city) setCity((c) => c || place.city);
    });
  }, [placed]);
  const [allowOffers, setAllowOffers] = useState(editing?.allowOffers ?? true);
  const [classic, setClassic] = useState(editing?.classic ?? false);
  const [editCountry, setEditCountry] = useState(false);
  const [motorsport, setMotorsport] = useState(editing?.motorsport ?? false);
  const [description, setDescription] = useState(editing?.description ?? '');
  const [costText, setCostText] = useState(editing?.cost != null ? toText(editing.cost) : '');
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (editing || whole) return; // An existing listing already has its fields; a whole vehicle is described by the seller.
    let active = true;
    recognizePart(initialPhotos).then((r) => {
      if (!active) return;
      setTitle(r.title);
      setOem(r.oem);
      setFits(r.fits);
      setVehicleType(r.vehicleType);
      setDefects(r.suggestedDefects);
      setIsDemo(r.isDemo);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [initialPhotos, editing, whole]);

  const advice = useMemo(() => priceAdviceFromMarket(oem, editing ? listings.filter((l) => l.id !== editing.id) : listings, defects.length > 0), [oem, listings, defects.length, editing]);
  const price = parsePrice(priceText);

  const publish = async () => {
    if (publishing) return;
    if (!title.trim()) return setError('Įrašykite pavadinimą.');
    if (price === null) return setError('Įrašykite kainą, pvz., 85 arba 85,50.');
    if (!city.trim()) return setError('Įrašykite miestą, kuriame yra dalis.');
    const cost = costText.trim() ? parsePrice(costText) : null;
    if (costText.trim() && cost === null) return setError('Pirkimo kainą įrašykite skaičiumi, pvz., 20.');
    if (!registered) {
      // The form state is kept while the seller registers and comes back.
      router.push('/register');
      return;
    }
    if (!phone) return setError('Profilyje įrašykite telefono numerį – be jo skelbimo įdėti negalima.');
    setPublishing(true);
    const draft = {
      title: title.trim(), price, vat, condition, defects, oem: oem.trim(), fits: fits.trim(), vehicleType,
      city: city.trim(), country, shipping, pickup: true, photos, allowOffers,
      classic, motorsport, wholeVehicle: whole, description: description.trim(), donorId: donor ? donor.id : null, cost: donor ? null : cost,
    };
    if (editing) {
      const problem = await updateListing(editing.id, draft);
      setPublishing(false);
      if (problem) return setError(problem);
      return router.back();
    }
    const result = await addListing(whole ? draft : { description: description.trim(),
      title: title.trim(), price, vat, condition, defects, oem: oem.trim(), fits: fits.trim(), vehicleType,
      city: city.trim(), country, shipping, pickup: true, photos, allowOffers,
      classic, motorsport, donorId: donor ? donor.id : null, cost: donor ? null : cost,
    });
    setPublishing(false);
    if (!result.id) return setError(result.error ?? 'Nepavyko paskelbti.');
    router.replace(`/listing/${result.id}`);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
        <Text style={{ color: colors.muted, fontSize: 14 }}>Atpažįstame dalį…</Text>
      </View>
    );
  }

  return (
    <Page footer={<Button label={publishing ? 'Saugoma…' : editing ? 'Išsaugoti pakeitimus' : price !== null ? `Paskelbti už ${money(price)}` : 'Paskelbti'} onPress={publish} disabled={publishing} />}>
      {isDemo ? (
        <Notice tone="warn">Bandomoji versija: dalies atpažinimas dar neprijungtas, todėl laukai užpildyti pavyzdžiu. Pataisykite juos pagal savo dalį.</Notice>
      ) : (
        <Muted>{editing ? 'Keičiate paskelbtą skelbimą. Pakeitimus pirkėjai pamatys iškart.' : whole ? 'Visas automobilis dalims: aprašykite, kas veikia, kas pažeista ir ko trūksta. Pirkėjas automobilį pasiima pats.' : 'Užpildėme pagal jūsų nuotraukas. Peržiūrėkite ir pataisykite, jei ką supratome ne taip.'}</Muted>
      )}

      <Card>
        <Heading>Nuotraukos ({photos.length})</Heading>
        <PhotoEditor photos={photos} onChange={setPhotos} />
      </Card>

      <Card>
        <Field label="Pavadinimas" value={title} onChangeText={setTitle} />
        <Field label="Dalies (OEM) numeris" value={oem} onChangeText={setOem} hint="Pagal numerį pirkėjai ras dalį ir matysime panašių dalių kainas." />
        <Field label="Kam tinka" value={fits} onChangeText={setFits} placeholder="Pvz., VW Transporter T5, T6" />
        <Field
          label="Aprašymas (nebūtina)"
          value={description}
          onChangeText={(t) => setDescription(t.slice(0, 3000))}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          style={{ minHeight: 110 }}
          placeholder={whole ? 'Kas veikia, kas pažeista, ko trūksta, rida, variklis…' : 'Rida, iš kokio automobilio išimta, kas dar svarbu pirkėjui…'}
        />
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.ink }}>Transportas</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {TYPES.map((t) => (
            <Chip key={t} icon={VEHICLE_ICONS[t]} label={VEHICLE_LABELS[t]} selected={vehicleType === t} onPress={() => setVehicleType(t)} />
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip icon="car-convertible" label="Senovinio automobilio dalis" selected={classic} onPress={() => setClassic((v) => !v)} />
          <Chip icon="flag-checkered" label="Automotosporto dalis" selected={motorsport} onPress={() => setMotorsport((v) => !v)} />
        </View>
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.ink }}>Būklė</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CONDITIONS.map((c) => (
            <Chip key={c} label={CONDITION_LABELS[c]} selected={condition === c} onPress={() => setCondition(c)} />
          ))}
        </View>
      </Card>

      <Card style={{ backgroundColor: colors.warnSoft, borderColor: colors.warnBorder, borderWidth: 2 }}>
        <Text accessibilityRole="header" style={{ fontSize: 16, fontWeight: '700', color: colors.warn }}>
          {defects.length > 0 ? `Pažeidimai: ${defects.length}` : 'Pažeidimų nenurodyta'}
        </Text>
        {defects.map((d) => (
          <View key={d} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '500', color: colors.ink }}>{d}</Text>
            <Button label="Pašalinti" kind="quiet" onPress={() => setDefects((current) => current.filter((x) => x !== d))} />
          </View>
        ))}
        <Field label="Pridėti pažeidimą" value={newDefect} onChangeText={setNewDefect} placeholder="Pvz., įbrėžimas ant korpuso" />
        <Button
          label="Pridėti"
          kind="outline"
          disabled={!newDefect.trim()}
          onPress={() => {
            const text = newDefect.trim();
            if (text && !defects.includes(text)) setDefects((current) => [...current, text]);
            setNewDefect('');
          }}
        />
        <Text style={{ fontSize: 13, lineHeight: 19, color: colors.warn }}>Pažymėti pažeidimai bus aiškiai rodomi pirkėjui. Taip išvengsite ginčų ir grąžinimų.</Text>
      </Card>

      <Card>
        <Heading>Kaina</Heading>
        {advice ? (
          <View style={{ gap: 10 }}>
            <Notice>
              Kainos patarėjas: palyginome su {advice.count === 1 ? '1 skelbimu' : `${advice.count} skelbimais`} tuo pačiu numeriu mūsų rinkoje ({money(advice.min)}–{money(advice.max)}, vidurinė kaina {money(advice.median)}).
              {defects.length > 0 ? ' Dėl nurodytų pažeidimų siūlome 15 % mažiau.' : ''}
            </Notice>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Chip label={`Parduoti greitai · ${money(advice.quick)}`} selected={price === advice.quick} onPress={() => setPriceText(String(advice.quick).replace('.', ','))} />
              <Chip label={`Rinkos kaina · ${money(advice.fair)}`} selected={price === advice.fair} onPress={() => setPriceText(String(advice.fair).replace('.', ','))} />
              <Chip label={`Neskubu · ${money(advice.high)}`} selected={price === advice.high} onPress={() => setPriceText(String(advice.high).replace('.', ','))} />
            </View>
            {advice.comparables.map((c) => (
              <Text key={c.id} style={{ fontSize: 13, color: colors.muted }}>
                {money(c.price)} · {c.title} · {CONDITION_LABELS[c.condition].toLowerCase()}{c.defects > 0 ? ', su defektais' : ''} · {c.place}
              </Text>
            ))}
            <Muted>Kol kas lyginame tik su mūsų rinkos skelbimais. Palyginimas su kitų šalių viešomis kainomis bus pridėtas vėliau.</Muted>
          </View>
        ) : (
          <Muted>Kainos patarėjas pasiūlys kainą, kai rinkoje bus dalių su tokiu pačiu numeriu.</Muted>
        )}
        <Field label="Kaina, €" value={priceText} onChangeText={setPriceText} keyboardType="decimal-pad" placeholder="0,00" />
        {donor ? (
          <Muted>Dalis iš automobilio „{donor.name}“. Išlaidos skaičiuojamos pagal automobilio kainą ({money(donor.cost)}).</Muted>
        ) : (
          <Field label="Už kiek pirkote, € (nebūtina)" value={costText} onChangeText={setCostText} keyboardType="decimal-pad" placeholder="0,00" hint="Matote tik jūs. Pagal tai apskaita parodys pelną." />
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label="Be PVM" selected={!vat} onPress={() => setVat(false)} />
          <Chip label="Su PVM (PVM mokėtojams)" selected={vat} onPress={() => setVat(true)} />
        </View>
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.ink }}>Siuntos dydis (pristatymą moka pirkėjas)</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {SHIPPING.map((s) => (
            <Chip key={s.label} label={s.label} selected={shipping === s.price} onPress={() => setShipping(s.price)} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, color: colors.muted }}>Šalis, kurioje yra dalis</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>{countryLabel(country)}</Text>
          </View>
          <Button label={editCountry ? 'Gerai' : 'Keisti'} kind="outline" onPress={() => setEditCountry((v) => !v)} />
        </View>
        {editCountry ? (
          <>
            <Field label="Ieškoti šalies" value={countryFilter} onChangeText={setCountryFilter} placeholder="Pvz., Latvija" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {COUNTRIES.filter((c) => countryName(c).toLowerCase().includes(countryFilter.trim().toLowerCase()))
                .slice(0, countryFilter.trim() ? 46 : 10)
                .map((c) => (
                  <Chip key={c} label={countryLabel(c)} selected={country === c} onPress={() => { setCountry(c); setEditCountry(false); setCountryFilter(''); }} />
                ))}
            </View>
          </>
        ) : null}
        <Field label="Miestas" value={city} onChangeText={setCity} placeholder="Pvz., Kaunas" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label="Leisti siūlyti kainą" selected={allowOffers} onPress={() => setAllowOffers((v) => !v)} />
        </View>
      </Card>

      {error ? <Notice tone="warn">{error}</Notice> : null}
    </Page>
  );
}
