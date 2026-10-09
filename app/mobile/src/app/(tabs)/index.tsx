import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useApi } from '../../session';
import { colors } from '../../theme';
import { relTime } from '../../time';
import { Card, Empty, ErrorBox, Row, SectionTitle, StatusBadge, StatusDot } from '../../components';

export default function Overview() {
  const api = useApi();
  const router = useRouter();

  const projects = useQuery({ queryKey: ['projects'], queryFn: () => api.projects() });
  const deployments = useQuery({
    queryKey: ['deployments'],
    queryFn: () => api.recentDeployments(),
  });
  const servicesQueries = useQueries({
    queries: (projects.data ?? []).map((p) => ({
      queryKey: ['services', p.id],
      queryFn: () => api.projectServices(p.id),
    })),
  });

  const allServices = servicesQueries.flatMap((q) => q.data ?? []);
  const counts: Record<string, number> = {};
  for (const s of allServices) counts[s.status] = (counts[s.status] ?? 0) + 1;

  const refetch = () => {
    projects.refetch();
    deployments.refetch();
    servicesQueries.forEach((q) => q.refetch());
  };
  const refreshing = projects.isRefetching || deployments.isRefetching;

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.accent} />
      }
      ListHeaderComponent={
        <>
          {projects.error ? <ErrorBox error={projects.error} /> : null}
          <View style={styles.statRow}>
            <Stat label="Running" value={counts.running ?? 0} color={colors.ok} />
            <Stat label="Sleeping" value={counts.sleeping ?? 0} color={colors.info} />
            <Stat label="Failed" value={counts.failed ?? 0} color={colors.err} />
            <Stat label="Stopped" value={counts.stopped ?? 0} color={colors.textDim} />
          </View>

          <SectionTitle>Projects</SectionTitle>
          {projects.data?.length === 0 ? <Empty text="No projects yet" /> : null}
        </>
      }
      data={projects.data ?? []}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => {
        const idx = (projects.data ?? []).findIndex((p) => p.id === item.id);
        const svcs = servicesQueries[idx]?.data ?? [];
        return (
          <Card>
            <Row
              title={item.name}
              subtitle={`${svcs.length} service${svcs.length === 1 ? '' : 's'}`}
              onPress={() => router.push(`/project/${item.id}?name=${encodeURIComponent(item.name)}`)}
              right={
                <View style={styles.dots}>
                  {svcs.slice(0, 6).map((s) => (
                    <StatusDot key={s.id} status={s.status} />
                  ))}
                </View>
              }
            />
          </Card>
        );
      }}
      ListFooterComponent={
        <>
          <SectionTitle>Recent deployments</SectionTitle>
          {deployments.data?.length === 0 ? <Empty text="No deployments" /> : null}
          {(deployments.data ?? []).slice(0, 10).map((d) => (
            <Row
              key={d.id}
              title={`${d.service_name ?? d.service_id}`}
              subtitle={`${d.project_name ?? ''} · ${relTime(d.created_at)}`}
              right={<StatusBadge status={d.status} />}
              onPress={() => router.push(`/service/${d.service_id}`)}
            />
          ))}
        </>
      }
    />
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.stat, { borderColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  statRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  dots: { flexDirection: 'row', gap: 4 },
});
