import React from 'react';
import { Image, View } from 'react-native';

import { Text } from '@/components/Text';
import { colors } from '@/theme';

/** The seller's own photo or logo; without one, the first letter of the name. */
export function SellerLogo({ uri, name, size = 48 }: { uri?: string | null; name: string; size?: number }) {
  if (uri) {
    return <Image source={{ uri }} accessibilityLabel={name} style={{ width: size, height: size, borderRadius: size / 5, backgroundColor: colors.border }} resizeMode="cover" />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 5, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.45, fontWeight: '800', color: colors.accent }}>{(name.trim()[0] ?? '?').toUpperCase()}</Text>
    </View>
  );
}
