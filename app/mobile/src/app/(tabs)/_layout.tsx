import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { useApi } from '../../session';
import { colors } from '../../theme';

// OfflineBanner pings /health every 15s; expo-network gives a fast local
// signal, the ping catches "device online but instance down".
function OfflineBanner() {
  const api = useApi();
  const net = useQuery({
    queryKey: ['connectivity', 'net'],
    queryFn: async () => (await Network.getNetworkStateAsync()).isConnected !== false,
    refetchInterval: 15_000,
  });
  const ping = useQuery({
    queryKey: ['connectivity', 'ping'],
    queryFn: () => api.ping(),
    refetchInterval: 15_000,
    retry: 0,
    networkMode: 'always',
  });
  if (net.data !== false && ping.data !== false && !ping.isError) return null;
  return (
    <View style={styles.banner}>
      <Ionicons name="cloud-offline-outline" size={13} color={colors.warn} />
      <Text style={styles.bannerText}>
        {net.data === false ? 'No connection' : 'Instance unreachable'} — showing last-known data
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const api = useApi();
  const notifs = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.notifications(),
    refetchInterval: 60_000,
  });
  const unread = notifs.data?.unread ?? 0;

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Overview',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: 'Services',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="databases"
        options={{
          title: 'Databases',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="server-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.warn,
  },
  bannerText: { color: colors.textDim, fontSize: 11 },
});
