import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable } from 'react-native';

import { colors } from '@/theme';

/**
 * "Back" in the header of every inner screen. It is always shown: when the screen was
 * opened directly (a shared link, a page reload) there is nothing to go back to, so it
 * goes to the home screen instead of doing nothing.
 */
export function BackButton() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Atgal"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      style={{ alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 36, marginRight: -8 }}>
      <Ionicons name="chevron-back" size={28} color={colors.accent} />
    </Pressable>
  );
}
