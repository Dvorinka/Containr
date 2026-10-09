import React, { useEffect } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../session';
import { colors } from '../../theme';
import { Empty, ErrorBox, Loading } from '../../components';

export default function ServiceLogs() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const api = useApi();
  const nav = useNavigation();

  useEffect(() => {
    if (name) nav.setOptions({ title: `${name} logs` });
  }, [name, nav]);

  const logs = useQuery({
    queryKey: ['logs', id],
    queryFn: () => api.serviceLogs(id!, 300),
    enabled: !!id,
    refetchInterval: 5000,
  });

  if (logs.isLoading) return <Loading />;
  const entries = logs.data ?? [];

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={{ padding: 12 }}
      data={[...entries].reverse()}
      inverted
      keyExtractor={(_, i) => String(i)}
      refreshControl={
        <RefreshControl
          refreshing={logs.isRefetching}
          onRefresh={() => logs.refetch()}
          tintColor={colors.accent}
        />
      }
      ListEmptyComponent={
        logs.error ? (
          <ErrorBox error={logs.error} />
        ) : (
          <Empty text="No log output yet" />
        )
      }
      renderItem={({ item }) => (
        <Text
          style={[
            styles.line,
            item.stream === 'stderr' && { color: colors.err },
          ]}
        >
          {item.message}
        </Text>
      )}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  line: {
    color: colors.text,
    fontFamily: 'monospace',
    fontSize: 11,
    paddingVertical: 1,
  },
});
