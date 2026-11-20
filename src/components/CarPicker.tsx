import React, { useState } from 'react';
import { View } from 'react-native';

import { Text, TextInput } from '@/components/Text';
import { Chip, Muted } from '@/components/ui';
import { BOAT_MAKES, CAR_GENERATIONS, CAR_MODELS, MOTO_MODELS, POPULAR_MAKES, TRUCK_MODELS } from '@/data/cars';
import { colors, radius } from '@/theme';
import type { VehicleType } from '@/types';

const plain = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

/** Which list goes with which kind of vehicle; karts and bicycles have none and are typed by hand. */
function listFor(type: VehicleType): Record<string, string[]> | null {
  if (type === 'car') return CAR_MODELS;
  if (type === 'motorcycle' || type === 'moped' || type === 'scooter') return MOTO_MODELS;
  if (type === 'truck') return TRUCK_MODELS;
  if (type === 'boat') return BOAT_MAKES;
  return null;
}

const inputStyle = {
  minHeight: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, fontSize: 15, color: colors.ink, backgroundColor: colors.surface,
} as const;

/**
 * Pick a make, then a model, then (for common cars) a generation, instead of typing. Typing in the
 * box narrows the choices. Calls onPick with the make and the model (with its generation, if chosen).
 */
export function CarPicker({ onPick, picked = [], type = 'car' }: { onPick: (make: string, model: string) => void; picked?: string[]; type?: VehicleType }) {
  const [make, setMake] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [listType, setListType] = useState(type);
  if (listType !== type) {
    // Another kind of vehicle was chosen: start again from its makes.
    setListType(type);
    setMake(null);
    setModel(null);
    setFilter('');
  }
  const list = listFor(type);
  const wanted = plain(filter);

  if (!list) return <Muted>Šiam transportui sąrašo nėra. Įrašykite, kam dalis tinka, laukelyje aukščiau.</Muted>;

  if (!make || !list[make]) {
    const all = Object.keys(list);
    const makes = wanted ? all.filter((m) => plain(m).includes(wanted)).slice(0, 24) : type === 'car' ? POPULAR_MAKES : all;
    return (
      <View style={{ gap: 8 }}>
        <TextInput accessibilityLabel="Ieškoti markės" placeholder="Ieškoti markės, pvz., Volvo" placeholderTextColor={colors.muted} value={filter} onChangeText={setFilter} style={inputStyle} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {makes.map((m) => (
            <Chip key={m} label={m} selected={false} onPress={() => { setMake(m); setModel(null); setFilter(''); }} />
          ))}
        </View>
        {makes.length === 0 ? <Muted>Tokios markės sąraše nėra. Įrašykite ją patys laukelyje aukščiau.</Muted> : wanted || type !== 'car' ? null : <Muted>Rodomos dažniausios markės. Kitą rasite įrašę kelias raides.</Muted>}
      </View>
    );
  }

  const generations = model && type === 'car' ? CAR_GENERATIONS[`${make} ${model}`] : undefined;
  if (model && generations) {
    return (
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.ink }}>{`${make} ${model}`}</Text>
          <Chip label="Kitas modelis" selected={false} onPress={() => setModel(null)} />
        </View>
        <Muted>Pasirinkite kartą (galima kelias) arba visas.</Muted>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label="Visos kartos" selected={picked.includes(`${make} ${model}`)} onPress={() => onPick(make, model)} />
          {generations.map((g) => {
            const name = `${model} ${g.split(' (')[0]}`;
            return <Chip key={g} label={g} selected={picked.includes(`${make} ${name}`)} onPress={() => onPick(make, name)} />;
          })}
        </View>
      </View>
    );
  }

  const models = list[make].filter((m) => !wanted || plain(m).includes(wanted));
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.ink }}>{make}</Text>
        <Chip label="Kita markė" selected={false} onPress={() => { setMake(null); setFilter(''); }} />
      </View>
      {list[make].length > 12 ? (
        <TextInput accessibilityLabel="Ieškoti modelio" placeholder="Ieškoti modelio" placeholderTextColor={colors.muted} value={filter} onChangeText={setFilter} style={inputStyle} />
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {models.map((m) => {
          const hasGenerations = type === 'car' && !!CAR_GENERATIONS[`${make} ${m}`];
          const chosen = picked.some((p) => p === `${make} ${m}` || p.startsWith(`${make} ${m} `));
          return <Chip key={m} label={hasGenerations ? `${m} ›` : m} selected={chosen} onPress={() => (hasGenerations ? setModel(m) : onPick(make, m))} />;
        })}
        {list[make].length === 0 ? <Chip label={make} selected={picked.includes(make)} onPress={() => onPick(make, '')} /> : null}
      </View>
      {list[make].length === 0 ? <Muted>Modelį įrašykite patys laukelyje aukščiau.</Muted> : null}
      {list[make].length > 0 && models.length === 0 ? <Muted>Tokio modelio sąraše nėra. Įrašykite jį patys laukelyje aukščiau.</Muted> : null}
    </View>
  );
}
