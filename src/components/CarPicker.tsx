import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Text, TextInput } from '@/components/Text';
import { Button, Muted } from '@/components/ui';
import { BOAT_MAKES, CAR_GENERATIONS, CAR_MODELS, MOTO_MODELS, POPULAR_MAKES, TRUCK_MODELS } from '@/data/cars';
import { tr } from '@/i18n';
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

const ALL_GENERATIONS = 'Visos kartos';

/** One drop-down: a row showing the current choice; tapped, it opens a list (with a search box when the list is long). */
export function Dropdown({ label, value, options, open, onToggle, onSelect, disabled }: {
  label: string; value: string | null; options: string[]; open: boolean; onToggle: () => void; onSelect: (option: string) => void; disabled?: boolean;
}) {
  const [filter, setFilter] = useState('');
  const wanted = plain(filter);
  const shown = wanted ? options.filter((o) => plain(o).includes(wanted)) : options;
  return (
    <View style={{ gap: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${tr(label)}: ${value ?? tr('pasirinkite')}`}
        accessibilityState={{ expanded: open, disabled: !!disabled }}
        disabled={disabled}
        onPress={() => { setFilter(''); onToggle(); }}
        style={{
          minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: radius.md,
          borderColor: open ? colors.accent : colors.border, backgroundColor: colors.surface, opacity: disabled ? 0.5 : 1,
        }}>
        <Text style={{ fontSize: 13, color: colors.muted }}>{label}</Text>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: value ? '700' : '400', color: value ? colors.ink : colors.muted }}>{value ?? 'pasirinkite'}</Text>
        <Text style={{ fontSize: 15, color: colors.muted }}>{open ? '▴' : '▾'}</Text>
      </Pressable>
      {open ? (
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, overflow: 'hidden' }}>
          {options.length > 10 ? (
            <TextInput
              accessibilityLabel={`${tr('Ieškoti')}: ${tr(label)}`}
              placeholder="Ieškoti sąraše"
              placeholderTextColor={colors.muted}
              value={filter}
              onChangeText={setFilter}
              style={{ minHeight: 44, paddingHorizontal: 12, fontSize: 15, color: colors.ink, borderBottomWidth: 1, borderBottomColor: colors.border }}
            />
          ) : null}
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 264 }}>
            {shown.map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                onPress={() => { setFilter(''); onSelect(option); }}
                style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: option === value ? colors.accentSoft : 'transparent' }}>
                <Text style={{ fontSize: 15, fontWeight: option === value ? '700' : '400', color: colors.ink }}>{option}</Text>
              </Pressable>
            ))}
            {shown.length === 0 ? <View style={{ padding: 12 }}><Muted>Sąraše tokio nėra. Įrašykite patys laukelyje aukščiau.</Muted></View> : null}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Make, model and (for common cars) generation chosen from drop-down lists instead of typing.
 * "Add" calls onPick with the make and the model (with its generation, if one was chosen).
 */
export function CarPicker({ onPick, picked = [], type = 'car', addLabel = 'Pridėti', withYears = false }: {
  onPick: (make: string, model: string) => void; picked?: string[]; type?: VehicleType; addLabel?: string;
  /** Keep the generation's production years in the model name (for a listing's fitment). */
  withYears?: boolean;
}) {
  const [make, setMake] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [generation, setGeneration] = useState<string | null>(null);
  const [open, setOpen] = useState<'make' | 'model' | 'generation' | null>('make');
  const [listType, setListType] = useState(type);
  if (listType !== type) {
    // Another kind of vehicle was chosen: start again from its makes.
    setListType(type);
    setMake(null);
    setModel(null);
    setGeneration(null);
    setOpen('make');
  }
  const list = listFor(type);
  if (!list) return <Muted>Šiam transportui sąrašo nėra. Įrašykite, kam dalis tinka, laukelyje aukščiau.</Muted>;

  const all = Object.keys(list);
  const makes = type === 'car' ? [...POPULAR_MAKES.filter((m) => all.includes(m)), ...all.filter((m) => !POPULAR_MAKES.includes(m))] : all;
  const models = make ? list[make] ?? [] : [];
  const generations = make && model && type === 'car' ? CAR_GENERATIONS[`${make} ${model}`] : undefined;
  // "W166 (2011–2015)" → "W166", and with years (for a listing's fitment) "W166 2011–2015".
  const generationName = generation && generation !== ALL_GENERATIONS ? (withYears ? generation.replace(/[()]/g, '') : generation.split(' (')[0]) : '';
  const modelName = model ? (generationName ? `${model} ${generationName}` : model) : '';
  const ready = !!make && (models.length === 0 || !!model);
  const item = `${make ?? ''} ${modelName}`.trim();
  const already = picked.some((p) => p === item || p.startsWith(`${item} `));

  return (
    <View style={{ gap: 8 }}>
      <Dropdown
        label="Markė"
        value={make}
        options={makes}
        open={open === 'make'}
        onToggle={() => setOpen(open === 'make' ? null : 'make')}
        onSelect={(m) => { setMake(m); setModel(null); setGeneration(null); setOpen((list[m] ?? []).length > 0 ? 'model' : null); }}
      />
      {make && models.length > 0 ? (
        <Dropdown
          label="Modelis"
          value={model}
          options={models}
          open={open === 'model'}
          onToggle={() => setOpen(open === 'model' ? null : 'model')}
          onSelect={(m) => { setModel(m); setGeneration(null); setOpen(type === 'car' && CAR_GENERATIONS[`${make} ${m}`] ? 'generation' : null); }}
        />
      ) : null}
      {generations ? (
        <Dropdown
          label="Karta"
          value={generation}
          options={[ALL_GENERATIONS, ...generations]}
          open={open === 'generation'}
          onToggle={() => setOpen(open === 'generation' ? null : 'generation')}
          onSelect={(g) => { setGeneration(g); setOpen(null); }}
        />
      ) : null}
      {make && models.length === 0 ? <Muted>Modelį įrašykite patys laukelyje aukščiau.</Muted> : null}
      {ready ? (
        <Button
          label={`${tr(already ? 'Pašalinti' : addLabel)}: ${item}`}
          kind={already ? 'outline' : 'dark'}
          onPress={() => {
            onPick(make ?? '', modelName);
            // Ready for the next model of the same make.
            setModel(null);
            setGeneration(null);
            setOpen(models.length > 0 ? 'model' : null);
          }}
        />
      ) : (
        <Muted>Pasirinkite markę ir modelį – tada galėsite pridėti. Galima pridėti kelis modelius.</Muted>
      )}
    </View>
  );
}
