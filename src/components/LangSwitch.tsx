import React from 'react';
import { Pressable, Text } from 'react-native';

import { setLang, useLang } from '@/i18n';
import { colors } from '@/theme';

/** Switches between Lithuanian and English. Shows the language you would switch to. */
export function LangSwitch() {
  const lang = useLang();
  const next = lang === 'lt' ? 'en' : 'lt';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={next === 'en' ? 'Switch to English' : 'Perjungti į lietuvių kalbą'}
      onPress={() => setLang(next)}
      style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.accent, borderWidth: 1.5, borderColor: colors.accent, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
        {next === 'en' ? 'EN' : 'LT'}
      </Text>
    </Pressable>
  );
}
