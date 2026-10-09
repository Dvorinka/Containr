import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../../session';
import { colors } from '../../theme';
import { relTime } from '../../time';
import { ActionButton, Card, Empty, ErrorBox, Loading } from '../../components';

const KIND_COLOR: Record<string, string> = {
  deployment_failed: colors.err,
  deployment: colors.accent,
  alert: colors.warn,
  scale: colors.info,
};

export default function Notifications() {
  const api = useApi();
  const qc = useQueryClient();

  const notifs = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.notifications(),
    refetchInterval: 30_000,
  });

  const markAll = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const markRead = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  if (notifs.isLoading) return <Loading />;
  if (notifs.error) return <ErrorBox error={notifs.error} />;

  const items = notifs.data?.notifications ?? [];
  const unread = notifs.data?.unread ?? 0;

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={notifs.isRefetching}
          onRefresh={() => notifs.refetch()}
          tintColor={colors.accent}
        />
      }
      ListHeaderComponent={
        unread > 0 ? (
          <ActionButton
            label={`Mark all read (${unread})`}
            disabled={markAll.isPending}
            onPress={() => markAll.mutate()}
          />
        ) : null
      }
      ListEmptyComponent={<Empty text="No notifications" />}
      data={items}
      keyExtractor={(n) => n.id}
      renderItem={({ item }) => {
        const isUnread = !item.read_at;
        const dot = KIND_COLOR[item.kind] ?? colors.accent;
        return (
          <Card
            style={isUnread ? { borderColor: colors.accent } : undefined}
          >
            <View style={styles.row}>
              <View style={[styles.dot, { backgroundColor: isUnread ? dot : colors.border }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, !isUnread && { color: colors.textDim }]}>
                  {item.title}
                </Text>
                {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
                <Text style={styles.meta}>
                  {item.kind}
                  {item.created_at ? ` · ${relTime(item.created_at)}` : ''}
                </Text>
              </View>
              {isUnread ? (
                <Text
                  style={styles.markRead}
                  onPress={() => markRead.mutate(item.id)}
                >
                  Mark read
                </Text>
              ) : null}
            </View>
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, marginRight: 10 },
  title: { color: colors.text, fontSize: 15, fontWeight: '600' },
  body: { color: colors.textDim, fontSize: 13, marginTop: 4, lineHeight: 18 },
  meta: { color: colors.textDim, fontSize: 11, marginTop: 6 },
  markRead: { color: colors.accent, fontSize: 12, fontWeight: '600', marginLeft: 8 },
});
