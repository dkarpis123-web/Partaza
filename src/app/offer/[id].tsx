import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Card, Chip, Field, Muted, Notice, Page } from '@/components/ui';
import { useStore } from '@/store';
import { colors, money } from '@/theme';

const DISCOUNTS = [5, 10, 15];

function toText(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace('.', ',');
}

export default function OfferScreen() {
  const { id, thread: threadParam } = useLocalSearchParams<{ id: string; thread?: string }>();
  const router = useRouter();
  const { listingById, registered, live, ready, openThread, sendOffer } = useStore();
  const listing = listingById(id);
  const [amountText, setAmountText] = useState(listing ? toText(Math.round(listing.price * 90) / 100) : '');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!listing) {
    return (
      <Page>
        <Muted>{ready ? 'Šio skelbimo neberandame.' : 'Kraunama…'}</Muted>
      </Page>
    );
  }

  const amount = Number(amountText.replace(',', '.'));

  const send = async () => {
    if (busy) return;
    if (!Number.isFinite(amount) || amount <= 0) return setError('Įrašykite sumą, pvz., 76,50.');
    if (amount >= listing.price) return setError(`Pasiūlymas turi būti mažesnis už skelbimo kainą (${money(listing.price)}).`);
    if (live && !registered) return router.push('/register');
    setBusy(true);
    // A seller answering with another price comes here with the thread already known.
    let threadId = typeof threadParam === 'string' && threadParam ? threadParam : undefined;
    if (!threadId) {
      const opened = await openThread(listing.id);
      if (!opened.id) {
        setBusy(false);
        return setError(opened.error ?? 'Nepavyko pradėti pokalbio.');
      }
      threadId = opened.id;
    }
    const problem = await sendOffer(threadId, Math.round(amount * 100) / 100, note.trim());
    setBusy(false);
    if (problem) return setError(problem);
    router.replace(`/chat/${threadId}`);
  };

  return (
    <Page footer={<Button label={busy ? 'Siunčiama…' : 'Siųsti pasiūlymą'} onPress={send} disabled={busy} />}>
      <Card>
        <Text style={{ fontSize: 14, fontWeight: '500', color: colors.ink }}>{listing.title}</Text>
        <Muted>Skelbimo kaina: {money(listing.price)}</Muted>
      </Card>
      <Field
        label="Jūsų kaina, €"
        value={amountText}
        onChangeText={(t) => {
          setAmountText(t);
          setError('');
        }}
        keyboardType="decimal-pad"
        style={{ fontSize: 28, fontWeight: '700', minHeight: 64 }}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {DISCOUNTS.map((d) => {
          const value = Math.round(listing.price * (100 - d)) / 100;
          return (
            <Chip
              key={d}
              label={`−${d} % · ${money(value)}`}
              selected={Math.abs(amount - value) < 0.005}
              onPress={() => {
                setAmountText(toText(value));
                setError('');
              }}
            />
          );
        })}
      </View>
      <Field label="Žinutė (nebūtina)" value={note} onChangeText={setNote} multiline placeholder="Pvz., galiu atsiimti šiandien" style={{ minHeight: 84, textAlignVertical: 'top' }} />
      {error ? <Notice tone="warn">{error}</Notice> : null}
      <Muted>Kita pusė gali priimti, atmesti arba pasiūlyti savo kainą.</Muted>
    </Page>
  );
}
