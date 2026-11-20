import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { PhotoEditor } from '@/components/PhotoEditor';
import { Button, Card, Chip, Field, Heading, Muted, Notice, Page } from '@/components/ui';
import { priceAdviceFromMarket, recognizePart } from '@/services/ai';
import { useStore } from '@/store';
import { colors, money } from '@/theme';
import { CONDITION_LABELS, Condition, VEHICLE_LABELS, VehicleType } from '@/types';

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

export default function ReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ photos?: string; donor?: string }>();
  const { listings, donors, registered, phone, addListing } = useStore();
  const donor = donors.find((d) => d.id === params.donor);

  const initialPhotos = useMemo<string[]>(() => {
    try {
      const parsed = JSON.parse(params.photos ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : [];
    } catch {
      return [];
    }
  }, [params.photos]);
  // The seller can still add, remove or retake photos here before publishing.
  const [photos, setPhotos] = useState<string[]>(initialPhotos);

  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [title, setTitle] = useState('');
  const [oem, setOem] = useState('');
  const [fits, setFits] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('car');
  const [condition, setCondition] = useState<Condition>('used');
  const [defects, setDefects] = useState<string[]>([]);
  const [newDefect, setNewDefect] = useState('');
  const [priceText, setPriceText] = useState('');
  const [vat, setVat] = useState(false);
  const [shipping, setShipping] = useState<number | null>(3.5);
  const [city, setCity] = useState('');
  const [allowOffers, setAllowOffers] = useState(true);
  const [classic, setClassic] = useState(false);
  const [costText, setCostText] = useState('');
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
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
  }, [initialPhotos]);

  const advice = useMemo(() => priceAdviceFromMarket(oem, listings, defects.length > 0), [oem, listings, defects.length]);
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
    const result = await addListing({
      title: title.trim(), price, vat, condition, defects, oem: oem.trim(), fits: fits.trim(), vehicleType,
      city: city.trim(), country: 'Lietuva', shipping, pickup: true, photos, allowOffers,
      classic, donorId: donor ? donor.id : null, cost: donor ? null : cost,
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
    <Page footer={<Button label={publishing ? 'Skelbiama…' : price !== null ? `Paskelbti už ${money(price)}` : 'Paskelbti'} onPress={publish} disabled={publishing} />}>
      {isDemo ? (
        <Notice tone="warn">Bandomoji versija: dalies atpažinimas dar neprijungtas, todėl laukai užpildyti pavyzdžiu. Pataisykite juos pagal savo dalį.</Notice>
      ) : (
        <Muted>Užpildėme pagal jūsų nuotraukas. Peržiūrėkite ir pataisykite, jei ką supratome ne taip.</Muted>
      )}

      <Card>
        <Heading>Nuotraukos ({photos.length})</Heading>
        <PhotoEditor photos={photos} onChange={setPhotos} />
      </Card>

      <Card>
        <Field label="Pavadinimas" value={title} onChangeText={setTitle} />
        <Field label="Dalies (OEM) numeris" value={oem} onChangeText={setOem} hint="Pagal numerį pirkėjai ras dalį ir matysime panašių dalių kainas." />
        <Field label="Kam tinka" value={fits} onChangeText={setFits} placeholder="Pvz., VW Transporter T5, T6" />
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.ink }}>Transportas</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {TYPES.map((t) => (
            <Chip key={t} label={VEHICLE_LABELS[t]} selected={vehicleType === t} onPress={() => setVehicleType(t)} />
          ))}
        </ScrollView>
        <Chip label="Istorinio automobilio dalis" selected={classic} onPress={() => setClassic((v) => !v)} />
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
        <Field label="Miestas" value={city} onChangeText={setCity} placeholder="Pvz., Kaunas" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label="Leisti siūlyti kainą" selected={allowOffers} onPress={() => setAllowOffers((v) => !v)} />
        </View>
      </Card>

      {error ? <Notice tone="warn">{error}</Notice> : null}
    </Page>
  );
}
