import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Field, Heading, Muted, Notice, Page } from '@/components/ui';
import { normalizePhone } from '@/services/phone';
import { ALREADY_REGISTERED, useStore } from '@/store';
import { colors, radius } from '@/theme';
import type { SellerKind } from '@/types';

const OPTIONS: { kind: SellerKind; title: string; text: string }[] = [
  { kind: 'private', title: 'Privatus asmuo', text: 'Parduodu savo ar atliekamas dalis.' },
  { kind: 'business', title: 'Verslas', text: 'Įmonė, ardytojas, servisas ar parduotuvė. Pirkėjams taikoma 14 dienų grąžinimo teisė.' },
];

export default function RegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ notice?: string; mode?: string }>();
  const { live, registerDemo, signUp, signIn, requestPasswordReset } = useStore();
  const [mode, setMode] = useState<'signUp' | 'signIn'>(params.mode === 'signIn' ? 'signIn' : 'signUp');
  const [info, setInfo] = useState(typeof params.notice === 'string' ? params.notice : '');
  const [kind, setKind] = useState<SellerKind>('private');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isSignIn = live && mode === 'signIn';

  const submit = async () => {
    if (busy) return;
    if (!isSignIn && !name.trim()) return setError('Įrašykite vardą arba įmonės pavadinimą.');
    const phoneNumber = normalizePhone(phone);
    if (!isSignIn && !phoneNumber) return setError('Įrašykite telefono numerį, pvz., +37061234567.');
    if (!live) {
      registerDemo(name.trim(), kind, phoneNumber ?? '');
      return router.back();
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Įrašykite el. pašto adresą.');
    if (password.length < 8) return setError('Slaptažodis turi būti bent 8 ženklų.');
    setBusy(true);
    const problem = isSignIn
      ? await signIn(email.trim(), password)
      : await signUp(email.trim(), password, name.trim(), kind, phoneNumber ?? '');
    setBusy(false);
    if (problem) {
      // Already registered: show the sign-in form with the address kept, so one more tap signs in.
      if (problem === ALREADY_REGISTERED) setMode('signIn');
      return setError(problem);
    }
    router.back();
  };

  const clear = () => {
    setError('');
    setInfo('');
  };

  const forgot = async () => {
    if (busy) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Įrašykite el. pašto adresą, kuriuo registravotės.');
    setBusy(true);
    const problem = await requestPasswordReset(email.trim());
    setBusy(false);
    if (problem) return setError(problem);
    setInfo(`Jei adresas ${email.trim()} užregistruotas, išsiuntėme laišką su nuoroda naujam slaptažodžiui. Nuoroda galioja trumpai.`);
  };

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
          <Field label="Telefono numeris" value={phone} onChangeText={(t) => { setPhone(t); clear(); }} keyboardType="phone-pad" autoComplete="tel" placeholder="+37061234567" hint="Būtinas. Kitiems naudotojams nerodomas." />
        </>
      )}
      {live ? (
        <>
          <Field label="El. paštas" value={email} onChangeText={(t) => { setEmail(t); clear(); }} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          <Field label="Slaptažodis" value={password} onChangeText={(t) => { setPassword(t); clear(); }} secureTextEntry autoCapitalize="none" hint={isSignIn ? undefined : 'Bent 8 ženklai.'} />
          {isSignIn ? null : <Muted>El. paštą reikės patvirtinti per 15 minučių: atsiųsime laišką su nuoroda. Nepatvirtinta paskyra ištrinama savaime.</Muted>}
        </>
      ) : null}
      {isSignIn ? null : (
        <View style={{ gap: 2 }}>
          <Muted>Registruodamiesi sutinkate su naudojimosi taisyklėmis ir patvirtinate, kad susipažinote su privatumo politika.</Muted>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Button label="Taisyklės" kind="quiet" onPress={() => router.push('/terms')} />
            <Button label="Privatumo politika" kind="quiet" onPress={() => router.push('/privacy')} />
          </View>
        </View>
      )}
      {error ? <Notice tone="warn">{error}</Notice> : null}
      {info ? <Notice>{info}</Notice> : null}
      {isSignIn ? <Button label="Pamiršau slaptažodį" kind="quiet" onPress={forgot} /> : null}
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
