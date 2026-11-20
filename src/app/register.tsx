import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';

import { Button, Field, Heading, Muted, Notice, Page } from '@/components/ui';
import { useStore } from '@/store';
import { colors, radius } from '@/theme';
import type { SellerKind } from '@/types';

const OPTIONS: { kind: SellerKind; title: string; text: string }[] = [
  { kind: 'private', title: 'Privatus asmuo', text: 'Parduodu savo ar atliekamas dalis.' },
  { kind: 'business', title: 'Verslas', text: 'Įmonė, ardytojas, servisas ar parduotuvė. Pirkėjams taikoma 14 dienų grąžinimo teisė.' },
];

export default function RegisterScreen() {
  const router = useRouter();
  const { live, registerDemo, signUp, signIn } = useStore();
  const [mode, setMode] = useState<'signUp' | 'signIn'>('signUp');
  const [kind, setKind] = useState<SellerKind>('private');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isSignIn = live && mode === 'signIn';

  const submit = async () => {
    if (busy) return;
    if (!isSignIn && !name.trim()) return setError('Įrašykite vardą arba įmonės pavadinimą.');
    if (!live) {
      registerDemo(name.trim(), kind);
      return router.back();
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Įrašykite el. pašto adresą.');
    if (password.length < 8) return setError('Slaptažodis turi būti bent 8 ženklų.');
    setBusy(true);
    const problem = isSignIn
      ? await signIn(email.trim(), password)
      : await signUp(email.trim(), password, name.trim(), kind);
    setBusy(false);
    if (problem) return setError(problem);
    router.back();
  };

  const clear = () => setError('');

  return (
    <Page footer={<Button label={busy ? 'Palaukite…' : isSignIn ? 'Prisijungti' : 'Tęsti'} onPress={submit} disabled={busy} />}>
      <Heading>{isSignIn ? 'Prisijungimas' : 'Kaip prekiausite?'}</Heading>
      {isSignIn ? null : (
        <>
          <Muted>Pirkėjai tai matys kiekviename jūsų skelbime. Vėliau galėsite pakeisti profilyje.</Muted>
          {OPTIONS.map((option) => {
            const selected = option.kind === kind;
            return (
              <Pressable
                key={option.kind}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setKind(option.kind)}
                style={{
                  padding: 14, gap: 4, borderRadius: radius.lg,
                  backgroundColor: selected ? colors.accentSoft : colors.surface,
                  borderWidth: selected ? 2 : 1, borderColor: selected ? colors.ink : colors.border,
                }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>{option.title}</Text>
                <Text style={{ fontSize: 13, lineHeight: 19, color: selected ? colors.ink : colors.muted }}>{option.text}</Text>
              </Pressable>
            );
          })}
          <Field label="Vardas arba įmonės pavadinimas" value={name} onChangeText={(t) => { setName(t); clear(); }} placeholder="Pvz., Tomas V." />
        </>
      )}
      {live ? (
        <>
          <Field label="El. paštas" value={email} onChangeText={(t) => { setEmail(t); clear(); }} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          <Field label="Slaptažodis" value={password} onChangeText={(t) => { setPassword(t); clear(); }} secureTextEntry autoCapitalize="none" hint={isSignIn ? undefined : 'Bent 8 ženklai.'} />
        </>
      ) : null}
      {error ? <Notice tone="warn">{error}</Notice> : null}
      {live ? (
        <Button
          label={isSignIn ? 'Neturiu paskyros – registruotis' : 'Jau turiu paskyrą – prisijungti'}
          kind="quiet"
          onPress={() => { setMode(isSignIn ? 'signUp' : 'signIn'); clear(); }}
        />
      ) : (
        <Muted>Bandomasis režimas: serveris neprijungtas, todėl paskyra saugoma tik šiame įrenginyje, kol programėlė atidaryta.</Muted>
      )}
    </Page>
  );
}
