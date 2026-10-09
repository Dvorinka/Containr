import React, { useEffect } from 'react';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../session';
import { colors } from '../../theme';
import { Empty, ErrorBox, Loading, Row, StatusBadge } from '../../components';

export default function ProjectDetail() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const api = useApi();
  const router = useRouter();
  const nav = useNavigation();

  useEffect(() => {
    if (name) nav.setOptions({ title: name });
  }, [name, nav]);

  const services = useQuery({
    queryKey: ['services', id],
    queryFn: () => api.projectServices(id!),
    enabled: !!id,
  });

  if (services.isLoading) return <Loading />;

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={{ padding: 16 }}
      data={services.data ?? []}
      keyExtractor={(s) => s.id}
      refreshControl={
        <RefreshControl
          refreshing={services.isRefetching}
          onRefresh={() => services.refetch()}
          tintColor={colors.accent}
        />
      }
      ListEmptyComponent={
        services.error ? <ErrorBox error={services.error} /> : <Empty text="No services" />
      }
      renderItem={({ item }) => (
        <Row
          title={item.name}
          subtitle={`${item.type} · ${item.environment ?? 'production'}${
            item.domain ? ` · ${item.domain}` : ''
          }`}
          right={<StatusBadge status={item.status} />}
          onPress={() => router.push(`/service/${item.id}`)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.bg } });
