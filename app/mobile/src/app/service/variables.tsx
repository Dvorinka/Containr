import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../../session';
import { MASKED_SECRET, Variable } from '../../api';
import { colors } from '../../theme';
import { ActionButton, Card, Empty, ErrorBox, Loading } from '../../components';

interface Row {
  key: string;
  value: string;
  is_secret: boolean;
  // Secret untouched by the user — submits the masked placeholder so the
  // server keeps the stored ciphertext.
  keepSecret: boolean;
}

export default function ServiceVariables() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const api = useApi();

  const vars = useQuery({
    queryKey: ['variables', id],
    queryFn: () => api.serviceVariables(id!),
    enabled: !!id,
  });

  if (vars.isLoading) return <Loading />;
  if (vars.error) return <ErrorBox error={vars.error} />;
  if (!vars.data) return <ErrorBox error={new Error('Not found')} />;

  // Editor mounts once data exists; its state initializes from the fetch.
  return <Editor serviceId={id!} name={name} initial={vars.data} />;
}

function Editor({
  serviceId,
  name,
  initial,
}: {
  serviceId: string;
  name?: string;
  initial: Variable[];
}) {
  const api = useApi();
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((v) => ({
      key: v.key,
      value: v.is_secret ? '' : v.value,
      is_secret: v.is_secret,
      keepSecret: v.is_secret,
    })),
  );

  const save = useMutation({
    mutationFn: () => {
      const clean = rows
        .filter((r) => r.key.trim() !== '')
        .map((r) => ({
          key: r.key.trim(),
          value: r.keepSecret ? MASKED_SECRET : r.value,
          is_secret: r.is_secret,
        }));
      return api.updateVariables(serviceId, clean);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['variables', serviceId] });
      qc.invalidateQueries({ queryKey: ['env-check', serviceId] });
      Alert.alert('Saved', 'Variables apply on the next deploy/restart.');
    },
    onError: (e) => Alert.alert('Save failed', e instanceof Error ? e.message : String(e)),
  });

  const set = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.hint}>
          Variables for {name ?? 'this service'}. Secret values are stored encrypted — leave a
          secret blank to keep it, type to replace.
        </Text>

        {rows.length === 0 ? <Empty text="No variables yet" /> : null}
        {rows.map((r, i) => (
          <Card key={i}>
            <View style={styles.rowHead}>
              <TextInput
                style={styles.keyInput}
                value={r.key}
                onChangeText={(t) => set(i, { key: t.toUpperCase().replace(/\s/g, '_') })}
                placeholder="KEY"
                placeholderTextColor={colors.textDim}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() =>
                  set(i, r.is_secret ? { is_secret: false, keepSecret: false } : { is_secret: true })
                }
                hitSlop={8}
                style={styles.iconBtn}
              >
                <Ionicons
                  name={r.is_secret ? 'lock-closed' : 'lock-open-outline'}
                  size={18}
                  color={r.is_secret ? colors.warn : colors.textDim}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                hitSlop={8}
                style={styles.iconBtn}
              >
                <Ionicons name="trash-outline" size={18} color={colors.err} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.valueInput}
              value={r.value}
              onChangeText={(t) => set(i, { value: t, keepSecret: false })}
              placeholder={r.keepSecret ? '••••••••  (unchanged)' : 'value'}
              placeholderTextColor={colors.textDim}
              secureTextEntry={r.is_secret && !r.keepSecret}
              autoCapitalize="none"
              autoCorrect={false}
              multiline={false}
            />
          </Card>
        ))}

        <ActionButton
          label="+ Add variable"
          onPress={() =>
            setRows((rs) => [...rs, { key: '', value: '', is_secret: false, keepSecret: false }])
          }
        />
        <ActionButton
          label={save.isPending ? 'Saving…' : 'Save variables'}
          kind="primary"
          disabled={save.isPending}
          onPress={() => save.mutate()}
        />
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  hint: { color: colors.textDim, fontSize: 12, marginBottom: 12, lineHeight: 17 },
  rowHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  keyInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  valueInput: {
    color: colors.text,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    padding: 10,
  },
  iconBtn: { padding: 6, marginLeft: 6 },
});
