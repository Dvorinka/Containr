import React, { useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
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
  StatusBadge,
} from '../../components';

export default function ServiceCron() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const qc = useQueryClient();
  const [historyFor, setHistoryFor] = useState<string | null>(null);

  const jobs = useQuery({
    queryKey: ['service-cron', id],
    queryFn: () => api.cronJobs(id!),
    enabled: !!id,
    refetchInterval: 15_000,
  });
  const executions = useQuery({
    queryKey: ['cron-executions', historyFor],
    queryFn: () => api.cronExecutions(historyFor!),
    enabled: !!historyFor,
  });

  const trigger = useMutation({
    mutationFn: (jobId: string) => api.triggerCronJob(jobId),
    onSuccess: (_d, jobId) => {
      qc.invalidateQueries({ queryKey: ['service-cron', id] });
      setHistoryFor(jobId);
      setTimeout(
        () => qc.invalidateQueries({ queryKey: ['cron-executions', jobId] }),
        2000,
      );
    },
    onError: (e) =>
      Alert.alert('Trigger failed', e instanceof Error ? e.message : String(e)),
  });

  if (jobs.isLoading) return <Loading />;
  if (jobs.error) return <ErrorBox error={jobs.error} />;

  const list = jobs.data ?? [];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={jobs.isRefetching}
          onRefresh={() => jobs.refetch()}
          tintColor={colors.accent}
        />
      }
    >
      {list.length === 0 ? <Empty text="No cron jobs on this service" /> : null}
      {list.map((job) => (
        <Card key={job.id}>
          <View style={styles.jobHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.jobName}>{job.name}</Text>
              <Text style={styles.meta}>
                {job.schedule}
                {job.timezone ? ` · ${job.timezone}` : ''}
                {job.enabled === false ? ' · disabled' : ''}
              </Text>
              <Text style={styles.cmd} numberOfLines={1}>
                {job.command}
              </Text>
              <Text style={styles.meta}>
                {job.last_run_at ? `last ${relTime(job.last_run_at)}` : 'never run'}
                {job.next_run_at ? ` · next ${relTime(job.next_run_at)}` : ''}
              </Text>
            </View>
            {job.last_status ? <StatusBadge status={job.last_status} /> : null}
          </View>
          <View style={styles.jobActions}>
            <ActionButton
              label="Run now"
              kind="primary"
              disabled={trigger.isPending}
              onPress={() => trigger.mutate(job.id)}
            />
            <ActionButton
              label={historyFor === job.id ? 'Hide history' : 'History'}
              onPress={() => setHistoryFor(historyFor === job.id ? null : job.id)}
            />
          </View>
          {historyFor === job.id ? (
            <View style={styles.history}>
              {executions.isLoading ? (
                <Loading />
              ) : (executions.data ?? []).length === 0 ? (
                <Text style={styles.meta}>No executions yet</Text>
              ) : (
                (executions.data ?? []).slice(0, 10).map((ex) => (
                  <View key={ex.id} style={styles.execRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.execTime}>{relTime(ex.started_at)}</Text>
                      {ex.error ? (
                        <Text style={styles.execErr} numberOfLines={2}>
                          {ex.error}
                        </Text>
                      ) : ex.output ? (
                        <Text style={styles.execOut} numberOfLines={2}>
                          {ex.output}
                        </Text>
                      ) : null}
                    </View>
                    <StatusBadge status={ex.status ?? 'unknown'} />
                  </View>
                ))
              )}
            </View>
          ) : null}
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  jobHead: { flexDirection: 'row', alignItems: 'flex-start' },
  jobName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  meta: { color: colors.textDim, fontSize: 11, marginTop: 3 },
  cmd: { color: colors.textDim, fontSize: 12, fontFamily: 'monospace', marginTop: 4 },
  jobActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  history: { marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  execRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 },
  execTime: { color: colors.text, fontSize: 12 },
  execErr: { color: colors.err, fontSize: 11, marginTop: 2 },
  execOut: { color: colors.textDim, fontSize: 11, marginTop: 2 },
});
