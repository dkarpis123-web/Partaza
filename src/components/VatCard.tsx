import React, { useState } from 'react';

import { Text } from '@/components/Text';
import { Button, Card, Field, Muted, Notice } from '@/components/ui';
import { useStore } from '@/store';
import { colors } from '@/theme';

/**
 * The seller's VAT number. It is checked in the EU register (VIES) and must be registered to the
 * same name as the account; only then can prices be marked "including VAT".
 */
export function VatCard() {
  const { vatCode, me, checkVat, removeVat, setName } = useStore();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [registered, setRegistered] = useState('');

  const check = async () => {
    if (busy) return;
    setBusy(true);
    setProblem('');
    const answer = await checkVat(code);
    setBusy(false);
    setRegistered(answer.error ? answer.registeredName ?? '' : '');
    setProblem(answer.error ?? '');
    if (!answer.error) setCode('');
  };

  return (
    <Card>
      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.ink }}>PVM mokėtojo kodas</Text>
      {vatCode ? (
        <>
          <Text style={{ fontSize: 16, color: colors.ink }}>{`${vatCode} · patvirtintas ES registre`}</Text>
          <Muted>Galite skelbime nurodyti kainą su PVM.</Muted>
          <Button label="Pašalinti PVM kodą" kind="outline" onPress={async () => setProblem((await removeVat()) ?? '')} />
        </>
      ) : (
        <>
          <Muted>Reikalingas tik PVM mokėtojams. Be patvirtinto kodo kainos su PVM nurodyti negalima. Kodą tikriname oficialiame ES registre; jis turi būti registruotas tuo pačiu vardu ar pavadinimu kaip jūsų paskyra.</Muted>
          <Field label="PVM kodas" value={code} onChangeText={(t) => { setCode(t); setProblem(''); }} placeholder="Pvz., LT100009776219" autoCapitalize="characters" />
          <Button label={busy ? 'Tikrinama…' : 'Tikrinti ir išsaugoti'} disabled={busy || !code.trim()} onPress={check} />
        </>
      )}
      {problem ? <Notice tone="warn">{problem}</Notice> : null}
      {registered ? (
        <>
          <Muted>{`Registre: ${registered}. Jūsų paskyra: ${me.name}.`}</Muted>
          <Button
            label="Pakeisti paskyros vardą į registro pavadinimą"
            kind="outline"
            onPress={async () => {
              const failed = await setName(registered.replace(/["„“”]/g, '').trim());
              if (failed) return setProblem(failed);
              setRegistered('');
              check();
            }}
          />
        </>
      ) : null}
    </Card>
  );
}
