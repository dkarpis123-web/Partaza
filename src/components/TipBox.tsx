import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text, TextInput } from '@/components/Text';
import { Chip, Muted } from '@/components/ui';
import { colors, radius } from '@/theme';

const AMOUNTS = [1, 2, 3, 4, 5];
const MAX = 50;

/**
 * An optional contribution to Partaza at payment. Off until the buyer ticks it (an extra payment may not be
 * pre-ticked), then 1–5 € or an own amount up to 50 €. Reports the amount in cents; 0 when off or not valid.
 */
export function TipBox({ onChange }: { onChange: (cents: number) => void }) {
  const [on, setOn] = useState(false);
  const [euros, setEuros] = useState<number | null>(2);
  const [own, setOwn] = useState('');

  const report = (next: { on: boolean; euros: number | null; own: string }) => {
    const typed = Number(next.own.replace(',', '.'));
    const value = next.euros ?? (Number.isFinite(typed) && typed >= 1 && typed <= MAX ? Math.round(typed * 100) / 100 : 0);
    onChange(next.on ? Math.round(value * 100) : 0);
  };

  return (
    <View style={{ gap: 10 }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
        onPress={() => { setOn(!on); report({ on: !on, euros, own }); }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
        <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accent : colors.surface, alignItems: 'center', justifyContent: 'center' }}>
          {on ? <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>✓</Text> : null}
        </View>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.ink }}>Noriu savanoriškai prisidėti prie Partaza tobulinimo</Text>
      </Pressable>
      {on ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {AMOUNTS.map((a) => (
              <Chip key={a} label={`${a} €`} selected={euros === a} onPress={() => { setEuros(a); report({ on, euros: a, own }); }} />
            ))}
            <Chip label="Kita suma" selected={euros === null} onPress={() => { setEuros(null); report({ on, euros: null, own }); }} />
          </View>
          {euros === null ? (
            <TextInput
              accessibilityLabel="Kita suma, €"
              placeholder="Suma, € (1–50)"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              value={own}
              onChangeText={(t) => { const clean = t.replace(/[^0-9.,]/g, '').slice(0, 5); setOwn(clean); report({ on, euros: null, own: clean }); }}
              style={{ minHeight: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, fontSize: 15, color: colors.ink }}
            />
          ) : null}
          <Muted>Ši suma tenka Partaza, ne pardavėjui. Ją panaudosime programėlei tobulinti. Grąžinant pirkimą, grąžinama ir ši suma.</Muted>
        </>
      ) : null}
    </View>
  );
}
