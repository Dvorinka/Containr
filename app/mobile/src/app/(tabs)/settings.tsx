import React from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useSession } from '../../session';
import { colors } from '../../theme';
import { ActionButton, Card, SectionTitle } from '../../components';

export default function Settings() {
  const { serverUrl, signOut } = useSession();
  const router = useRouter();

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16 }}>
      <SectionTitle>Connection</SectionTitle>
      <Card>
        <Text style={styles.label}>Server</Text>
        <Text style={styles.value}>{serverUrl}</Text>
      </Card>

      <SectionTitle>App</SectionTitle>
      <Card>
        <Text style={styles.label}>Version</Text>
        <Text style={styles.value}>
          {Constants.expoConfig?.version ?? 'dev'} · Expo SDK{' '}
          {Constants.expoConfig?.sdkVersion ?? '?'}
        </Text>
      </Card>

      <ActionButton
        label="Disconnect"
        kind="danger"
        onPress={() =>
          Alert.alert('Disconnect', 'Remove the stored server and token?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Disconnect',
              style: 'destructive',
              onPress: async () => {
                await signOut();
                router.replace('/login');
              },
            },
          ])
        }
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  label: { color: colors.textDim, fontSize: 12, marginBottom: 4 },
  value: { color: colors.text, fontSize: 15 },
});
