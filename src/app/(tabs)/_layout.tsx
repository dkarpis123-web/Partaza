import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View, type ColorValue } from 'react-native';

import { Brand } from '@/components/Brand';
import { HeaderRight } from '@/components/HeaderRight';
import { tr, useLang } from '@/i18n';
import { newMatches } from '@/services/match';
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

const TAB_TITLES: Record<string, string> = { search: 'Paieška', sell: 'Parduoti', messages: 'Žinutės', profile: 'Profilis' };

export default function TabsLayout() {
  useLang();
  const { unreadThreadIds, savedSearches, listings, me } = useStore();
  const fresh = savedSearches.reduce((sum, s) => sum + newMatches(listings, s, me.id).length, 0);
  const unread = unreadThreadIds.length;
  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        headerTintColor: colors.ink,
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { fontWeight: '700' },
        headerLeft: () => (
          <View style={{ paddingLeft: Platform.OS === 'web' ? 14 : 16 }}>
            <Brand />
          </View>
        ),
        headerTitle: () => null,
        headerRight: () => <HeaderRight title={TAB_TITLES[route.name] ?? ''} />,
      })}>
      <Tabs.Screen name="index" options={{ title: tr('Pradžia'), tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="search" options={{ title: tr('Paieška'), tabBarIcon: icon('search-outline'), tabBarBadge: fresh > 0 ? fresh : undefined }} />
      <Tabs.Screen name="sell" options={{ title: tr('Parduoti'), tabBarIcon: icon('add-circle-outline') }} />
      <Tabs.Screen name="messages" options={{ title: tr('Žinutės'), tabBarIcon: icon('chatbubble-outline'), tabBarBadge: unread > 0 ? unread : undefined, tabBarAccessibilityLabel: unread > 0 ? `${tr('Žinutės, neskaitytų pokalbių:')} ${unread}` : tr('Žinutės') }} />
      <Tabs.Screen name="profile" options={{ title: tr('Profilis'), tabBarIcon: icon('person-outline') }} />
    </Tabs>
  );
}
