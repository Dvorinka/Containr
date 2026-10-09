import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../../session';
import { Service } from '../../api';
import { colors } from '../../theme';
import { ActionButton, Card, ErrorBox, Loading, SectionTitle } from '../../components';

export default function ServiceSettings() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();

  const service = useQuery({
    queryKey: ['service', id],
    queryFn: () => api.service(id!),
    enabled: !!id,
  });

  if (service.isLoading) return <Loading />;
  if (service.error || !service.data) {
    return <ErrorBox error={service.error ?? new Error('Not found')} />;
  }

  // Form mounts once data exists; its state initializes from the fetch.
  return <Form serviceId={id!} initial={service.data} />;
}

function Form({ serviceId, initial }: { serviceId: string; initial: Service }) {
  const api = useApi();
  const qc = useQueryClient();
  const [replicas, setReplicas] = useState(initial.replicas ?? 1);
  const [port, setPort] = useState(String(initial.port ?? 0));
  const [sleepEnabled, setSleepEnabled] = useState(!!initial.sleep_enabled);
  const [sleepMinutes, setSleepMinutes] = useState(
    String(initial.sleep_idle_minutes || 30),
  );

  const save = useMutation({
    mutationFn: () =>
      api.updateService(serviceId, {
        replicas,
        port: parseInt(port, 10) || 0,
        sleep_enabled: sleepEnabled,
        sleep_idle_minutes: Math.min(1440, Math.max(1, parseInt(sleepMinutes, 10) || 30)),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service', serviceId] });
      qc.invalidateQueries({ queryKey: ['services'] });
      Alert.alert('Saved', 'Changes apply on the next deploy.');
    },
    onError: (e) => Alert.alert('Save failed', e instanceof Error ? e.message : String(e)),
  });

  const clampReplicas = (n: number) => Math.min(16, Math.max(0, n));

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16 }}>
      <SectionTitle>Scaling</SectionTitle>
      <Card>
        <View style={styles.stepRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Replicas</Text>
            <Text style={styles.sub}>Containers run per deploy; 0 parks the service.</Text>
          </View>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => setReplicas((r) => clampReplicas(r - 1))}
            disabled={replicas <= 0}
          >
            <Text style={styles.stepText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.stepValue}>{replicas}</Text>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => setReplicas((r) => clampReplicas(r + 1))}
            disabled={replicas >= 16}
          >
            <Text style={styles.stepText}>+</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Container port</Text>
          <TextInput
            style={styles.input}
            value={port}
            onChangeText={setPort}
            keyboardType="number-pad"
            placeholder="0 = none"
            placeholderTextColor={colors.textDim}
          />
        </View>
      </Card>

      <SectionTitle>Scale to zero</SectionTitle>
      <Card>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Sleep when idle</Text>
            <Text style={styles.sub}>Scales to zero after idle; incoming traffic wakes it.</Text>
          </View>
          <Switch
            value={sleepEnabled}
            onValueChange={setSleepEnabled}
            trackColor={{ false: colors.border, true: colors.accentDim }}
            thumbColor={sleepEnabled ? colors.accent : colors.textDim}
          />
        </View>
        {sleepEnabled ? (
          <View style={styles.field}>
            <Text style={styles.label}>Idle minutes before sleep (1–1440)</Text>
            <TextInput
              style={styles.input}
              value={sleepMinutes}
              onChangeText={setSleepMinutes}
              keyboardType="number-pad"
              placeholder="30"
              placeholderTextColor={colors.textDim}
            />
          </View>
        ) : null}
      </Card>

      <ActionButton
        label={save.isPending ? 'Saving…' : 'Save settings'}
        kind="primary"
        disabled={save.isPending}
        onPress={() => save.mutate()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  label: { color: colors.text, fontSize: 15, fontWeight: '600' },
  sub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  stepRow: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: colors.text, fontSize: 20, fontWeight: '700' },
  stepValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    minWidth: 36,
    textAlign: 'center',
  },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
  field: { marginTop: 12 },
  input: {
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    fontSize: 14,
  },
});
