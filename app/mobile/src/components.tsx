import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, statusColor } from './theme';

export function StatusDot({ status }: { status: string }) {
  return (
    <View
      style={[styles.dot, { backgroundColor: statusColor[status] ?? colors.textDim }]}
    />
  );
}

export function StatusBadge({ status }: { status: string }) {
  const c = statusColor[status] ?? colors.textDim;
  return (
    <View style={[styles.badge, { borderColor: c }]}>
      <View style={[styles.dot, { backgroundColor: c }]} />
      <Text style={[styles.badgeText, { color: c }]}>{status}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.section}>{children}</Text>;
}

export function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

export function ErrorBox({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : String(error);
  return <Text style={styles.err}>{msg}</Text>;
}

export function ActionButton({
  label,
  onPress,
  kind = 'default',
  disabled,
}: {
  label: string;
  onPress: () => void;
  kind?: 'default' | 'primary' | 'danger';
  disabled?: boolean;
}) {
  const bg =
    kind === 'primary' ? colors.accent : kind === 'danger' ? colors.err : colors.surfaceAlt;
  return (
    <TouchableOpacity
      style={[styles.btn, { backgroundColor: bg, opacity: disabled ? 0.4 : 1 }]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.btnText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Row({
  title,
  subtitle,
  right,
  onPress,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} disabled={!onPress}>
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.rowSub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </TouchableOpacity>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { width: 8, height: 8, borderRadius: 4 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  section: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 8,
  },
  empty: { color: colors.textDim, fontSize: 14, paddingVertical: 12 },
  err: { color: colors.err, fontSize: 13, paddingVertical: 8 },
  btn: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  btnText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '500' },
  rowSub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
