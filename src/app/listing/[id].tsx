import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { Photo, deliveryText } from '@/components/ListingCard';
import { PhotoEditor } from '@/components/PhotoEditor';
import { Button, Card, DefectBadge, Field, Muted, Notice, Page, Row } from '@/components/ui';
import { useStore } from '@/store';
import { colors, money } from '@/theme';
import { CONDITION_LABELS, VEHICLE_LABELS } from '@/types';

export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { listingById, userById, me, registered, live, ready, openThread, report, markSold, updatePhotos, blockUser, favorites, toggleFavorite, payReady } = useStore();
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [photoDraft, setPhotoDraft] = useState<string[] | null>(null);
  const [shown, setShown] = useState(0);
  const [saving, setSaving] = useState(false);
  const [soldText, setSoldText] = useState('');
  const [selling, setSelling] = useState(false);
  const [reported, setReported] = useState(false);
  const [error, setError] = useState('');
  const listing = listingById(id);

  if (!listing && !ready) {
    return (
      <Page>
        <Muted>Kraunama…</Muted>
      </Page>
    );
  }

  if (!listing) {
    return (
      <Page>
        <Muted>Šio skelbimo neberandame. Gali būti, kad dalis jau parduota.</Muted>
        <Button label="Į pradžią" kind="outline" onPress={() => router.replace('/')} />
      </Page>
    );
  }

  const seller = userById(listing.sellerId);
  const mine = listing.sellerId === me.id;
  const hasDefects = listing.defects.length > 0;
  // Paying through the platform is offered only when the seller has set up payouts.
  const canBuy = live && (listing.status ?? 'active') === 'active' && payReady.includes(listing.sellerId);

  const openChat = async () => {
    if (live && !registered) return router.push('/register');
    const opened = await openThread(listing.id);
    if (!opened.id) return setError(opened.error ?? 'Nepavyko pradėti pokalbio.');
    router.push(`/chat/${opened.id}`);
  };

  const sendReport = async () => {
    if (live && !registered) return router.push('/register');
    const problem = await report(listing.id);
    if (problem) return setError(problem);
    setReported(true);
  };

  return (
    <Page
      footer={
        mine ? (
          <Muted>{listing.status === 'sold' ? 'Tai jūsų parduota dalis.' : 'Tai jūsų skelbimas. Pirkėjai jį mato paieškoje.'}</Muted>
        ) : (
          <View style={{ gap: 10 }}>
            {canBuy ? (
              <Button label={`Pirkti · ${money(listing.price)}`} onPress={() => router.push(registered ? `/buy/${listing.id}` : '/register')} />
            ) : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {listing.allowOffers ? (
                <Button label="Siūlyti kainą" kind="outline" onPress={() => router.push(`/offer/${listing.id}`)} style={{ flex: 1 }} />
              ) : null}
              <Button label="Rašyti pardavėjui" kind={canBuy ? 'outline' : 'primary'} onPress={openChat} style={{ flex: 1 }} />
            </View>
          </View>
        )
      }>
      <View style={{ borderRadius: 14, overflow: 'hidden' }}>
        <Photo uri={listing.photos[Math.min(shown, Math.max(0, listing.photos.length - 1))]} height={260} />
        <View style={{ position: 'absolute', left: 12, bottom: 12 }}>
          <DefectBadge hasDefects={hasDefects} count={listing.defects.length} />
        </View>
      </View>

      {listing.photos.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {listing.photos.map((uri, index) => (
            <Button key={`${uri}-${index}`} label={`${index + 1}`} kind={index === shown ? 'dark' : 'outline'} onPress={() => setShown(index)} />
          ))}
        </View>
      ) : null}

      {mine && listing.status !== 'sold' ? (
        photoDraft === null ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button label="Redaguoti skelbimą" kind="outline" onPress={() => router.push({ pathname: '/sell/review', params: { edit: listing.id } })} style={{ flex: 1 }} />
            <Button label="Keisti nuotraukas" kind="outline" onPress={() => setPhotoDraft(listing.photos)} style={{ flex: 1 }} />
          </View>
        ) : (
          <Card>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.ink }}>Nuotraukos ({photoDraft.length})</Text>
            <PhotoEditor photos={photoDraft} onChange={setPhotoDraft} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button label="Atšaukti" kind="outline" onPress={() => setPhotoDraft(null)} style={{ flex: 1 }} />
              <Button
                label={saving ? 'Saugoma…' : 'Išsaugoti nuotraukas'}
                disabled={saving}
                style={{ flex: 1 }}
                onPress={async () => {
                  setSaving(true);
                  const problem = await updatePhotos(listing.id, photoDraft);
                  setSaving(false);
                  setError(problem ?? '');
                  if (!problem) {
                    setPhotoDraft(null);
                    setShown(0);
                  }
                }}
              />
            </View>
          </Card>
        )
      ) : null}

      <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '600', color: colors.ink }}>{listing.title}</Text>
      {mine ? null : (
        <Button
          label={favorites.includes(listing.id) ? 'Įsiminta – pašalinti' : 'Įsiminti skelbimą'}
          kind={favorites.includes(listing.id) ? 'dark' : 'outline'}
          onPress={async () => {
            if (live && !registered) return router.push('/register');
            setError((await toggleFavorite(listing.id)) ?? '');
          }}
        />
      )}
      <Text style={{ fontSize: 30, fontWeight: '700', color: colors.ink }}>
        {money(listing.price)}{' '}
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.muted }}>{listing.vat ? 'su PVM' : 'be PVM'}</Text>
      </Text>

      {hasDefects ? (
        <Notice tone="warn">Pardavėjo nurodyti pažeidimai: {listing.defects.join('; ')}.</Notice>
      ) : (
        <Notice>Pardavėjas pažeidimų nenurodė.</Notice>
      )}

      <Card style={{ gap: 0 }}>
        {listing.description ? <Text style={{ fontSize: 15, lineHeight: 23, color: colors.ink, marginBottom: 8 }}>{listing.description}</Text> : null}
        <Row label="Būklė" value={CONDITION_LABELS[listing.condition]} />
        <Row label="Transportas" value={`${VEHICLE_LABELS[listing.vehicleType]}${listing.classic ? ' · istorinis' : ''}`} />
        {listing.wholeVehicle ? <Row label="Parduodama" value="Visas automobilis dalims" /> : null}
        {listing.fits ? <Row label="Tinka" value={listing.fits} /> : null}
        {listing.oem ? <Row label="OEM numeris" value={listing.oem} /> : null}
        <Row label="Vieta" value={`${listing.city}, ${listing.country}`} />
        <Row label="Gavimas" value={listing.shipping === null ? deliveryText(listing) : `${deliveryText(listing)}${listing.pickup ? ' arba atsiėmimas' : ''}`} />
      </Card>

      <Card>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.ink }}>{seller.name}</Text>
        <Muted>
          {seller.kind === 'business' ? 'Verslo pardavėjas · taikoma 14 dienų grąžinimo teisė' : 'Privatus pardavėjas'}
          {seller.reviews > 0 ? ` · ${seller.rating.toFixed(1).replace('.', ',')} iš 5 (${seller.reviews})` : ' · atsiliepimų dar nėra'}
        </Muted>
        {seller.since ? <Muted>Prekiauja nuo {seller.since}</Muted> : null}
      </Card>

      {mine || !canBuy ? null : (
        <Notice>Perkant per Partaza pinigai pardavėjui pervedami tik tada, kai patvirtinate, kad dalį gavote ir ji tvarkinga.</Notice>
      )}
      {mine && live && listing.status !== 'sold' && !payReady.includes(me.id) ? (
        <Card>
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.ink }}>Priimkite mokėjimus per Partaza</Text>
          <Muted>Nustačius išmokas, pirkėjai šiame skelbime matys mygtuką „Pirkti“ ir galės sumokėti kortele.</Muted>
          <Button label="Nustatyti išmokas" kind="outline" onPress={() => router.push('/payouts')} />
        </Card>
      ) : null}
      {mine && listing.status === 'sold' ? (
        <Notice>Pažymėta kaip parduota{listing.soldPrice != null ? ` už ${money(listing.soldPrice)}` : ''}. Pirkėjai šio skelbimo nebemato.</Notice>
      ) : null}
      {mine && listing.status !== 'sold' ? (
        selling ? (
          <Card>
            <Field label="Už kiek pardavėte, €" value={soldText} onChangeText={setSoldText} keyboardType="decimal-pad" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button label="Atšaukti" kind="outline" onPress={() => setSelling(false)} style={{ flex: 1 }} />
              <Button
                label="Patvirtinti"
                style={{ flex: 1 }}
                onPress={async () => {
                  const value = Number(soldText.replace(',', '.'));
                  if (!Number.isFinite(value) || value <= 0) return setError('Įrašykite sumą, pvz., 80.');
                  const problem = await markSold(listing.id, Math.round(value * 100) / 100);
                  setError(problem ?? '');
                  setSelling(false);
                }}
              />
            </View>
            <Muted>Taip pažymėkite pardavimus, už kuriuos atsiskaityta ne per Partaza. Per Partaza apmokėtos dalys pažymimos savaime.</Muted>
          </Card>
        ) : (
          <Button
            label="Pažymėti kaip parduotą"
            kind="outline"
            onPress={() => {
              setSoldText(String(listing.price).replace('.', ','));
              setSelling(true);
            }}
          />
        )
      ) : null}
      {error ? <Notice tone="warn">{error}</Notice> : null}
      {mine ? null : reported ? (
        <Muted>{live ? 'Ačiū, pranešimas užregistruotas.' : 'Pažymėta. Bandomuoju režimu pranešimai niekur nesiunčiami.'}</Muted>
      ) : (
        <Button label="Pranešti apie skelbimą" kind="quiet" onPress={sendReport} />
      )}
      {mine ? null : confirmBlock ? (
        <Card>
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.ink }}>Blokuoti „{seller.name}“?</Text>
          <Muted>Nebematysite šio pardavėjo skelbimų ir pokalbių su juo, o jis nebegalės jums rašyti. Atblokuoti galima profilyje.</Muted>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button label="Atšaukti" kind="outline" onPress={() => setConfirmBlock(false)} style={{ flex: 1 }} />
            <Button
              label="Blokuoti"
              kind="dark"
              style={{ flex: 1 }}
              onPress={async () => {
                if (live && !registered) return router.push('/register');
                const problem = await blockUser(seller.id);
                if (problem) return setError(problem);
                router.back();
              }}
            />
          </View>
        </Card>
      ) : (
        <Button label="Blokuoti pardavėją" kind="quiet" onPress={() => setConfirmBlock(true)} />
      )}
    </Page>
  );
}
