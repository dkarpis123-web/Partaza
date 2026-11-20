import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable } from 'react-native';

import { colors } from '@/theme';
import { Text } from '@/components/Text';

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
      style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingRight: 12, marginLeft: -4 }}>
      <Ionicons name="chevron-back" size={24} color={colors.accent} />
      <Text style={{ fontSize: 16, fontWeight: '600', color: colors.accent }}>Atgal</Text>
    </Pressable>
  );
}
