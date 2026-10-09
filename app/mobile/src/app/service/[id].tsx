import React from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../../session';
import { colors } from '../../theme';
import { relTime } from '../../time';
import {
  ActionButton,
  Card,
  Empty,
  ErrorBox,
  Loading,
  SectionTitle,
  StatusBadge,
} from '../../components';

export default function ServiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const router = useRouter();
  const qc = useQueryClient();

  const service = useQuery({
    queryKey: ['service', id],
    queryFn: () => api.service(id!),
    enabled: !!id,
    refetchInterval: 10_000,
  });
  const envCheck = useQuery({
    queryKey: ['env-check', id],
    queryFn: () => api.envCheck(id!),
    enabled: !!id,
    retry: false,
  });
  const deployments = useQuery({
    queryKey: ['service-deployments', id],
    queryFn: () => api.serviceDeployments(id!),
    enabled: !!id,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['service', id] });
    qc.invalidateQueries({ queryKey: ['services'] });
    qc.invalidateQueries({ queryKey: ['service-deployments', id] });
  };
  const onErr = (e: unknown) =>
    Alert.alert('Action failed', e instanceof Error ? e.message : String(e));

  const action = useMutation({
    mutationFn: (act: 'start' | 'stop' | 'restart' | 'redeploy' | 'sleep' | 'wake') =>
      api.serviceAction(id!, act),
    onSuccess: invalidate,
    onError: onErr,
  });
  const rollback = useMutation({
    mutationFn: (depId: string) => api.deploymentAction(depId, 'rollback'),
    onSuccess: invalidate,
    onError: onErr,
  });

  const s = service.data;
  if (service.isLoading) return <Loading />;
  if (!s) return <ErrorBox error={service.error ?? new Error('Not found')} />;

  const busy = action.isPending;
  const canStart = s.status === 'stopped' || s.status === 'failed';
  const canStop = s.status === 'running';
  const canWake = s.status === 'sleeping';
  const lastDeploy = deployments.data?.[0];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={service.isRefetching}
          onRefresh={() => service.refetch()}
          tintColor={colors.accent}
        />
      }
    >
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{s.name}</Text>
          <Text style={styles.meta}>
            {s.type} · {s.environment ?? 'production'}
            {s.image ? `\n${s.image}` : ''}
          </Text>
        </View>
        <StatusBadge status={s.status} />
      </View>

      {envCheck.data && !envCheck.data.ok ? (
        <Card style={{ borderColor: colors.warn }}>
          <Text style={styles.warnTitle}>Environment issues</Text>
          {envCheck.data.unresolved.map((v) => (
            <Text key={v} style={styles.warnItem}>
              Unresolved reference: {v}
            </Text>
          ))}
          {envCheck.data.empty.map((v) => (
            <Text key={v} style={styles.warnItem}>
              Empty value: {v}
            </Text>
          ))}
          {envCheck.data.unreadable.map((v) => (
            <Text key={v} style={styles.warnItem}>
              Unreadable secret (rotate): {v}
            </Text>
          ))}
        </Card>
      ) : null}

      <SectionTitle>Actions</SectionTitle>
      <View style={styles.actions}>
        {canStart ? (
          <ActionButton label="Start" kind="primary" disabled={busy} onPress={() => action.mutate('start')} />
        ) : null}
        {canStop ? (
          <ActionButton label="Stop" kind="danger" disabled={busy} onPress={() => action.mutate('stop')} />
        ) : null}
        {canWake ? (
          <ActionButton label="Wake" kind="primary" disabled={busy} onPress={() => action.mutate('wake')} />
        ) : null}
        {s.status === 'running' ? (
          <>
            <ActionButton label="Restart" disabled={busy} onPress={() => action.mutate('restart')} />
            <ActionButton label="Redeploy" disabled={busy} onPress={() => action.mutate('redeploy')} />
            {s.sleep_enabled ? (
              <ActionButton label="Sleep" disabled={busy} onPress={() => action.mutate('sleep')} />
            ) : null}
          </>
        ) : null}
      </View>

      <View style={styles.actions}>
        <ActionButton
          label="View logs"
          onPress={() => router.push(`/service/logs?id=${s.id}&name=${encodeURIComponent(s.name)}`)}
        />
      </View>

      {s.sleep_enabled ? (
        <Text style={styles.hint}>
          Sleep enabled — scales to zero after {s.sleep_idle_minutes}m idle, wakes on traffic.
        </Text>
      ) : null}

      <SectionTitle>Deployments</SectionTitle>
      {deployments.data?.length === 0 ? <Empty text="No deployments" /> : null}
      {(deployments.data ?? []).slice(0, 8).map((d) => (
        <Card key={d.id}>
          <View style={styles.depRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.depTitle}>{d.image_name ?? d.id.slice(0, 8)}</Text>
              <Text style={styles.meta}>{relTime(d.created_at)}</Text>
            </View>
            <StatusBadge status={d.status} />
          </View>
          {d.id !== lastDeploy?.id && d.status === 'success' ? (
            <ActionButton
              label="Rollback to this"
              disabled={rollback.isPending}
              onPress={() =>
                Alert.alert('Rollback', 'Roll back to this deployment?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Rollback', onPress: () => rollback.mutate(d.id) },
                ])
              }
            />
          ) : null}
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  name: { color: colors.text, fontSize: 24, fontWeight: '800' },
  meta: { color: colors.textDim, fontSize: 12, marginTop: 4 },
  warnTitle: { color: colors.warn, fontWeight: '700', marginBottom: 6 },
  warnItem: { color: colors.text, fontSize: 13, marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap' },
  hint: { color: colors.textDim, fontSize: 12, marginTop: 4 },
  depRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  depTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
