import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';

import { ListingGrid } from '@/components/ListingCard';
import { Button, Card, Chip, Heading, Muted, Notice, Page } from '@/components/ui';
import { useStore } from '@/store';
import { MAX_WIDTH, colors } from '@/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { me, registered, listings, live, setKind, signOut, deleteAccount } = useStore();
  const { width } = useWindowDimensions();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const show = (problem: string | null) => setError(problem ?? '');
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
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.ink }}>{me.name}</Text>
        <Muted>{me.kind === 'business' ? 'Verslo pardavėjas' : 'Privatus pardavėjas'} · atsiliepimų dar nėra</Muted>
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.ink }}>Pardavėjo statusas</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label="Privatus asmuo" selected={me.kind === 'private'} onPress={async () => show(await setKind('private'))} />
          <Chip label="Verslas" selected={me.kind === 'business'} onPress={async () => show(await setKind('business'))} />
        </View>
        <Muted>Statusą pirkėjai mato kiekviename jūsų skelbime. Verslo pardavėjų pirkėjams taikoma 14 dienų grąžinimo teisė.</Muted>
      </Card>

      <Button label="Mano prekyba: pajamos, išlaidos, pelnas" kind="dark" onPress={() => router.push('/dashboard')} />

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
      <Notice>Balansas, užsakymai ir atsiliepimai atsiras, kai bus prijungti mokėjimai.</Notice>

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
    </Page>
  );
}
