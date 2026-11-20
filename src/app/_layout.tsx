import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';

import { Splash } from '@/components/Splash';
import { StoreProvider } from '@/store';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <StoreProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTintColor: colors.ink,
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: colors.bg },
          headerBackTitle: 'Atgal',
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="listing/[id]" options={{ title: 'Skelbimas' }} />
        <Stack.Screen name="offer/[id]" options={{ title: 'Siūlyti kainą' }} />
        <Stack.Screen name="chat/[id]" options={{ title: 'Pokalbis' }} />
        <Stack.Screen name="sell/review" options={{ title: 'Patikrinkite skelbimą' }} />
        <Stack.Screen name="register" options={{ title: 'Registracija' }} />
        <Stack.Screen name="dashboard" options={{ title: 'Mano prekyba' }} />
      </Stack>
      <Splash />
    </StoreProvider>
  );
}
