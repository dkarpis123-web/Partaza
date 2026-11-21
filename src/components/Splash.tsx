import React, { useEffect, useLayoutEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text as PlainText, View } from 'react-native';

import { colors } from '@/theme';
import { Text } from '@/components/Text';

const web = Platform.OS === 'web';
/** How long the finished picture stays before it fades, so the name and both taglines can be read. */
const HOLD = 1900;
/** On the web the same picture has usually been on screen for a while already, while the code loaded. */
const HOLD_WEB = 1300;

/**
 * Opening animation: the name rises into place, an accent line draws itself under it,
 * then the cover fades away to reveal the app. It never blocks touches.
 *
 * On the web the same picture is already on screen before any code has loaded (see
 * public/index.html, #boot), so the wait is never a blank screen; here we only take over
 * from it and fade out. In the phone apps this component plays the whole animation.
 * People who asked their device for reduced motion get a short plain fade.
 */
export function Splash() {
  const [done, setDone] = useState(false);
  const [word] = useState(() => new Animated.Value(web ? 1 : 0));
  const [line] = useState(() => new Animated.Value(web ? 1 : 0));
  const [tagline] = useState(() => new Animated.Value(web ? 1 : 0));
  const [cover] = useState(() => new Animated.Value(1));

  // Take over from the static picture in the page the moment this cover is on screen.
  useLayoutEffect(() => {
    if (web) document.getElementById('boot')?.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const step = (value: Animated.Value, toValue: number, duration: number) =>
      Animated.timing(value, { toValue, duration, easing: Easing.out(Easing.cubic), useNativeDriver: !web });

    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        const animation = web
          ? Animated.sequence([Animated.delay(reduce ? 600 : HOLD_WEB), step(cover, 0, reduce ? 150 : 400)])
          : reduce
            ? Animated.sequence([step(word, 1, 1), step(line, 1, 1), step(tagline, 1, 1), Animated.delay(HOLD), step(cover, 0, 250)])
            : Animated.sequence([
                step(word, 1, 420),
                Animated.parallel([step(line, 1, 420), step(tagline, 1, 420)]),
                Animated.delay(HOLD),
                step(cover, 0, 450),
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
        <Text style={{ fontSize: 44, lineHeight: 53, fontWeight: '800', letterSpacing: -1, color: '#FFFFFF' }}>Partaza</Text>
      </Animated.View>
      <View style={{ width: 150, height: 4, marginTop: 10, alignItems: 'flex-start' }}>
        <Animated.View style={{ width: 150, height: 4, borderRadius: 2, backgroundColor: colors.accent, transform: [{ scaleX: line }] }} />
      </View>
      <Animated.View style={{ opacity: tagline, marginTop: 14, alignItems: 'center' }}>
        {/* Both languages, whatever the app language is: plain Text, so nothing is translated. */}
        <PlainText style={{ fontSize: 15, color: '#C9CED6', textAlign: 'center' }}>Dalys visam transportui</PlainText>
        <PlainText style={{ fontSize: 15, color: '#C9CED6', textAlign: 'center', marginTop: 4 }}>Parts for every vehicle</PlainText>
      </Animated.View>
    </Animated.View>
  );
}
