import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import type { ColorValue } from 'react-native';

import { Brand } from '@/components/Brand';
import { useStore } from '@/store';
import { colors } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function icon(name: IconName) {
  const TabIcon = ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} color={typeof color === 'string' ? color : colors.muted} size={size} />
  );
  TabIcon.displayName = `TabIcon(${name})`;
  return TabIcon;
}

export default function TabsLayout() {
  const { unreadThreadIds } = useStore();
  const unread = unreadThreadIds.length;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        headerTintColor: colors.ink,
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { fontWeight: '700' },
        headerRight: () => <Brand side />,
      }}>
      <Tabs.Screen name="index" options={{ title: 'Pradžia', headerTitle: () => <Brand />, headerRight: () => null, tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="search" options={{ title: 'Paieška', tabBarIcon: icon('search-outline') }} />
      <Tabs.Screen name="sell" options={{ title: 'Parduoti', tabBarIcon: icon('add-circle-outline') }} />
      <Tabs.Screen name="messages" options={{ title: 'Žinutės', tabBarIcon: icon('chatbubble-outline'), tabBarBadge: unread > 0 ? unread : undefined, tabBarAccessibilityLabel: unread > 0 ? `Žinutės, neskaitytų pokalbių: ${unread}` : 'Žinutės' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profilis', tabBarIcon: icon('person-outline') }} />
    </Tabs>
  );
}
