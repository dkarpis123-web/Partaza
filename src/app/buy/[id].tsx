import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Card, Chip, Muted, Notice, Page, Row } from '@/components/ui';
import { openExternal } from '@/services/open';
import { useStore } from '@/store';
import { ADMIN_FEE, buyerFee, colors, money } from '@/theme';

/** PaidOrder summary before the buyer is sent to the payment page. */
export default function BuyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { listingById, userById, threadForListing, me, registered, live, ready, payReady, buy } = useStore();
  const listing = listingById(id);
  const canShip = !!listing && listing.shipping !== null;
  const canPickup = !!listing && listing.pickup;
  const [choice, setChoice] = useState<'shipping' | 'pickup' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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

  const delivery = choice ?? (canShip ? 'shipping' : 'pickup');
  // The server decides the final price the same way: the listing price or the latest accepted offer.
  const accepted = [...(threadForListing(listing.id)?.messages ?? [])].reverse().find((m) => m.kind === 'offer' && m.status === 'accepted');
  const price = accepted?.amount != null ? Math.min(accepted.amount, listing.price) : listing.price;
  const shipping = delivery === 'shipping' ? listing.shipping ?? 0 : 0;
  const fee = buyerFee(price + shipping);
  const total = Math.round((price + shipping + fee + ADMIN_FEE) * 100) / 100;
  const seller = userById(listing.sellerId);

  const start = async () => {
    setBusy(true);
    setError('');
    const answer = await buy(listing.id, delivery);
    if (answer.url) return openExternal(answer.url);
    setBusy(false);
    setError(answer.error ?? 'Nepavyko pradėti mokėjimo.');
  };

  return (
    <Page footer={<Button label={busy ? 'Atidaromas mokėjimas…' : `Mokėti ${money(total)}`} disabled={busy} onPress={start} />}>
      <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '600', color: colors.ink }}>{listing.title}</Text>
      <Muted>Pardavėjas: {seller.name}</Muted>

      {canShip && canPickup ? (
        <Card>
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.ink }}>Kaip gausite dalį?</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label={`Pristatymas · ${money(listing.shipping ?? 0)}`} selected={delivery === 'shipping'} onPress={() => setChoice('shipping')} />
            <Chip label={`Atsiimsiu pats · ${listing.city}`} selected={delivery === 'pickup'} onPress={() => setChoice('pickup')} />
          </View>
        </Card>
      ) : null}

      <Card style={{ gap: 0 }}>
        <Row label={accepted ? 'Sutarta kaina' : 'Kaina'} value={`${money(price)} ${listing.vat ? 'su PVM' : 'be PVM'}`} />
        <Row label={delivery === 'shipping' ? 'Pristatymas' : 'Atsiėmimas'} value={delivery === 'shipping' ? money(shipping) : `${listing.city}, nemokamai`} />
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
