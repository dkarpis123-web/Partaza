import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, View } from 'react-native';

import { CarPicker } from '@/components/CarPicker';
import { type Marks, remapMarks } from '@/components/MarkedPhoto';
import { PhotoEditor } from '@/components/PhotoEditor';
import { PriceOptions } from '@/components/PriceOptions';
import { ShippingEstimate } from '@/components/ShippingEstimate';
import { Button, Card, Chip, Field, Heading, Muted, Notice, Page } from '@/components/ui';
import { priceAdviceFromMarket, recognizePart, type Recognition, type WebPrices } from '@/services/ai';
import { COUNTRIES, CUSTOMS_NOTE, countryLabel, countryName, crossesEuBorder, detectCountry, useGeo } from '@/services/geo';
import { tr, useLang } from '@/i18n';
import { useStore } from '@/store';
import { colors, money } from '@/theme';
import { CONDITION_LABELS, Condition, Listing, VEHICLE_LABELS, VehicleType } from '@/types';
import { VEHICLE_ICONS } from '@/components/VehicleIcon';
import { Text } from '@/components/Text';

const TYPES = Object.keys(VEHICLE_LABELS) as VehicleType[];
const CONDITIONS = Object.keys(CONDITION_LABELS) as Condition[];
/** Only suggestions: the seller sets the real shipping price and answers for the difference. */
const SHIPPING: { label: string; price: number }[] = [
  { label: 'Maža, iki 2 kg · 2,90 €', price: 2.9 },
  { label: 'Vidutinė, iki 10 kg · 3,50 €', price: 3.5 },
  { label: 'Didelė, iki 30 kg · 5,90 €', price: 5.9 },
];
type ShipMode = 'price' | 'quote' | 'pickup';

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
  const params = useLocalSearchParams<{ photos?: string; marks?: string; donor?: string; whole?: string }>();
  const { listings, donors, registered, phone, addListing, updateListing, live, ready, aiRecognize, aiPrices, vatCode } = useStore();
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
  const [marks, setMarks] = useState<Marks>(() => {
    if (editing) return editing.photoMarks ?? {};
    try {
      const parsed = JSON.parse(params.marks ?? '{}');
      return parsed && typeof parsed === 'object' ? (parsed as Marks) : {};
    } catch {
      return {};
    }
  });

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
  const [shipMode, setShipMode] = useState<ShipMode>(editing ? (editing.shipping !== null ? 'price' : editing.shippingQuote ? 'quote' : 'pickup') : whole ? 'pickup' : 'price');
  const [abroadText, setAbroadText] = useState(editing?.shippingAbroad != null ? toText(editing.shippingAbroad) : '');
  const [shipText, setShipText] = useState(editing?.shipping != null ? toText(editing.shipping) : whole ? '' : '3,50');
  const [vatHint, setVatHint] = useState(false);
  const [city, setCity] = useState(editing?.city ?? '');
  const [country, setCountry] = useState(() => editing?.country ?? detectCountry() ?? 'LT');
  const [countryFilter, setCountryFilter] = useState('');
  // A new listing starts with the seller's own place, if they allowed location; they can change both.
  const { place } = useGeo();
  const [placedFrom, setPlacedFrom] = useState<string | null>(null);
  if (!editing && place?.country && placedFrom !== place.country) {
    setPlacedFrom(place.country);
    setCountry(place.country);
    if (place.city && !city) setCity(place.city);
  }
  const [allowOffers, setAllowOffers] = useState(editing?.allowOffers ?? true);
  const [classic, setClassic] = useState(editing?.classic ?? false);
  const [editCountry, setEditCountry] = useState(false);
  const [pickCar, setPickCar] = useState(false);
  const [motorsport, setMotorsport] = useState(editing?.motorsport ?? false);
  const [description, setDescription] = useState(editing?.description ?? '');
  const [costText, setCostText] = useState(editing?.cost != null ? toText(editing.cost) : '');
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);
  /** 'ok' | 'unsure' | an error text: how the AI recognition went. */
  const [aiNote, setAiNote] = useState('');
  // "Look again": the AI reads the current photos and proposes the fields; the seller decides whether to use them.
  const [againBusy, setAgainBusy] = useState(false);
  const [againProblem, setAgainProblem] = useState('');
  const [proposal, setProposal] = useState<Recognition | null>(null);
  const lookAgain = async () => {
    if (againBusy) return;
    if (!registered) return router.push('/register');
    setAgainBusy(true);
    setAgainProblem('');
    const answer = await aiRecognize(photos);
    setAgainBusy(false);
    setMarks((m) => remapMarks(m, photos, answer.photos));
    setPhotos(answer.photos);
    if (!answer.result) return setAgainProblem(answer.error ?? 'DI įrankis atsakė klaida. Bandykite dar kartą po minutės.');
    if (!answer.result.title) return setAgainProblem('DI nuotraukose dalies neatpažino. Užpildykite laukus patys.');
    setProposal(answer.result);
  };
  const applyProposal = () => {
    if (!proposal) return;
    setTitle(proposal.title);
    if (proposal.oem) setOem(proposal.oem);
    if (proposal.fits) setFits(proposal.fits);
    setVehicleType(proposal.vehicleType);
    if (proposal.suggestedDefects.length > 0) setDefects(proposal.suggestedDefects);
    setProposal(null);
  };
  const [webPrices, setWebPrices] = useState<WebPrices | null>(null);
  const [webBusy, setWebBusy] = useState(false);
  const [webProblem, setWebProblem] = useState('');
  const searchWeb = async () => {
    if (webBusy) return;
    setWebBusy(true);
    setWebProblem('');
    const answer = await aiPrices({ title: title.trim(), oem: oem.trim(), fits: fits.trim(), condition, defects: false, country }); // prices of undamaged parts; the discount for damage is ours
    setWebBusy(false);
    setWebPrices(answer.prices ?? null);
    setWebProblem(answer.error ?? '');
  };

  useEffect(() => {
    if (editing || whole) return; // An existing listing already has its fields; a whole vehicle is described by the seller.
    if (!ready) return; // Wait until we know whether the person is signed in.
    let active = true;
    const fill = (r: Recognition) => {
      setTitle(r.title);
      setOem(r.oem);
      setFits(r.fits);
      setVehicleType(r.vehicleType);
      setDefects(r.suggestedDefects);
      setIsDemo(r.isDemo);
    };
    if (!live) {
      recognizePart(initialPhotos).then((r) => {
        if (!active) return;
        fill(r);
        setLoading(false);
      });
    } else if (registered && initialPhotos.length > 0) {
      // The real thing: the photos are uploaded and the AI describes the part.
      aiRecognize(initialPhotos).then((answer) => {
        if (!active) return;
        setPhotos(answer.photos);
        setMarks((m) => remapMarks(m, initialPhotos, answer.photos));
        if (answer.result) fill(answer.result);
        setAiNote(answer.result ? (answer.result.title ? 'ok' : 'unsure') : answer.error ?? 'failed');
        setLoading(false);
      });
    } else {
      Promise.resolve().then(() => active && setLoading(false));
    }
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPhotos, editing, whole, live, registered, ready]);

  const fitsList = fits.split(',').map((f) => f.trim()).filter(Boolean);
  // Production years of the vehicle the part fits: added to the "fits" text as "2015–2018".
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const validYear = (t: string) => /^(19|20)\d\d$/.test(t.trim());
  const yearsText = validYear(yearFrom) ? (validYear(yearTo) && yearTo.trim() !== yearFrom.trim() ? `${yearFrom.trim()}–${yearTo.trim()}` : yearFrom.trim()) : '';
  const lastHasYear = fitsList.length > 0 && /(19|20)\d\d/.test(fitsList[fitsList.length - 1]);
  const advice = useMemo(() => priceAdviceFromMarket(oem, editing ? listings.filter((l) => l.id !== editing.id) : listings, defects.length > 0), [oem, listings, defects.length, editing]);
  const price = parsePrice(priceText);

  // Everything that stops the listing from being published, each tied to its field. Shown after the first try.
  const [tried, setTried] = useState(false);
  const found: Record<string, string> = {};
  if (!title.trim()) found.title = 'Įrašykite pavadinimą.';
  if (price === null) found.price = priceText.trim() ? 'Kainą įrašykite skaičiumi, pvz., 85 arba 85,50.' : 'Įrašykite kainą, pvz., 85 arba 85,50.';
  if (!city.trim()) found.city = 'Įrašykite miestą, kuriame yra dalis.';
  if (shipMode === 'price' && parsePrice(shipText) === null) found.ship = 'Įrašykite siuntimo kainą, pvz., 3,50, arba pasirinkite kitą siuntimo būdą.';
  if (shipMode === 'price' && abroadText.trim() && parsePrice(abroadText) === null) found.abroad = 'Siuntimo į kitas šalis kainą įrašykite skaičiumi, pvz., 12,00, arba palikite laukelį tuščią.';
  if (!donor && costText.trim() && parsePrice(costText) === null) found.cost = 'Pirkimo kainą įrašykite skaičiumi, pvz., 20.';
  const problems = Object.values(found);
  const shown = tried ? found : {};

  const publish = async () => {
    if (publishing) return;
    setTried(true);
    setError('');
    if (problems.length > 0) return;
    const shipping = shipMode === 'price' ? parsePrice(shipText) : null;
    const shippingAbroad = shipMode === 'price' && abroadText.trim() ? parsePrice(abroadText) : null;
    const shippingQuote = shipMode === 'quote';
    const cost = costText.trim() ? parsePrice(costText) : null;
    if (!registered) {
      // The form state is kept while the seller registers and comes back.
      router.push('/register');
      return;
    }
    if (!phone) return setError('Profilyje įrašykite telefono numerį – be jo skelbimo įdėti negalima.');
    if (price === null) return;
    setPublishing(true);
    const draft = {
      title: title.trim(), price, vat, condition, defects, oem: oem.trim(), fits: fits.trim(), vehicleType,
      city: city.trim(), country, shipping, shippingQuote, shippingAbroad, pickup: true, photos, photoMarks: marks, allowOffers,
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
      city: city.trim(), country, shipping, shippingQuote, shippingAbroad, pickup: true, photos, photoMarks: marks, allowOffers,
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
    <Page
      footer={
        <View style={{ gap: 8 }}>
          {tried && problems.length > 0 ? (
            <View accessibilityRole="alert" style={{ gap: 4, padding: 10, borderRadius: 10, borderWidth: 2, borderColor: '#B42318', backgroundColor: '#FEF3F2' }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#B42318' }}>{editing ? 'Kad išsaugotume, pataisykite:' : 'Kad paskelbtume, pataisykite:'}</Text>
              {problems.map((p) => (
                <Text key={p} style={{ fontSize: 14, color: '#7A271A' }}>{`• ${tr(p)}`}</Text>
              ))}
              <Text style={{ fontSize: 12, color: '#7A271A' }}>Šie laukai formoje pažymėti raudonai.</Text>
            </View>
          ) : null}
          {error ? <Notice tone="warn">{error}</Notice> : null}
          <Button label={publishing ? 'Saugoma…' : editing ? 'Išsaugoti pakeitimus' : price !== null ? `Paskelbti už ${money(price)}` : 'Paskelbti'} onPress={publish} disabled={publishing} />
        </View>
      }>
      {isDemo ? (
        <Notice tone="warn">Bandomoji versija: dalies atpažinimas dar neprijungtas, todėl laukai užpildyti pavyzdžiu. Pataisykite juos pagal savo dalį.</Notice>
      ) : aiNote && aiNote !== 'ok' ? (
        <Notice tone="warn">{aiNote === 'unsure' ? 'DI nuotraukose dalies neatpažino. Užpildykite laukus patys.' : `${tr('Dalies atpažinti nepavyko, užpildykite laukus patys.')} ${tr(aiNote)}`}</Notice>
      ) : live && !editing && !whole && aiNote !== 'ok' ? (
        <Muted>Užpildykite skelbimo laukus. Įdėjus nuotraukas prieš šį žingsnį, DI juos užpildo pats.</Muted>
      ) : (
        <Muted>{editing ? 'Keičiate paskelbtą skelbimą. Pakeitimus pirkėjai pamatys iškart.' : whole ? 'Visas automobilis dalims: aprašykite, kas veikia, kas pažeista ir ko trūksta. Pirkėjas automobilį pasiima pats.' : 'Užpildėme pagal jūsų nuotraukas. Peržiūrėkite ir pataisykite, jei ką supratome ne taip.'}</Muted>
      )}

      <Card>
        <Heading>Nuotraukos ({photos.length})</Heading>
        <PhotoEditor photos={photos} onChange={setPhotos} marks={marks} onMarks={setMarks} />
        {live && !whole && photos.length > 0 ? (
          <Button label={againBusy ? 'DI žiūri į nuotraukas…' : proposal ? 'DI: persvarstyti dar kartą' : 'DI: atpažinti iš naujo pagal nuotraukas'} kind="outline" disabled={againBusy} onPress={lookAgain} />
        ) : null}
        {againBusy ? <Muted>DI skaito numerius ir užrašus nuotraukose. Pagal dalies numerį ieškoma, kam ji tinka, todėl tai gali užtrukti iki minutės. Laukai nekeičiami be jūsų patvirtinimo.</Muted> : null}
        {againProblem ? <Notice tone="warn">{againProblem}</Notice> : null}
        {proposal ? (
          <View style={{ gap: 6, padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>DI siūlo pagal nuotraukas</Text>
            <Muted>{`${tr('Pavadinimas')}: ${proposal.title}`}</Muted>
            {proposal.oem ? <Muted>{`${tr('Dalies numeris')}: ${proposal.oem}`}</Muted> : null}
            {proposal.fits ? <Muted>{`${tr('Kam tinka')}: ${proposal.fits}`}</Muted> : null}
            {proposal.suggestedDefects.length > 0 ? <Muted>{`${tr('Defektai')}: ${proposal.suggestedDefects.join(', ')}`}</Muted> : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button label="Palikti kaip yra" kind="outline" onPress={() => setProposal(null)} style={{ flex: 1 }} />
              <Button label="Pritaikyti" onPress={applyProposal} style={{ flex: 1 }} />
            </View>
          </View>
        ) : null}
      </Card>

      <Card>
        <Field label="Pavadinimas" value={title} onChangeText={setTitle} error={shown.title} />
        <Field label="Dalies (OEM) numeris" value={oem} onChangeText={setOem} hint="Pagal numerį pirkėjai ras dalį ir matysime panašių dalių kainas." />
        <Field label="Kam tinka" value={fits} onChangeText={setFits} placeholder="Pvz., VW Transporter T5, T6" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Field label="Metai nuo (nebūtina)" value={yearFrom} onChangeText={(t) => setYearFrom(t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" placeholder="2015" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Metai iki" value={yearTo} onChangeText={(t) => setYearTo(t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" placeholder="2018" />
          </View>
        </View>
        {yearsText && fitsList.length > 0 && !lastHasYear ? (
          <Button
            label={`${tr('Pridėti metus prie')} „${fitsList[fitsList.length - 1]}“: ${yearsText}`}
            kind="outline"
            onPress={() => setFits([...fitsList.slice(0, -1), `${fitsList[fitsList.length - 1]} ${yearsText}`].join(', '))}
          />
        ) : null}
        <Muted>Įrašę metus ir tada pasirinkę modelį iš sąrašo, metus pridėsime automatiškai.</Muted>
        <Chip label={pickCar ? 'Slėpti markių sąrašą' : 'Pasirinkti markę ir modelį iš sąrašo'} selected={pickCar} onPress={() => setPickCar((v) => !v)} />
        {pickCar ? (
          <CarPicker
            type={vehicleType}
            picked={fitsList}
            onPick={(make, model) => {
              const item = `${make} ${model}`.trim();
              // Picking a car again removes it, with or without years after its name.
              const already = fitsList.filter((f) => f === item || f.startsWith(`${item} `));
              setFits(already.length > 0 ? fitsList.filter((f) => !already.includes(f)).join(', ') : [...fitsList, yearsText ? `${item} ${yearsText}` : item].join(', '));
            }}
          />
        ) : null}
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
          </View>
        ) : (
          <Muted>Mūsų rinkoje dalių su tokiu pačiu numeriu dar nėra, todėl palyginti nėra su kuo.</Muted>
        )}
        {live && registered ? (
          <View style={{ gap: 8 }}>
            <Button label={webBusy ? 'Ieškoma kainų internete…' : 'Ieškoti kainų internete (DI)'} kind="outline" disabled={webBusy} onPress={searchWeb} />
            {webBusy ? <Muted>Tai užtrunka apie pusę minutės.</Muted> : null}
            {webProblem ? <Notice tone="warn">{webProblem}</Notice> : null}
            {webPrices && !webPrices.found ? <Muted>{`${tr('Internete šios dalies kainų neradome.')} ${webPrices.note}`}</Muted> : null}
            {webPrices?.found ? (
              <View style={{ gap: 8 }}>
                <Notice>{`${tr('Internete panašios dalys siūlomos už')} ${money(webPrices.low ?? 0)}–${money(webPrices.high ?? 0)}, ${tr('dažniausiai apie')} ${money(webPrices.typical ?? 0)}. ${webPrices.note}`}</Notice>
                <PriceOptions prices={webPrices} damaged={defects.length > 0} current={price} onUse={(v) => setPriceText(String(v))} />
                {webPrices.sources.map((s) => (
                  <Pressable key={s.url} accessibilityRole="link" onPress={() => Linking.openURL(s.url)} style={{ minHeight: 32, justifyContent: 'center' }}>
                    <Text style={{ fontSize: 13, color: colors.accent, textDecorationLine: 'underline' }}>{`${s.price ? `${money(s.price)} · ` : ''}${s.title || s.url}`}</Text>
                  </Pressable>
                ))}
                <Muted>Kainas iš viešų puslapių surinko DI; jos gali būti netikslios. Prieš remdamiesi atsidarykite šaltinį.</Muted>
              </View>
            ) : null}
          </View>
        ) : null}
        <Field label="Kaina, €" value={priceText} onChangeText={setPriceText} keyboardType="decimal-pad" placeholder="0,00" error={shown.price} />
        {donor ? (
          <Muted>Dalis iš automobilio „{donor.name}“. Išlaidos skaičiuojamos pagal automobilio kainą ({money(donor.cost)}).</Muted>
        ) : (
          <Field label="Už kiek pirkote, € (nebūtina)" value={costText} onChangeText={setCostText} keyboardType="decimal-pad" placeholder="0,00" error={shown.cost} hint="Matote tik jūs. Pagal tai apskaita parodys pelną." />
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label="Be PVM" selected={!vat} onPress={() => setVat(false)} />
          <Chip label="Su PVM (PVM mokėtojams)" selected={vat} onPress={() => (live && !vatCode ? setVatHint(true) : setVat(true))} />
        </View>
        {vatHint && !vatCode ? (
          <Notice tone="warn">Kainą su PVM gali nurodyti tik pardavėjas, patvirtinęs PVM mokėtojo kodą profilyje.</Notice>
        ) : null}
        {vatHint && !vatCode ? <Button label="Įrašyti PVM kodą profilyje" kind="outline" onPress={() => router.push('/profile')} /> : null}
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.ink }}>Siuntimas (pristatymą moka pirkėjas)</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label="Nurodau siuntimo kainą" selected={shipMode === 'price'} onPress={() => setShipMode('price')} />
          <Chip label="Kainos nenurodau – pirkėjas siunčia užklausą" selected={shipMode === 'quote'} onPress={() => setShipMode('quote')} />
          <Chip label="Tik atsiėmimas vietoje" selected={shipMode === 'pickup'} onPress={() => setShipMode('pickup')} />
        </View>
        {shipMode === 'price' ? (
          <>
            <Field label="Siuntimo kaina jūsų šalyje, €" value={shipText} onChangeText={setShipText} keyboardType="decimal-pad" placeholder="0,00" error={shown.ship} />
            <Muted>Mūsų siūlomos kainos pagal siuntos dydį:</Muted>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {SHIPPING.map((s) => (
                <Chip key={s.label} label={s.label} selected={parsePrice(shipText) === s.price} onPress={() => setShipText(toText(s.price))} />
              ))}
            </View>
            {live && (title.trim() || oem.trim()) ? <ShippingEstimate title={title.trim()} oem={oem.trim()} fits={fits.trim()} from={country} to={country} current={parsePrice(shipText)} onUse={(p) => setShipText(toText(p))} /> : null}
            <Field label="Siuntimo kaina į kitas ES šalis, € (nebūtina)" value={abroadText} onChangeText={setAbroadText} keyboardType="decimal-pad" placeholder="0,00" error={shown.abroad} hint="Palikus tuščią, pirkėjas iš kitos šalies negalės apmokėti siuntimo – jis kainos klaus žinute." />
            <Notice tone="warn">Siuntimo kainą nustatote patys. Mūsų siūlomos kainos yra orientacinės ir gali skirtis nuo tikrų vežėjų kainų. Už siuntimo kainos skirtumą atsako pardavėjas.</Notice>
          </>
        ) : null}
        {shipMode !== 'pickup' ? <Muted>{crossesEuBorder(country, null) ? CUSTOMS_NOTE : 'Siunčiant ne į Europos Sąjungą, gali būti taikomi muito, importo PVM ir kiti mokesčiai.'}</Muted> : null}
        {shipMode === 'quote' ? <Muted>Pirkėjas matys mygtuką „Klausti siuntimo kainos“ ir parašys jums žinutę su savo šalimi ir miestu.</Muted> : null}
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
        <Field label="Miestas" value={city} onChangeText={setCity} placeholder="Pvz., Kaunas" error={shown.city} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label="Leisti siūlyti kainą" selected={allowOffers} onPress={() => setAllowOffers((v) => !v)} />
        </View>
      </Card>

      {publishing ? <Notice>Keliamos nuotraukos ir saugomas skelbimas. Tai gali užtrukti iki minutės – neuždarykite lango.</Notice> : null}
    </Page>
  );
}
