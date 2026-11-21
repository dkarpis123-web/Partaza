import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Card, Chip, Muted, Notice, Page, Row } from '@/components/ui';
import { COUNTRIES, CUSTOMS_NOTE, crossesEuBorder, countryLabel, countryName, setDestination, useDestination } from '@/services/geo';
import { normalize } from '@/services/match';
import { openExternal } from '@/services/open';
import { shippingTo } from '@/services/shipping';
import { useStore } from '@/store';
import { ADMIN_FEE, buyerFee, colors, money, radius } from '@/theme';
import { Text, TextInput } from '@/components/Text';
import { tr } from '@/i18n';

/** PaidOrder summary before the buyer is sent to the payment page. */
export default function BuyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { listings, listingById, userById, threadForListing, me, registered, live, ready, payReady, buy } = useStore();
  const listing = listingById(id);
  const canShip = !!listing && listing.shipping !== null;
  const canPickup = !!listing && listing.pickup;
  const [choice, setChoice] = useState<'shipping' | 'pickup' | null>(null);
  const [busy, setBusy] = useState(false);
  const picked = useDestination().country;
  const [editCountry, setEditCountry] = useState(false);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  // More parts of the same seller in the same parcel.
  const [extraIds, setExtraIds] = useState<string[]>([]);

  if (!listing || (listing.status ?? 'active') !== 'active') {
    return (
      <Page>
        <Muted>{ready ? 'Šio skelbimo neberandame. Gali būti, kad dalis jau parduota.' : 'Kraunama…'}</Muted>
        {ready ? <Button label="Į pradžią" kind="outline" onPress={() => router.replace('/')} /> : null}
      </Page>
    );
  }
  if (!live || !registered) {
    return (
      <Page>
        <Muted>{live ? 'Norėdami pirkti, prisijunkite.' : 'Bandomuoju režimu mokėjimų nėra.'}</Muted>
        {live ? <Button label="Registruotis arba prisijungti" onPress={() => router.push('/register')} /> : null}
      </Page>
    );
  }
  if (listing.sellerId === me.id || !payReady.includes(listing.sellerId)) {
    return (
      <Page>
        <Muted>{listing.sellerId === me.id ? 'Tai jūsų skelbimas.' : 'Pardavėjas dar nepriima mokėjimų per Partaza. Dėl atsiskaitymo susitarkite žinutėmis.'}</Muted>
        <Button label="Atgal į skelbimą" kind="outline" onPress={() => router.replace(`/listing/${listing.id}`)} />
      </Page>
    );
  }

  // Delivery is priced for one country: the buyer's chosen one, or the seller's own until they choose.
  const shipCountry = picked ?? listing.country;
  const shipPrice = shippingTo(listing, shipCountry);
  const delivery = choice ?? (canShip && (shipPrice !== null || !canPickup) ? 'shipping' : 'pickup');
  const blocked = delivery === 'shipping' && shipPrice === null;
  const choices = COUNTRIES.filter((code) => normalize(countryName(code)).includes(normalize(filter))).slice(0, filter.trim() ? 12 : 8);
  // The server decides the final price the same way: the listing price or the latest accepted offer.
  const agreed = (l: typeof listing) => {
    const offer = [...(threadForListing(l.id)?.messages ?? [])].reverse().find((m) => m.kind === 'offer' && m.status === 'accepted');
    return offer?.amount != null ? Math.min(offer.amount, l.price) : l.price;
  };
  const accepted = agreed(listing) < listing.price;
  // Other parts of this seller that can travel the same way: the buyer may add them to one parcel.
  const others = listings.filter((l) => l.sellerId === listing.sellerId && l.id !== listing.id && (l.status ?? 'active') === 'active'
    && (delivery === 'shipping' ? shippingTo(l, shipCountry) !== null : l.pickup)).slice(0, 20);
  const extras = others.filter((l) => extraIds.includes(l.id)).slice(0, 9);
  const price = Math.round((agreed(listing) + extras.reduce((sum, l) => sum + agreed(l), 0)) * 100) / 100;
  // One parcel: the highest delivery price among the chosen parts is charged once.
  const shipping = delivery === 'shipping' ? Math.max(shipPrice ?? 0, ...extras.map((l) => shippingTo(l, shipCountry) ?? 0)) : 0;
  const fee = buyerFee(price + shipping);
  const total = Math.round((price + shipping + fee + ADMIN_FEE) * 100) / 100;
  const seller = userById(listing.sellerId);

  const start = async () => {
    setBusy(true);
    setError('');
    const answer = await buy(listing.id, delivery, delivery === 'shipping' ? shipCountry : undefined, extras.map((l) => l.id));
    if (answer.url) return openExternal(answer.url);
    setBusy(false);
    setError(answer.error ?? 'Nepavyko pradėti mokėjimo.');
  };

  return (
    <Page footer={<Button label={blocked ? 'Siuntimui apmokėti reikia kainos' : busy ? 'Atidaromas mokėjimas…' : `Mokėti ${money(total)}`} disabled={busy || blocked} onPress={start} />}>
      <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '600', color: colors.ink }}>{listing.title}</Text>
      <Muted>Pardavėjas: {seller.name}</Muted>

      {canShip && canPickup ? (
        <Card>
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.ink }}>Kaip gausite dalį?</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label={shipPrice === null ? 'Pristatymas' : `Pristatymas · ${money(shipPrice)}`} selected={delivery === 'shipping'} onPress={() => setChoice('shipping')} />
            <Chip label={`Atsiimsiu pats · ${listing.city}`} selected={delivery === 'pickup'} onPress={() => setChoice('pickup')} />
          </View>
        </Card>
      ) : null}

      {delivery === 'shipping' ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: colors.muted }}>Kur siųsti?</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>{countryLabel(shipCountry)}</Text>
            </View>
            <Button label={editCountry ? 'Gerai' : 'Keisti'} kind="outline" onPress={() => setEditCountry((v) => !v)} />
          </View>
          {editCountry ? (
            <>
              <TextInput
                accessibilityLabel="Gavėjo šalis"
                placeholder="Ieškoti šalies"
                placeholderTextColor={colors.muted}
                value={filter}
                onChangeText={setFilter}
                style={{ minHeight: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, fontSize: 15, color: colors.ink }}
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {choices.map((code) => (
                  <Chip key={code} label={countryLabel(code)} selected={shipCountry === code} onPress={() => { setDestination(code); setEditCountry(false); setFilter(''); }} />
                ))}
              </View>
            </>
          ) : null}
          {crossesEuBorder(listing.country, shipCountry) ? <Muted>{CUSTOMS_NOTE}</Muted> : null}
          {blocked ? (
            <>
              <Notice tone="warn">Pardavėjas nenurodė siuntimo kainos į šią šalį, todėl apmokėti siuntimo dar negalima. Paklauskite kainos – sutarus pardavėjas ją įrašys skelbime.</Notice>
              <Button label="Klausti siuntimo kainos skelbime" kind="outline" onPress={() => router.replace(`/listing/${listing.id}`)} />
            </>
          ) : null}
        </Card>
      ) : null}

      {others.length > 0 ? (
        <Card>
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.ink }}>{`${tr('Kitos šio pardavėjo dalys')} (${others.length})`}</Text>
          <Muted>{delivery === 'shipping' ? 'Pridėkite jas prie to paties siuntimo – už pristatymą mokėsite vieną kartą.' : 'Pridėkite jas ir atsiimsite viską kartu.'}</Muted>
          {others.map((l) => {
            const on = extraIds.includes(l.id);
            return (
              <Pressable
                key={l.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => setExtraIds((ids) => (on ? ids.filter((x) => x !== l.id) : ids.length >= 9 ? ids : [...ids, l.id]))}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.line }}>
                <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: on ? colors.ink : colors.border, backgroundColor: on ? colors.ink : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {on ? <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>✓</Text> : null}
                </View>
                <Text numberOfLines={2} style={{ flex: 1, fontSize: 14, color: colors.ink }}>{l.title}</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>{money(agreed(l))}</Text>
              </Pressable>
            );
          })}
        </Card>
      ) : null}

      <Card style={{ gap: 0 }}>
        <Row label={extras.length > 0 ? `${tr('Dalys')} (${extras.length + 1})` : accepted ? 'Sutarta kaina' : 'Kaina'} value={`${money(price)}${extras.length > 0 ? '' : ` ${listing.vat ? 'su PVM' : 'be PVM'}`}`} />
        <Row label={delivery === 'shipping' ? (extras.length > 0 ? 'Pristatymas (viena siunta)' : 'Pristatymas') : 'Atsiėmimas'} value={delivery === 'shipping' ? (blocked ? '–' : money(shipping)) : `${listing.city}, nemokamai`} />
        <Row label="Pirkėjo apsauga" value={money(fee)} />
        <Row label="Administravimo mokestis" value={money(ADMIN_FEE)} />
        <Row label="Iš viso" value={money(total)} strong />
      </Card>

      <Notice>
        Pinigai pardavėjui nepervedami iš karto: juos laiko mokėjimų bendrovė „Stripe“. Pardavėjas juos gaus, kai patvirtinsite, kad dalį gavote ir ji tvarkinga. Gavę dalį turite 5 dienas jai patikrinti. Pirkėjo apsaugos mokestis (4,5 % + 0,45 €) padengia saugų mokėjimą ir pinigų laikymą iki gavimo, o 1 € administravimo mokestis – užsakymo tvarkymą.
      </Notice>
      <Muted>
        {delivery === 'shipping'
          ? 'Pristatymo adresą ir telefoną įrašysite mokėjimo lange. Juos matys tik pardavėjas.'
          : 'Dėl atsiėmimo laiko ir vietos susitarkite su pardavėju žinutėmis.'}
        {' '}Mokėjimas vyksta saugiame „Stripe“ puslapyje – kortelės duomenų Partaza nemato.
      </Muted>
      {error ? <Notice tone="warn">{error}</Notice> : null}
    </Page>
  );
}
