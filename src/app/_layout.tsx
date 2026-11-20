import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';

import { AuthLinkHandler } from '@/components/AuthLinkHandler';
import { BackButton } from '@/components/BackButton';
import { Brand } from '@/components/Brand';
import { Splash } from '@/components/Splash';
import { startLang, tr, useLang } from '@/i18n';
import { StoreProvider } from '@/store';
import { colors } from '@/theme';

export default function RootLayout() {
  useLang();
  useEffect(startLang, []);
  return (
    <StoreProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTintColor: colors.ink,
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: colors.bg },
          headerBackVisible: false,
          headerLeft: () => <BackButton />,
          headerRight: () => <Brand side />,
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="listing/[id]" options={{ title: tr('Skelbimas') }} />
        <Stack.Screen name="offer/[id]" options={{ title: tr('Siūlyti kainą') }} />
        <Stack.Screen name="chat/[id]" options={{ title: tr('Pokalbis') }} />
        <Stack.Screen name="sell/review" options={{ title: tr('Patikrinkite skelbimą') }} />
        <Stack.Screen name="register" options={{ title: tr('Registracija') }} />
        <Stack.Screen name="dashboard" options={{ title: tr('Mano prekyba') }} />
        <Stack.Screen name="buy/[id]" options={{ title: tr('Pirkimas') }} />
        <Stack.Screen name="payment/[id]" options={{ title: tr('Užsakymas') }} />
        <Stack.Screen name="payouts" options={{ title: tr('Mokėjimai ir išmokos') }} />
        <Stack.Screen name="orders" options={{ title: tr('Užsakymai') }} />
        <Stack.Screen name="reset" options={{ title: tr('Slaptažodis') }} />
        <Stack.Screen name="terms" options={{ title: tr('Taisyklės') }} />
        <Stack.Screen name="privacy" options={{ title: tr('Privatumas') }} />
      </Stack>
      <AuthLinkHandler />
      <Splash />
    </StoreProvider>
  );
}
