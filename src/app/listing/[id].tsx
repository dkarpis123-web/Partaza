import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { Photo, deliveryText } from '@/components/ListingCard';
import { Button, Card, DefectBadge, Field, Muted, Notice, Page, Row } from '@/components/ui';
import { useStore } from '@/store';
import { colors, money } from '@/theme';
import { CONDITION_LABELS, VEHICLE_LABELS } from '@/types';

export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { listingById, userById, me, registered, live, ready, openThread, report, markSold } = useStore();
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
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {listing.allowOffers ? (
              <Button label="Siūlyti kainą" kind="outline" onPress={() => router.push(`/offer/${listing.id}`)} style={{ flex: 1 }} />
            ) : null}
            <Button label="Rašyti pardavėjui" onPress={openChat} style={{ flex: 1 }} />
          </View>
        )
      }>
      <View style={{ borderRadius: 14, overflow: 'hidden' }}>
        <Photo uri={listing.photos[0]} height={260} />
        <View style={{ position: 'absolute', left: 12, bottom: 12 }}>
          <DefectBadge hasDefects={hasDefects} count={listing.defects.length} />
        </View>
      </View>

      <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '600', color: colors.ink }}>{listing.title}</Text>
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
        <Row label="Būklė" value={CONDITION_LABELS[listing.condition]} />
        <Row label="Transportas" value={`${VEHICLE_LABELS[listing.vehicleType]}${listing.classic ? ' · istorinis' : ''}`} />
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
            <Muted>Kol mokėjimai per programėlę neprijungti, pardavimą pažymite patys. Vėliau tai vyks automatiškai.</Muted>
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
    </Page>
  );
}
