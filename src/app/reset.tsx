import { useRouter } from 'expo-router';
import React, { useState } from 'react';

import { Button, Field, Heading, Muted, Notice, Page } from '@/components/ui';
import { useStore } from '@/store';

/** Opened from the "new password" link in an e-mail: the person is already signed in by the link. */
export default function ResetScreen() {
  const router = useRouter();
  const { registered, ready, changePassword } = useStore();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!ready) {
    return (
      <Page>
        <Muted>Kraunama…</Muted>
      </Page>
    );
  }

  if (done) {
    return (
      <Page>
        <Heading>Slaptažodis pakeistas</Heading>
        <Muted>Nuo šiol junkitės naujuoju slaptažodžiu.</Muted>
        <Button label="Į profilį" onPress={() => router.replace('/profile')} />
      </Page>
    );
  }

  if (!registered) {
    return (
      <Page>
        <Heading>Nuoroda nebegalioja</Heading>
        <Muted>Slaptažodžio keitimo nuoroda galioja trumpai ir tik vieną kartą. Paprašykite naujos prisijungimo lange.</Muted>
        <Button label="Į prisijungimą" onPress={() => router.replace({ pathname: '/register', params: { mode: 'signIn' } })} />
      </Page>
    );
  }

  const save = async () => {
    if (busy) return;
    if (password.length < 8) return setError('Slaptažodis turi būti bent 8 ženklų.');
    if (password !== again) return setError('Slaptažodžiai nesutampa.');
    setBusy(true);
    const problem = await changePassword(password);
    setBusy(false);
    if (problem) return setError(problem);
    setDone(true);
  };

  return (
    <Page footer={<Button label={busy ? 'Saugoma…' : 'Išsaugoti slaptažodį'} onPress={save} disabled={busy} />}>
      <Heading>Naujas slaptažodis</Heading>
      <Field label="Naujas slaptažodis" value={password} onChangeText={(t) => { setPassword(t); setError(''); }} secureTextEntry autoCapitalize="none" hint="Bent 8 ženklai." />
      <Field label="Pakartokite slaptažodį" value={again} onChangeText={(t) => { setAgain(t); setError(''); }} secureTextEntry autoCapitalize="none" />
      {error ? <Notice tone="warn">{error}</Notice> : null}
    </Page>
  );
}
