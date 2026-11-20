import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Card, Muted, Notice } from '@/components/ui';
import { useStore } from '@/store';
import { colors } from '@/theme';

/** List of people the signed-in person has blocked, each with an "unblock" button. Hidden when empty. */
export function BlockedUsers() {
  const { blocked, unblockUser, userById } = useStore();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  if (blocked.length === 0) return null;

  return (
    <Card>
      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.ink }}>Užblokuoti naudotojai ({blocked.length})</Text>
      <Muted>Jų skelbimų ir pokalbių nematote, o jie negali jums rašyti. Atblokavus pokalbiai vėl atsiras.</Muted>
      {blocked.map((id) => (
        <View key={id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Text style={{ fontSize: 15, color: colors.ink, flex: 1 }}>{userById(id).name}</Text>
          <Button
            label={busy === id ? 'Palaukite…' : 'Atblokuoti'}
            kind="outline"
            disabled={busy === id}
            onPress={async () => {
              setBusy(id);
              const problem = await unblockUser(id);
              setBusy('');
              setError(problem ?? '');
            }}
          />
        </View>
      ))}
      {error ? <Notice tone="warn">{error}</Notice> : null}
    </Card>
  );
}
