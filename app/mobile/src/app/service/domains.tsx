import React, { useState } from 'react';
import {
  Alert,
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
import { colors } from '../../theme';
import { ActionButton, Card, Empty, ErrorBox, Loading } from '../../components';

export default function ServiceDomains() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const qc = useQueryClient();
  const [newDomain, setNewDomain] = useState('');

  const domains = useQuery({
    queryKey: ['domains', id],
    queryFn: () => api.serviceDomains(id!),
    enabled: !!id,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['domains', id] });
    qc.invalidateQueries({ queryKey: ['service', id] });
  };
  const onErr = (e: unknown) =>
    Alert.alert('Failed', e instanceof Error ? e.message : String(e));

  const add = useMutation({
    mutationFn: (d: string) => api.addDomain(id!, d),
    onSuccess: () => {
      setNewDomain('');
      invalidate();
    },
    onError: onErr,
  });
  const del = useMutation({
    mutationFn: (domainId: string) => api.deleteDomain(id!, domainId),
    onSuccess: invalidate,
    onError: onErr,
  });
  const makeDefault = useMutation({
    mutationFn: (domainId: string) => api.setDefaultDomain(id!, domainId),
    onSuccess: invalidate,
    onError: onErr,
  });

  if (domains.isLoading) return <Loading />;
  if (domains.error) return <ErrorBox error={domains.error} />;

  const submit = () => {
    const d = newDomain.trim().toLowerCase();
    if (d) add.mutate(d);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.hint}>
        Hostnames routed to this service. The default domain is the one shown on cards and used
        for generated links.
      </Text>

      {domains.data?.length === 0 ? <Empty text="No domains configured" /> : null}
      {(domains.data ?? []).map((d) => (
        <Card key={d.id}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.domain}>{d.domain}</Text>
              <Text style={styles.meta}>
                {d.is_default ? 'default · ' : ''}
                {d.cert_status ? `tls: ${d.cert_status}` : 'tls pending'}
              </Text>
            </View>
            {!d.is_default ? (
              <TouchableOpacity
                onPress={() => makeDefault.mutate(d.id)}
                hitSlop={8}
                style={styles.iconBtn}
              >
                <Ionicons name="star-outline" size={20} color={colors.accent} />
              </TouchableOpacity>
            ) : (
              <Ionicons name="star" size={20} color={colors.warn} style={styles.iconBtn} />
            )}
            <TouchableOpacity
              onPress={() =>
                Alert.alert('Remove domain', `Detach ${d.domain} from this service?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => del.mutate(d.id) },
                ])
              }
              hitSlop={8}
              style={styles.iconBtn}
            >
              <Ionicons name="trash-outline" size={18} color={colors.err} />
            </TouchableOpacity>
          </View>
        </Card>
      ))}

      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          value={newDomain}
          onChangeText={setNewDomain}
          placeholder="app.example.com"
          placeholderTextColor={colors.textDim}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          onSubmitEditing={submit}
        />
        <ActionButton
          label={add.isPending ? '…' : 'Add'}
          kind="primary"
          disabled={add.isPending || newDomain.trim() === ''}
          onPress={submit}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  hint: { color: colors.textDim, fontSize: 12, marginBottom: 12, lineHeight: 17 },
  row: { flexDirection: 'row', alignItems: 'center' },
  domain: { color: colors.text, fontSize: 15, fontWeight: '600' },
  meta: { color: colors.textDim, fontSize: 12, marginTop: 3 },
  iconBtn: { padding: 6, marginLeft: 10 },
  addRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  input: {
    flex: 1,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginRight: 8,
    fontSize: 14,
  },
});
