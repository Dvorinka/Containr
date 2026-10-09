import React, { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../../session';
import { colors } from '../../theme';
import { relTime } from '../../time';
import { ActionButton, Card, Empty, ErrorBox, Loading, SectionTitle } from '../../components';

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
      ListFooterComponent={<PushChannelsCard />}
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

function PushChannelsCard() {
  const api = useApi();
  const qc = useQueryClient();
  const channels = useQuery({
    queryKey: ['notification-channels'],
    queryFn: () => api.notificationChannels(),
  });
  const [kind, setKind] = useState<'ntfy' | 'gotify'>('ntfy');
  const [endpoint, setEndpoint] = useState('');
  const [token, setToken] = useState('');
  const [adding, setAdding] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['notification-channels'] });
  const add = useMutation({
    mutationFn: () =>
      api.addNotificationChannel({
        kind,
        endpoint: endpoint.trim(),
        token: token.trim() || undefined,
      }),
    onSuccess: () => {
      setEndpoint('');
      setToken('');
      setAdding(false);
      invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteNotificationChannel(id),
    onSuccess: invalidate,
  });
  const test = useMutation({
    mutationFn: (id: string) => api.testNotificationChannel(id),
  });

  const list = channels.data ?? [];

  return (
    <View style={{ marginTop: 24 }}>
      <SectionTitle>Push channels</SectionTitle>
      <Card>
        <Text style={styles.hint}>
          Relay alerts to a self-hosted ntfy or Gotify server — your phone gets pushes via the ntfy app, no account required here.
        </Text>
        {list.map((ch) => (
          <View key={ch.id} style={styles.channelRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.channelKind}>{ch.kind.toUpperCase()}</Text>
              <Text style={styles.channelEndpoint} numberOfLines={1}>
                {ch.endpoint}
              </Text>
            </View>
            <Text
              style={styles.channelAction}
              onPress={() => test.mutate(ch.id)}
            >
              {test.isPending ? '…' : 'Test'}
            </Text>
            <Text
              style={[styles.channelAction, { color: colors.err }]}
              onPress={() => remove.mutate(ch.id)}
            >
              Remove
            </Text>
          </View>
        ))}
        {adding ? (
          <View style={{ marginTop: 8 }}>
            <View style={styles.kindRow}>
              {(['ntfy', 'gotify'] as const).map((k) => (
                <Text
                  key={k}
                  style={[styles.kindChip, kind === k && styles.kindChipActive]}
                  onPress={() => setKind(k)}
                >
                  {k}
                </Text>
              ))}
            </View>
            <TextInput
              style={styles.input}
              value={endpoint}
              onChangeText={setEndpoint}
              placeholder={kind === 'ntfy' ? 'https://ntfy.example.com/my-alerts' : 'https://gotify.example.com'}
              placeholderTextColor={colors.textDim}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <TextInput
              style={styles.input}
              value={token}
              onChangeText={setToken}
              placeholder={kind === 'ntfy' ? 'Access token (optional)' : 'App token'}
              placeholderTextColor={colors.textDim}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            {add.error ? <ErrorBox error={add.error} /> : null}
            <ActionButton
              label={add.isPending ? 'Adding…' : 'Add channel'}
              disabled={add.isPending || !endpoint.trim()}
              onPress={() => add.mutate()}
            />
          </View>
        ) : (
          <Text style={styles.channelAction} onPress={() => setAdding(true)}>
            + Add channel
          </Text>
        )}
      </Card>
    </View>
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
  hint: { color: colors.textDim, fontSize: 12, lineHeight: 17, marginBottom: 8 },
  channelRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  channelKind: { color: colors.text, fontSize: 12, fontWeight: '700' },
  channelEndpoint: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  channelAction: { color: colors.accent, fontSize: 12, fontWeight: '600', marginLeft: 12 },
  kindRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  kindChip: { color: colors.textDim, fontSize: 13, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  kindChipActive: { color: colors.accent, borderColor: colors.accent },
  input: { color: colors.text, fontSize: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
});
