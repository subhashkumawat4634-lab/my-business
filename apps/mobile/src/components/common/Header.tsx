import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../icons/AppIcon';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  onRefresh?: () => void;
  onLogout?: () => void;
  refreshing?: boolean;
  userInitials?: string;
}

export function Header({
  title = 'ThekaBook',
  subtitle = 'COMPLETE CONTRACTOR LEDGER',
  onBack,
  onRefresh,
  onLogout,
  refreshing = false,
  userInitials = 'TB',
}: HeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.backBtn} accessibilityLabel="Go back">
            <AppIcon name="arrow-back" size={22} color={Colors.primary} />
          </Pressable>
        ) : (
          <View style={styles.logoBadge}>
            <AppIcon name="shield-checkmark" size={20} color="#FFFFFF" />
          </View>
        )}
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle.toUpperCase()}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.right}>
        {onRefresh && (
          <Pressable
            onPress={onRefresh}
            style={styles.iconBtn}
            accessibilityLabel="Refresh data"
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <AppIcon name="sync-outline" size={20} color={Colors.textMuted} />
            )}
          </Pressable>
        )}

        {onLogout && (
          <Pressable
            onPress={onLogout}
            style={styles.avatarBtn}
            accessibilityLabel="User profile & logout"
          >
            <Text style={styles.avatarText}>{userInitials.slice(0, 2).toUpperCase()}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: Colors.primarySurface,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginTop: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primarySurface,
    borderWidth: 1.5,
    borderColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
  },
});
