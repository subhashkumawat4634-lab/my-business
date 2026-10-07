import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../icons/AppIcon';

interface MetricCardProps {
  label: string;
  value: string;
  foot?: string;
  icon?: string;
  accent?: boolean;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}

export function MetricCard({
  label,
  value,
  foot,
  icon,
  accent = false,
  tone = 'default',
}: MetricCardProps) {
  const valueColor =
    tone === 'success'
      ? Colors.success
      : tone === 'warning'
      ? Colors.warning
      : tone === 'danger'
      ? Colors.danger
      : accent
      ? Colors.primary
      : Colors.textPrimary;

  return (
    <View style={[styles.card, accent && styles.accentCard]}>
      <View style={styles.top}>
        <Text style={styles.label} numberOfLines={1}>
          {label.toUpperCase()}
        </Text>
        {icon ? (
          <View style={styles.iconBox}>
            <AppIcon name={icon} size={16} color={Colors.primaryLight} />
          </View>
        ) : null}
      </View>
      <Text style={[styles.value, { color: valueColor }]} numberOfLines={1}>
        {value}
      </Text>
      {foot ? (
        <Text style={styles.foot} numberOfLines={1}>
          {foot}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    flex: 1,
    minWidth: '47%',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  accentCard: {
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.4,
    flex: 1,
  },
  iconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  foot: {
    fontSize: 9.5,
    color: '#94A3B8',
    marginTop: 2,
  },
});
