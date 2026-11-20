import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { Button, Card, Muted, Notice, Page } from '@/components/ui';
import { openExternal } from '@/services/open';
import { type PayoutStatus, useStore } from '@/store';
import { colors } from '@/theme';

/** Seller's payout setup: identity and bank account are entered on Stripe's own pages. */
export default function PayoutsScreen() {
  const router = useRouter();
  const { ready, registered, live, payoutStatus, startPayouts } = useStore();
  const [status, setStatus] = useState<PayoutStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ready || !registered || !live) return;
    let current = true;
    payoutStatus().then((answer) => {
      if (current) setStatus(answer);
    });
    return () => {
      current = false;
    };
  }, [ready, registered, live, payoutStatus]);

  if (!live || (ready && !registered)) {
    return (
      <Page>
        <Muted>{live ? 'Norėdami nustatyti išmokas, prisijunkite.' : 'Bandomuoju režimu mokėjimų nėra.'}</Muted>
        {live ? <Button label="Registruotis arba prisijungti" onPress={() => router.push('/register')} /> : null}
      </Page>
    );
  }

  const open = async () => {
    setBusy(true);
    setError('');
    const answer = await startPayouts();
    if (answer.url) return openExternal(answer.url);
    setBusy(false);
    setError(answer.error ?? 'Nepavyko atidaryti nustatymų.');
  };

  return (
    <Page>
      <Card>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.ink }}>Mokėjimai per Partaza</Text>
        <Muted>
          Pirkėjas sumoka kortele, pinigus laiko mokėjimų bendrovė „Stripe“, o jums jie pervedami, kai pirkėjas patvirtina, kad dalį gavo ir ji tvarkinga (arba savaime, pasibaigus 5 dienų patikrai). Iš „Stripe“ pinigai išmokami į jūsų banko sąskaitą.
        </Muted>
        <Muted>
          Kad galėtumėte gauti pinigus, „Stripe“ vieną kartą paprašo patvirtinti tapatybę ir nurodyti banko sąskaitą (IBAN). Šių duomenų Partaza nemato ir nesaugo.
        </Muted>
      </Card>

      {status === null ? <Muted>Tikrinama…</Muted> : null}
      {status && !status.configured ? <Notice tone="warn">Mokėjimai per Partaza dar neįjungti. Kai bus įjungti, čia galėsite nustatyti išmokas.</Notice> : null}
      {status?.error ? <Notice tone="warn">{status.error}</Notice> : null}
      {status?.configured && !status.error ? (
        status.ready ? (
          <>
            <Notice>Išmokos įjungtos. Pirkėjai jūsų skelbimuose mato mygtuką „Pirkti“.</Notice>
            <Button label={busy ? 'Atidaroma…' : 'Atidaryti išmokų skydelį („Stripe“)'} kind="outline" disabled={busy} onPress={open} />
          </>
        ) : (
          <>
            {status.exists ? <Notice tone="warn">Nustatymas dar nebaigtas arba „Stripe“ tikrina jūsų duomenis. Jei ką tik užpildėte formą, palaukite kelias minutes.</Notice> : null}
            <Button label={busy ? 'Atidaroma…' : status.exists ? 'Tęsti nustatymą' : 'Nustatyti išmokas'} disabled={busy} onPress={open} />
          </>
        )
      ) : null}
      {error ? <Notice tone="warn">{error}</Notice> : null}
    </Page>
  );
}
