import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/Text';
import { tr } from '@/i18n';
import { colors, radius } from '@/theme';

export interface Filter {
  key: string;
  /** What is being chosen, e.g. "Rikiuoti". */
  label: string;
  /** The current choice. */
  value: string;
  options: { value: string; label: string }[];
  /** True when the choice narrows the results (the pill is then highlighted). */
  active?: boolean;
  onSelect: (value: string) => void;
}

/**
 * A row of drop-down pills ("Sort: Cheapest ▾"). Tapping one opens its choices right under the
 * row; choosing closes it. One list is open at a time, so filters take one line instead of a card each.
 */
export function FilterBar({ filters }: { filters: Filter[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const current = filters.find((f) => f.key === open);
  return (
    <View style={{ gap: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
        {filters.map((f) => {
          const chosen = f.options.find((o) => o.value === f.value)?.label ?? '';
          const isOpen = open === f.key;
          return (
            <Pressable
              key={f.key}
              accessibilityRole="button"
              accessibilityLabel={`${tr(f.label)}: ${tr(chosen)}`}
              accessibilityState={{ expanded: isOpen }}
              onPress={() => setOpen(isOpen ? null : f.key)}
              style={{
                minHeight: 44, paddingHorizontal: 14, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: f.active ? colors.ink : colors.surface, borderWidth: isOpen ? 2 : 1, borderColor: isOpen ? colors.accent : f.active ? colors.ink : colors.border,
              }}>
              <Text style={{ fontSize: 13, color: f.active ? '#D5D9E0' : colors.muted }}>{f.label}</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: f.active ? '#FFFFFF' : colors.ink }}>{chosen}</Text>
              <Text style={{ fontSize: 13, color: f.active ? '#FFFFFF' : colors.muted }}>{isOpen ? '▴' : '▾'}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {current ? (
        <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 340, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface }}>
          {current.options.map((o) => {
            const picked = o.value === current.value;
            return (
              <Pressable
                key={o.value}
                accessibilityRole="button"
                accessibilityState={{ selected: picked }}
                onPress={() => { current.onSelect(o.value); setOpen(null); }}
                style={{ minHeight: 46, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: picked ? colors.accentSoft : 'transparent' }}>
                <Text style={{ flex: 1, fontSize: 15, fontWeight: picked ? '700' : '400', color: colors.ink }}>{o.label}</Text>
                {picked ? <Text style={{ fontSize: 15, fontWeight: '700', color: colors.accent }}>✓</Text> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}
