import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';

import { ListingGrid } from '@/components/ListingCard';
import { BlockedUsers } from '@/components/BlockedUsers';
import { SellerLogo } from '@/components/SellerLogo';
import { Button, Card, Chip, Field, Heading, Muted, Notice, Page } from '@/components/ui';
import { normalizePhone } from '@/services/phone';
import { STALE_DAYS, staleListings } from '@/services/stats';
import { tr, useLang } from '@/i18n';
import { useStore } from '@/store';
import { MAX_WIDTH, colors, money } from '@/theme';
import { PAID_ORDER_LABELS } from '@/types';
import { Text } from '@/components/Text';

export default function ProfileScreen() {
  const router = useRouter();
  useLang();
  const { me, registered, listings, live, phone, setPhone, setKind, setLogo, signOut, deleteAccount, reducePrice, favorites, following, orders, paidOrders, payReady, userById } = useStore();
  const openOrders = orders.filter((o) => o.status === 'agreed' || o.status === 'handed').length;
  const saved = listings.filter((l) => favorites.includes(l.id) && (l.status ?? 'active') === 'active');
  const [now] = useState(() => Date.now());
  const stale = staleListings(listings, me.id, now);
  const [phoneText, setPhoneText] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const show = (problem: string | null) => setError(problem ?? '');
  const [logoBusy, setLogoBusy] = useState(false);
  const pickLogo = async () => {
    if (logoBusy) return;
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (picked.canceled || !picked.assets[0]) return;
    setLogoBusy(true);
    show(await setLogo(picked.assets[0].uri));
    setLogoBusy(false);
  };
  const mine = listings.filter((l) => l.sellerId === me.id);

  if (!registered) {
    return (
      <Page>
        <Heading>Profilis</Heading>
        <Muted>Užsiregistruokite, kad pirkėjai matytų, kas parduoda dalį.</Muted>
        <Button label={live ? 'Registruotis arba prisijungti' : 'Registruotis'} onPress={() => router.push('/register')} />
      </Page>
    );
  }

  return (
    <Page>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <SellerLogo uri={me.logo} name={me.name} size={64} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.ink }}>{me.name}</Text>
            <Muted>{`${tr(me.kind === 'business' ? 'Verslo pardavėjas' : 'Privatus pardavėjas')} · ${me.reviews > 0 ? `${me.rating.toFixed(1).replace('.', ',')} ${tr('iš 5')} (${me.reviews})` : tr('atsiliepimų dar nėra')}`}</Muted>
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label={logoBusy ? 'Įkeliama…' : me.logo ? 'Keisti nuotrauką ar logotipą' : 'Įkelti savo nuotrauką ar logotipą'} selected={false} onPress={pickLogo} />
          {me.logo ? <Chip label="Pašalinti nuotrauką" selected={false} onPress={async () => show(await setLogo(null))} /> : null}
        </View>
        <Muted>Nuotrauką ar logotipą pirkėjai mato jūsų skelbimuose.</Muted>
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.ink }}>Pardavėjo statusas</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label="Privatus asmuo" selected={me.kind === 'private'} onPress={async () => show(await setKind('private'))} />
          <Chip label="Verslas" selected={me.kind === 'business'} onPress={async () => show(await setKind('business'))} />
        </View>
        <Muted>Statusą pirkėjai mato kiekviename jūsų skelbime. Verslo pardavėjų pirkėjams taikoma 14 dienų grąžinimo teisė.</Muted>
      </Card>

      <Card>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.ink }}>Telefono numeris</Text>
        {phoneText === null ? (
          <>
            {phone ? <Muted>{phone} · kitiems naudotojams nerodomas</Muted> : <Notice tone="warn">Telefono numeris būtinas. Be jo skelbimo įdėti negalima.</Notice>}
            <Button label={phone ? 'Keisti numerį' : 'Įrašyti numerį'} kind="outline" onPress={() => setPhoneText(phone)} />
          </>
        ) : (
          <>
            <Field label="Telefono numeris" value={phoneText} onChangeText={setPhoneText} keyboardType="phone-pad" autoComplete="tel" placeholder="+37061234567" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button label="Atšaukti" kind="outline" onPress={() => { setPhoneText(null); setError(''); }} style={{ flex: 1 }} />
              <Button
                label="Išsaugoti"
                style={{ flex: 1 }}
                onPress={async () => {
                  const value = normalizePhone(phoneText);
                  if (!value) return setError('Įrašykite telefono numerį, pvz., +37061234567.');
                  const problem = await setPhone(value);
                  show(problem);
                  if (!problem) setPhoneText(null);
                }}
              />
            </View>
          </>
        )}
      </Card>

      <BlockedUsers />

      {live ? (
        <Card>
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.ink }}>Mokėjimai ir išmokos</Text>
          <Muted>{payReady.includes(me.id) ? 'Išmokos įjungtos – pirkėjai gali sumokėti už jūsų dalis per Partaza.' : 'Nustatykite išmokas, kad pirkėjai galėtų sumokėti už jūsų dalis kortele per Partaza.'}</Muted>
          <Button label={payReady.includes(me.id) ? 'Tvarkyti išmokas' : 'Nustatyti išmokas'} kind="outline" onPress={() => router.push('/payouts')} />
        </Card>
      ) : null}

      {paidOrders.length > 0 ? (
        <Card>
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.ink }}>Apmokėti užsakymai ({paidOrders.length})</Text>
          {paidOrders.map((o) => {
            const bought = o.buyerId === me.id;
            const needsMe = bought ? o.status === 'shipped' || o.status === 'received' : o.status === 'paid';
            return (
              <View key={o.id} style={{ gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={{ fontSize: 14, fontWeight: needsMe ? '700' : '400', color: colors.ink }}>
                  {bought ? 'Pirkau' : 'Pardaviau'}: {o.title} · {money(bought ? o.total : o.itemAmount + o.shippingAmount)}
                </Text>
                <Muted>{PAID_ORDER_LABELS[o.status]} · {bought ? 'pardavėjas' : 'pirkėjas'} {userById(bought ? o.sellerId : o.buyerId).name}{needsMe ? ' · laukia jūsų veiksmo' : ''}</Muted>
                <Button label="Atidaryti užsakymą" kind={needsMe ? 'primary' : 'outline'} onPress={() => router.push(`/payment/${o.id}`)} />
              </View>
            );
          })}
        </Card>
      ) : null}

      <Button label={openOrders > 0 ? `Užsakymai (${openOrders} vykdomi)` : 'Užsakymai'} kind="outline" onPress={() => router.push('/orders')} />
      <Button label="Mano prekyba: pajamos, išlaidos, pelnas" kind="dark" onPress={() => router.push('/dashboard')} />

      {stale.length > 0 ? (
        <Card>
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.ink }}>Verta peržiūrėti ({stale.length})</Text>
          <Muted>Šios dalys neparduotos {STALE_DAYS} dienų ar ilgiau. Dažniausiai padeda mažesnė kaina arba geresnės nuotraukos.</Muted>
          {stale.map(({ listing, days, suggested }) => (
            <View key={listing.id} style={{ gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={{ fontSize: 14, color: colors.ink }}>{listing.title} · {money(listing.price)} · {days} d.</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button label={`Sumažinti iki ${money(suggested)}`} style={{ flex: 1 }} onPress={async () => show(await reducePrice(listing.id, suggested))} />
                <Button label="Atidaryti" kind="outline" style={{ flex: 1 }} onPress={() => router.push(`/listing/${listing.id}`)} />
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {following.length > 0 ? (
        <Card>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.ink }}>Sekami pardavėjai ({following.length})</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {following.map((sellerId) => (
              <Chip key={sellerId} label={userById(sellerId).name} selected={false} onPress={() => router.push(`/seller/${sellerId}`)} />
            ))}
          </View>
        </Card>
      ) : null}

      {saved.length > 0 ? (
        <>
          <Heading>Įsiminti skelbimai ({saved.length})</Heading>
          <ListingGrid listings={saved} width={Math.min(width, MAX_WIDTH)} />
        </>
      ) : null}

      <Heading>Mano skelbimai ({mine.length})</Heading>
      {mine.length === 0 ? (
        <>
          <Muted>Skelbimų dar nėra.</Muted>
          <Button label="Parduoti dalį" onPress={() => router.push('/sell')} />
        </>
      ) : (
        <ListingGrid listings={mine} width={Math.min(width, MAX_WIDTH)} />
      )}

      {error ? <Notice tone="warn">{error}</Notice> : null}

      {confirmDelete ? (
        <Card>
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.ink }}>Ištrinti paskyrą ir visus savo skelbimus?</Text>
          <Muted>Šio veiksmo atšaukti nebus galima.</Muted>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button label="Palikti" kind="outline" onPress={() => setConfirmDelete(false)} style={{ flex: 1 }} />
            <Button
              label="Ištrinti"
              kind="dark"
              onPress={async () => {
                show(await deleteAccount());
                setConfirmDelete(false);
              }}
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      ) : (
        <>
          {live ? <Button label="Atsijungti" kind="outline" onPress={async () => show(await signOut())} /> : null}
          <Button label="Ištrinti paskyrą" kind="quiet" onPress={() => setConfirmDelete(true)} />
        </>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Button label="Programėlė telefonui" kind="quiet" onPress={() => router.push('/app')} />
        <Button label="Taisyklės" kind="quiet" onPress={() => router.push('/terms')} />
        <Button label="Privatumo politika" kind="quiet" onPress={() => router.push('/privacy')} />
      </View>
    </Page>
  );
}
