import React from 'react';
import { View, useWindowDimensions } from 'react-native';

import { LangSwitch } from '@/components/LangSwitch';
import { Text } from '@/components/Text';
import { colors } from '@/theme';

/** Right side of every header: the screen's name, then the language switch. The logo stays on the left. */
export function HeaderRight({ title }: { title: string }) {
  const { width } = useWindowDimensions();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {title ? (
        <Text numberOfLines={1} accessibilityRole="header" style={{ maxWidth: Math.max(80, Math.min(width, 900) - 250), fontSize: 16, fontWeight: '700', color: colors.ink }}>
          {title}
        </Text>
      ) : null}
      <LangSwitch />
    </View>
  );
}
