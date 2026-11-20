import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, Image, Pressable, Text, View } from 'react-native';

import { colors } from '@/theme';

const GLOW = '#F26A1B';

/**
 * The Partaza logo and name in every header. The logo glows like an indicator light.
 * Pressing it always returns to the home screen.
 */
export function Brand({ side = false }: { side?: boolean }) {
  const router = useRouter();
  const [pulse] = useState(() => new Animated.Value(0));
  const size = side ? 26 : 30;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Partaza – į pradžią"
      onPress={() => router.navigate('/')}
      style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: side ? 14 : 0 }}>
      <View style={{ width: size, height: size }}>
        <Animated.View
          style={{
            position: 'absolute', left: 1, top: 1, right: 1, bottom: 1, borderRadius: size / 4, backgroundColor: GLOW,
            boxShadow: `0 0 ${size / 2.2}px ${size / 7}px ${GLOW}`,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.9] }),
          }}
        />
        <Image source={require('../../assets/logo-mark.png')} style={{ width: size, height: size }} resizeMode="contain" accessible={false} />
      </View>
      <Text style={{ fontSize: side ? 16 : 19, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 }}>Partaza</Text>
    </Pressable>
  );
}
