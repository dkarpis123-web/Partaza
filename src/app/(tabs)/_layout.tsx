import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import type { ColorValue } from 'react-native';

import { colors } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function icon(name: IconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} color={typeof color === 'string' ? color : colors.muted} size={size} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        headerTintColor: colors.ink,
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { fontWeight: '700' },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Pradžia', headerTitle: 'Partaza', tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="search" options={{ title: 'Paieška', tabBarIcon: icon('search-outline') }} />
      <Tabs.Screen name="sell" options={{ title: 'Parduoti', tabBarIcon: icon('add-circle-outline') }} />
      <Tabs.Screen name="messages" options={{ title: 'Žinutės', tabBarIcon: icon('chatbubble-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profilis', tabBarIcon: icon('person-outline') }} />
    </Tabs>
  );
}
