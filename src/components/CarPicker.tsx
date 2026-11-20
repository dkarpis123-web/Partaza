import React, { useState } from 'react';
import { View } from 'react-native';

import { Text, TextInput } from '@/components/Text';
import { Chip, Muted } from '@/components/ui';
import { CAR_MODELS, POPULAR_MAKES } from '@/data/cars';
import { colors, radius } from '@/theme';

const MAKES = Object.keys(CAR_MODELS);
const plain = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

const inputStyle = {
  minHeight: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, fontSize: 15, color: colors.ink, backgroundColor: colors.surface,
} as const;

/**
 * Pick a make, then a model, from the list instead of typing. Typing in the box narrows the
 * choices. Calls onPick for every model chosen; a make with no models in the list is offered alone.
 */
export function CarPicker({ onPick, picked = [] }: { onPick: (make: string, model: string) => void; picked?: string[] }) {
  const [make, setMake] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const wanted = plain(filter);

  if (!make) {
    const makes = wanted ? MAKES.filter((m) => plain(m).includes(wanted)).slice(0, 24) : POPULAR_MAKES;
    return (
      <View style={{ gap: 8 }}>
        <TextInput accessibilityLabel="Ieškoti markės" placeholder="Ieškoti markės, pvz., Volvo" placeholderTextColor={colors.muted} value={filter} onChangeText={setFilter} style={inputStyle} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {makes.map((m) => (
            <Chip key={m} label={m} selected={false} onPress={() => { setMake(m); setFilter(''); }} />
          ))}
        </View>
        {makes.length === 0 ? <Muted>Tokios markės sąraše nėra. Įrašykite ją patys laukelyje aukščiau.</Muted> : wanted ? null : <Muted>Rodomos dažniausios markės. Kitą rasite įrašę kelias raides.</Muted>}
      </View>
    );
  }

  const models = CAR_MODELS[make].filter((m) => !wanted || plain(m).includes(wanted));
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.ink }}>{make}</Text>
        <Chip label="Kita markė" selected={false} onPress={() => { setMake(null); setFilter(''); }} />
      </View>
      {CAR_MODELS[make].length > 12 ? (
        <TextInput accessibilityLabel="Ieškoti modelio" placeholder="Ieškoti modelio" placeholderTextColor={colors.muted} value={filter} onChangeText={setFilter} style={inputStyle} />
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {models.map((m) => (
          <Chip key={m} label={m} selected={picked.includes(`${make} ${m}`)} onPress={() => onPick(make, m)} />
        ))}
        {CAR_MODELS[make].length === 0 ? <Chip label={make} selected={picked.includes(make)} onPress={() => onPick(make, '')} /> : null}
      </View>
      {CAR_MODELS[make].length > 0 && models.length === 0 ? <Muted>Tokio modelio sąraše nėra. Įrašykite jį patys laukelyje aukščiau.</Muted> : null}
    </View>
  );
}
