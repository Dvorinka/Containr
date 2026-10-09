import React from 'react';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useApi } from '../../session';
import { colors } from '../../theme';
import { Empty, ErrorBox, Loading, Row, StatusBadge } from '../../components';

export default function Services() {
  const api = useApi();
  const router = useRouter();
  const projects = useQuery({ queryKey: ['projects'], queryFn: () => api.projects() });
  const servicesQueries = useQueries({
    queries: (projects.data ?? []).map((p) => ({
      queryKey: ['services', p.id],
      queryFn: () => api.projectServices(p.id),
    })),
  });

  const rows = servicesQueries.flatMap((q, i) =>
    (q.data ?? []).map((s) => ({ ...s, _project: projects.data?.[i]?.name ?? '' })),
  );

  if (projects.isLoading) return <Loading />;

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={{ padding: 16 }}
      data={rows}
      keyExtractor={(s) => s.id}
      refreshControl={
        <RefreshControl
          refreshing={servicesQueries.some((q) => q.isRefetching)}
          onRefresh={() => servicesQueries.forEach((q) => q.refetch())}
          tintColor={colors.accent}
        />
      }
      ListEmptyComponent={
        projects.error ? <ErrorBox error={projects.error} /> : <Empty text="No services" />
      }
      renderItem={({ item }) => (
        <Row
          title={item.name}
          subtitle={`${item._project} · ${item.type}${item.domain ? ` · ${item.domain}` : ''}`}
          right={<StatusBadge status={item.status} />}
          onPress={() => router.push(`/service/${item.id}`)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.bg } });
