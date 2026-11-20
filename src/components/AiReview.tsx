import React, { useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/Text';
import { Button, Card, Muted, Notice } from '@/components/ui';
import { ListingFix, useStore } from '@/store';
import { colors } from '@/theme';
import { Listing } from '@/types';

const FIELDS: { key: keyof Omit<ListingFix, 'notes'>; label: string }[] = [
  { key: 'title', label: 'Pavadinimas' },
  { key: 'description', label: 'Aprašymas' },
  { key: 'oem', label: 'Dalies numeris' },
  { key: 'fits', label: 'Kam tinka' },
];

/** The seller's own listing, reviewed by AI: shows what would change and saves only what the seller confirms. */
export function AiReview({ listing }: { listing: Listing }) {
  const { aiImprove, applyFix } = useStore();
  const [busy, setBusy] = useState(false);
  const [fix, setFix] = useState<ListingFix | null>(null);
  const [skip, setSkip] = useState<string[]>([]);
  const [problem, setProblem] = useState('');
  const [done, setDone] = useState(false);

  const current = { title: listing.title, description: listing.description ?? '', oem: listing.oem, fits: listing.fits };
  const changed = fix ? FIELDS.filter((f) => fix[f.key].trim() !== current[f.key].trim()) : [];
  const chosen = changed.filter((f) => !skip.includes(f.key));

  const ask = async () => {
    setBusy(true);
    setProblem('');
    setDone(false);
    const answer = await aiImprove(listing.id);
    setBusy(false);
    if (!answer.fix) return setProblem(answer.error ?? 'DI įrankis atsakė klaida. Bandykite dar kartą po minutės.');
    setSkip([]);
    setFix(answer.fix);
  };

  const confirm = async () => {
    if (!fix) return;
    setBusy(true);
    const failure = await applyFix(listing.id, Object.fromEntries(chosen.map((f) => [f.key, fix[f.key]])));
    setBusy(false);
    if (failure) return setProblem(failure);
    setFix(null);
    setDone(true);
  };

  if (!fix) {
    return (
      <View style={{ gap: 8 }}>
        <Button label={busy ? 'DI peržiūri skelbimą…' : 'DI peržiūra: pataisyti skelbimą'} kind="outline" disabled={busy} onPress={ask} />
        {busy ? <Muted>DI skaito tekstą ir žiūri nuotraukas. Tai užtrunka keliolika sekundžių. Niekas nekeičiama be jūsų patvirtinimo.</Muted> : null}
        {done ? <Notice>Pakeitimai išsaugoti.</Notice> : null}
        {problem ? <Notice tone="warn">{problem}</Notice> : null}
      </View>
    );
  }

  return (
    <Card>
      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.ink }}>DI siūlomi pataisymai</Text>
      {changed.length === 0 ? <Muted>DI nerado, ką taisyti – skelbimas tvarkingas.</Muted> : null}
      {changed.map((f) => {
        const off = skip.includes(f.key);
        return (
          <View key={f.key} style={{ gap: 4, opacity: off ? 0.5 : 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.ink }}>{f.label}</Text>
            <Text style={{ fontSize: 13, color: colors.muted, textDecorationLine: 'line-through' }}>{current[f.key] || '–'}</Text>
            <Text style={{ fontSize: 15, color: colors.ink }}>{fix[f.key] || '–'}</Text>
            <Button label={off ? 'Taikyti šį pakeitimą' : 'Šio nekeisti'} kind="quiet" onPress={() => setSkip((s) => (off ? s.filter((k) => k !== f.key) : [...s, f.key]))} />
          </View>
        );
      })}
      {fix.notes.length > 0 ? (
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.ink }}>DI pastabos</Text>
          {fix.notes.map((note) => (
            <Muted key={note}>{`• ${note}`}</Muted>
          ))}
        </View>
      ) : null}
      {problem ? <Notice tone="warn">{problem}</Notice> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button label="Atmesti" kind="outline" disabled={busy} onPress={() => setFix(null)} style={{ flex: 1 }} />
        {chosen.length > 0 ? <Button label={busy ? 'Saugoma…' : 'Patvirtinti pakeitimus'} disabled={busy} onPress={confirm} style={{ flex: 1 }} /> : null}
      </View>
      <Muted>DI gali klysti. Prieš tvirtindami patikrinkite dalies numerį ir tinkamumą – už skelbimo teisingumą atsako pardavėjas.</Muted>
    </Card>
  );
}
