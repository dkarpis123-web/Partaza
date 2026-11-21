import React from 'react';
import { Image, Text, View } from 'react-native';

import type { Lang } from '@/i18n';
import { colors } from '@/theme';

/** Flags drawn by scripts/make-flags.py. Russian has no flag on purpose: its code is shown in a plain box. */
const FLAGS: Partial<Record<Lang, number>> = {
  lt: require('../../assets/flags/lt.png'),
  en: require('../../assets/flags/en.png'),
  lv: require('../../assets/flags/lv.png'),
  et: require('../../assets/flags/et.png'),
  pl: require('../../assets/flags/pl.png'),
  de: require('../../assets/flags/de.png'),
};

/** A small flag for a language, 3:2, with a thin edge so white stripes stay visible. */
export function Flag({ lang, size = 24 }: { lang: Lang; size?: number }) {
  const height = Math.round((size * 2) / 3);
  const box = { width: size, height, borderRadius: 3, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' as const };
  const source = FLAGS[lang];
  if (!source) {
    return (
      <View style={[box, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }]}>
        <Text style={{ fontSize: Math.round(height * 0.55), fontWeight: '700', color: colors.muted }}>{lang.toUpperCase()}</Text>
      </View>
    );
  }
  return <Image source={source} accessibilityIgnoresInvertColors style={box} />;
}
