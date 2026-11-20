import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme';

const native = Platform.OS !== 'web';

/**
 * Opening animation: the name rises into place, an accent line draws itself under it,
 * then the whole cover fades away to reveal the app. Takes about 1.6 s and never blocks
 * touches. People who asked their device for reduced motion get a short plain fade.
 */
export function Splash() {
  const [done, setDone] = useState(false);
  const word = useRef(new Animated.Value(0)).current;
  const line = useRef(new Animated.Value(0)).current;
  const tagline = useRef(new Animated.Value(0)).current;
  const cover = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;
    const step = (value: Animated.Value, toValue: number, duration: number) =>
      Animated.timing(value, { toValue, duration, easing: Easing.out(Easing.cubic), useNativeDriver: native });

    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        const animation = reduce
          ? Animated.sequence([step(word, 1, 1), step(line, 1, 1), step(tagline, 1, 1), Animated.delay(500), step(cover, 0, 250)])
          : Animated.sequence([
              step(word, 1, 420),
              Animated.parallel([step(line, 1, 420), step(tagline, 1, 420)]),
              Animated.delay(380),
              step(cover, 0, 360),
            ]);
        animation.start(() => {
          if (!cancelled) setDone(true);
        });
      });
    return () => {
      cancelled = true;
    };
  }, [word, line, tagline, cover]);

  if (done) return null;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', opacity: cover, zIndex: 10 }]}>
      <Animated.View style={{ opacity: word, transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}>
        <Text style={{ fontSize: 44, fontWeight: '800', letterSpacing: -1, color: '#FFFFFF' }}>Partaza</Text>
      </Animated.View>
      <View style={{ width: 150, height: 4, marginTop: 10, alignItems: 'flex-start' }}>
        <Animated.View style={{ width: 150, height: 4, borderRadius: 2, backgroundColor: colors.accent, transform: [{ scaleX: line }] }} />
      </View>
      <Animated.View style={{ opacity: tagline, marginTop: 14 }}>
        <Text style={{ fontSize: 15, color: '#C9CED6' }}>Dalys visam transportui</Text>
      </Animated.View>
    </Animated.View>
  );
}
