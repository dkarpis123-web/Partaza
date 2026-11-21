import React from 'react';
import { View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Text';

/** While true, every screen shows a strip saying the platform is still being built. Set to false at launch. */
export const DEVELOPMENT_MODE = true;

/**
 * The development-mode strip at the very top of every screen, above the header.
 * The screens below get the top inset already used by the strip taken away, so the header does not leave a second gap.
 */
export function DevBanner({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  if (!DEVELOPMENT_MODE) return <>{children}</>;
  return (
    <View style={{ flex: 1 }}>
      <View
        accessibilityRole="alert"
        style={{ paddingTop: insets.top + 6, paddingBottom: 6, paddingHorizontal: 12, backgroundColor: '#F59E0B', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#7C2D12' }} />
        <Text style={{ flexShrink: 1, fontSize: 13, lineHeight: 17, fontWeight: '700', color: '#1F1300', textAlign: 'center' }}>
          Kūrimo režimas: platforma dar kuriama, mokėjimai tik bandomieji.
        </Text>
      </View>
      <SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
        <View style={{ flex: 1 }}>{children}</View>
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}
