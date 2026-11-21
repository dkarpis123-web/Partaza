import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/Text';
import { Button, Card, Muted } from '@/components/ui';
import { tr } from '@/i18n';
import { promoted } from '@/services/match';
import { openExternal } from '@/services/open';
import { useStore } from '@/store';
import { colors, money } from '@/theme';
import type { Listing } from '@/types';

/** Fee for promoting a listing: 5 % of the part's price, at least 0.50 EUR (the smallest card payment). */
export const bumpFee = (price: number) => Math.max(0.5, Math.round(price * 5) / 100);

/**
 * The seller's box for promoting their own listing: what it costs, what it gives, and until when it is promoted.
 * After the payment page sends the seller back, the payment is checked with the server.
 */
export function BumpBox({ listing, justPaid }: { listing: Listing; justPaid: boolean }) {
  const { bumpStart, bumpSync } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!justPaid || checked) return;
    let active = true;
    bumpSync(listing.id).then(() => {
      if (active) setChecked(true);
    });
    return () => {
      active = false;
    };
  }, [justPaid, checked, listing.id, bumpSync]);

  const start = async () => {
    setBusy(true);
    setError('');
    const answer = await bumpStart(listing.id);
    setBusy(false);
    if (answer.error || !answer.url) return setError(answer.error ?? 'Nepavyko atidaryti mokėjimo. Bandykite dar kartą.');
    openExternal(answer.url);
  };

  const bumped = promoted(listing);
  const until = bumped && listing.bumpedUntil ? new Date(listing.bumpedUntil).toLocaleDateString('lt-LT') : '';
  return (
    <Card>
      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>Iškelti skelbimą</Text>
      {bumped ? (
        <View style={{ backgroundColor: '#E8F5E9', borderRadius: 10, padding: 10 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#15803D' }}>{`${tr('Skelbimas iškeltas iki')} ${until}`}</Text>
        </View>
      ) : null}
      <Muted>Iškeltas skelbimas 7 dienas rodomas sąrašų viršuje su žyma „Iškeltas“. Kaina – 5 % dalies kainos.</Muted>
      {justPaid && !checked ? <Muted>Tikriname mokėjimą…</Muted> : null}
      {justPaid && checked && !bumped ? <Muted>Mokėjimas dar nepatvirtintas. Jei sumokėjote, po minutės atidarykite skelbimą iš naujo.</Muted> : null}
      {error ? <Text style={{ fontSize: 14, color: colors.accent }}>{error}</Text> : null}
      <Button
        label={busy ? 'Atidaromas mokėjimas…' : `${tr(bumped ? 'Pratęsti dar 7 dienoms' : 'Iškelti 7 dienoms')} – ${money(bumpFee(listing.price))}`}
        kind="outline"
        disabled={busy}
        onPress={start}
      />
    </Card>
  );
}
