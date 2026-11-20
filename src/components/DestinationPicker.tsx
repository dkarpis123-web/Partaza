import React, { useState } from 'react';
import { View } from 'react-native';

import { Text, TextInput } from '@/components/Text';
import { Button, Chip } from '@/components/ui';
import { COUNTRIES, countryLabel, countryName, setDestination, useDestination, useGeo } from '@/services/geo';
import { normalize } from '@/services/match';
import { tr } from '@/i18n';
import { colors, radius } from '@/theme';

/** "Deliver to: country [Change]" – the buyer's own choice of delivery country, remembered on the device. */
export function DestinationPicker() {
  const { country, manual } = useDestination();
  const detected = useGeo().place?.country ?? null;
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const choices = COUNTRIES.filter((c) => normalize(countryName(c)).includes(normalize(filter))).slice(0, filter.trim() ? 12 : 8);
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, color: colors.muted }}>Siuntimas skaičiuojamas į</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>{country ? countryLabel(country) : tr('Šalis nenurodyta')}</Text>
        </View>
        <Button label={open ? 'Gerai' : country ? 'Keisti' : 'Nurodyti šalį'} kind="outline" onPress={() => setOpen((v) => !v)} />
      </View>
      {open ? (
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
            {choices.map((c) => (
              <Chip key={c} label={countryLabel(c)} selected={country === c} onPress={() => { setDestination(c); setOpen(false); setFilter(''); }} />
            ))}
          </View>
          {manual ? <Button label={detected ? 'Naudoti mano vietos šalį' : 'Išvalyti gavėjo šalį'} kind="quiet" onPress={() => { setDestination(null); setOpen(false); }} /> : null}
        </>
      ) : null}
    </View>
  );
}
