import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Heading, Muted, Notice, Page, Row } from '@/components/ui';
import { sellerStats } from '@/services/stats';
import { useStore } from '@/store';
import { colors, money } from '@/theme';
import { Text } from '@/components/Text';

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: 150, padding: 14, gap: 4, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
      <Text style={{ fontSize: 13, color: colors.muted }}>{label}</Text>
      <Text style={{ fontSize: 24, fontWeight: '700', color: tone === 'ok' ? colors.ok : tone === 'warn' ? colors.warn : colors.ink }}>{value}</Text>
    </View>
  );
}

function signed(value: number): string {
  return value < 0 ? `−${money(Math.abs(value))}` : money(value);
}

export default function DashboardScreen() {
  const router = useRouter();
  const { listings, donors, me, registered } = useStore();
  const stats = sellerStats(listings, donors, me.id);
  const [now] = useState(() => Date.now());

  if (stats.activeCount + stats.soldCount === 0 && donors.length === 0) {
    return (
      <Page>
        <Heading>Mano prekyba</Heading>
        <Muted>{registered ? 'Kai įdėsite pirmą skelbimą, čia matysite pajamas, išlaidas ir pelną.' : 'Įdėkite pirmą skelbimą, ir čia matysite pajamas, išlaidas ir pelną.'}</Muted>
        <Button label="Parduoti dalį" onPress={() => router.push('/sell')} />
      </Page>
    );
  }

  const days = stats.firstListingAt ? Math.max(1, Math.round((now - stats.firstListingAt) / 86400000)) : 0;

  return (
    <Page>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Tile label="Pajamos" value={money(stats.income)} />
        <Tile label="Išlaidos" value={money(stats.expenses)} />
        <Tile label="Pelnas" value={signed(stats.profit)} tone={stats.profit < 0 ? 'warn' : 'ok'} />
        <Tile label="Dar neparduota" value={money(stats.stockValue)} />
      </View>
      <Card style={{ gap: 0 }}>
        <Row label="Parduota dalių" value={String(stats.soldCount)} />
        <Row label="Aktyvių skelbimų" value={String(stats.activeCount)} />
        <Row label="Prekiaujate" value={days === 1 ? '1 dieną' : `${days} d.`} />
      </Card>
      {stats.soldWithoutCost > 0 ? (
        <Muted>{stats.soldWithoutCost === 1 ? '1 parduotai daliai' : `${stats.soldWithoutCost} parduotoms dalims`} pirkimo kaina neįrašyta, todėl jų išlaidos skaičiuojamos kaip 0 €.</Muted>
      ) : null}

      {stats.donors.length > 0 ? <Heading>Ardomi automobiliai</Heading> : null}
      {stats.donors.map((d) => (
        <Card key={d.donor.id} style={{ gap: 0 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink, marginBottom: 6 }}>{d.donor.name}</Text>
          <Row label="Investuota" value={money(d.donor.cost)} />
          <Row label="Atgauta iš pardavimų" value={money(d.recovered)} />
          <Row label={d.toRecover > 0 ? 'Liko atgauti' : 'Pelnas'} value={d.toRecover > 0 ? money(d.toRecover) : money(d.profit)} />
          <Row label="Grąža" value={d.roi === null ? '–' : `${d.roi < 0 ? '−' : ''}${Math.abs(d.roi)} %`} />
          <Row label="Parduota / liko dalių" value={`${d.soldCount} / ${d.activeCount}`} />
          <Row label="Likusių dalių kainų suma" value={money(d.stockValue)} />
        </Card>
      ))}

      <Notice>
        Automobilio pirkimo kaina į išlaidas įskaičiuojama iš karto, pavienės dalies – kai ji parduodama. Platformos mokesčiai, siuntimas ir mokesčiai valstybei neįskaičiuoti. Per Partaza apmokėti pardavimai įrašomi savaime, kitus pažymite patys.
      </Notice>
    </Page>
  );
}
