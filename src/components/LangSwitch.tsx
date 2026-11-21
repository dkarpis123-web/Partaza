import React, { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { LANGUAGES, setLang, useLang } from '@/i18n';
import { colors, radius } from '@/theme';

/** The current language as a small button; tapping it opens the list of all languages, each in its own name. */
export function LangSwitch() {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Kalba · Language: ${current.name}`}
        onPress={() => setOpen(true)}
        style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.accent, borderWidth: 1.5, borderColor: colors.accent, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
          {current.short} ▾
        </Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityLabel="Uždaryti · Close" onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'flex-end', paddingTop: 56, paddingRight: 12 }}>
          <View accessibilityRole="menu" style={{ backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: 6, minWidth: 200, boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }}>
            {LANGUAGES.map((l) => (
              <Pressable
                key={l.code}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: l.code === lang }}
                onPress={() => {
                  setLang(l.code);
                  setOpen(false);
                }}
                style={{ minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: l.code === lang ? colors.accentSoft : 'transparent' }}>
                <Text style={{ width: 28, fontSize: 13, fontWeight: '700', color: colors.muted }}>{l.short}</Text>
                <Text style={{ fontSize: 16, fontWeight: l.code === lang ? '700' : '500', color: colors.ink }}>{l.name}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
