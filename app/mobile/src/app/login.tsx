import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useSession, normalizeServerUrl } from '../session';
import { colors } from '../theme';

export default function Login() {
  const { signIn } = useSession();
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const normalized = normalizeServerUrl(url);
      const res = await fetch(`${normalized}/api/v1/projects?limit=1`, {
        headers: { Authorization: `Bearer ${token.trim()}` },
      });
      if (res.status === 401 || res.status === 403) {
        throw new Error('Token rejected. Use a personal access token (cnp_…).');
      }
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      await signIn(normalized, token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.logo}>Containr</Text>
      <Text style={styles.sub}>Self-hosted platform console</Text>

      <Text style={styles.label}>Server URL</Text>
      <TextInput
        style={styles.input}
        placeholder="https://containr.example.com"
        placeholderTextColor={colors.textDim}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        value={url}
        onChangeText={setUrl}
      />

      <Text style={styles.label}>Personal access token</Text>
      <TextInput
        style={styles.input}
        placeholder="cnp_…"
        placeholderTextColor={colors.textDim}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        value={token}
        onChangeText={setToken}
      />

      {error ? <Text style={styles.err}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.btn, (!url.trim() || !token.trim() || busy) && { opacity: 0.5 }]}
        onPress={connect}
        disabled={!url.trim() || !token.trim() || busy}
      >
        {busy ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={styles.btnText}>Connect</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.hint}>
        Create a token in the web UI under Settings → Access Tokens.
      </Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: 'center' },
  logo: { color: colors.text, fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  sub: { color: colors.textDim, fontSize: 14, marginBottom: 32, marginTop: 4 },
  label: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 16,
  },
  err: { color: colors.err, marginBottom: 12 },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  hint: { color: colors.textDim, fontSize: 12, marginTop: 20, textAlign: 'center' },
});
