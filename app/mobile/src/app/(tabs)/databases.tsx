import React from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../../session';
import { colors } from '../../theme';
import { relTime } from '../../time';
import { ActionButton, Card, Empty, ErrorBox, Loading, StatusBadge } from '../../components';

export default function Databases() {
  const api = useApi();
  const qc = useQueryClient();
  const dbs = useQuery({ queryKey: ['databases'], queryFn: () => api.databases() });

  const action = useMutation({
    mutationFn: ({ id, act }: { id: string; act: 'start' | 'stop' | 'restart' }) =>
      api.databaseAction(id, act),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['databases'] }),
    onError: (e) => Alert.alert('Action failed', e instanceof Error ? e.message : String(e)),
  });
  const backup = useMutation({
    mutationFn: (id: string) => api.databaseBackup(id),
    onSuccess: () => Alert.alert('Backup started', 'Snapshot queued for this database.'),
    onError: (e) => Alert.alert('Backup failed', e instanceof Error ? e.message : String(e)),
  });

  if (dbs.isLoading) return <Loading />;

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={{ padding: 16 }}
      data={dbs.data ?? []}
      keyExtractor={(d) => d.id}
      refreshControl={
        <RefreshControl
          refreshing={dbs.isRefetching}
          onRefresh={() => dbs.refetch()}
          tintColor={colors.accent}
        />
      }
      ListEmptyComponent={
        dbs.error ? <ErrorBox error={dbs.error} /> : <Empty text="No databases" />
      }
      renderItem={({ item }) => (
        <Card>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.type}
                {item.version ? ` ${item.version}` : ''} · created {relTime(item.created_at)}
              </Text>
            </View>
            <StatusBadge status={item.status} />
          </View>
          <View style={styles.actions}>
            {item.status === 'running' ? (
              <ActionButton
                label="Backup now"
                kind="primary"
                disabled={backup.isPending}
                onPress={() => backup.mutate(item.id)}
              />
            ) : (
              <ActionButton
                label="Start"
                kind="primary"
                disabled={action.isPending}
                onPress={() => action.mutate({ id: item.id, act: 'start' })}
              />
            )}
            {item.status === 'running' ? (
              <>
                <ActionButton
                  label="Restart"
                  disabled={action.isPending}
                  onPress={() => action.mutate({ id: item.id, act: 'restart' })}
                />
                <ActionButton
                  label="Stop"
                  kind="danger"
                  disabled={action.isPending}
                  onPress={() => action.mutate({ id: item.id, act: 'stop' })}
                />
              </>
            ) : null}
          </View>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  name: { color: colors.text, fontSize: 16, fontWeight: '600' },
  meta: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap' },
});
