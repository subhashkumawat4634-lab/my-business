import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../icons/AppIcon';

export interface TopNavBarProps {
  /** Main page title */
  title: string;
  /** Subtitle / description / category */
  subtitle?: string;
  /** Left icon when not in back mode (e.g. 'business', 'calendar', 'people', 'wallet', 'bar-chart') */
  icon?: string;
  /** Back navigation callback - if provided, renders back arrow */
  onBack?: () => void;
  /** Optional text next to back button (e.g. 'Work Sites') */
  backText?: string;
  /** Status badge or counter */
  badge?:
    | {
        label: string;
        tone?: 'green' | 'blue' | 'orange' | 'purple' | 'red' | 'gray';
      }
    | string;
  /** Action buttons / components on the right side */
  actions?: React.ReactNode;
  /** Pull/tap refresh callback */
  onRefresh?: () => void;
  /** Refresh loading indicator */
  refreshing?: boolean;
  /** User initials for avatar */
  userInitials?: string;
  /** User profile / logout callback */
  onLogout?: () => void;
  /** Container style overrides */
  style?: any;
}

export function TopNavBar({
  title,
  subtitle,
  icon,
  onBack,
  backText,
  badge,
  actions,
  onRefresh,
  refreshing = false,
  userInitials,
  onLogout,
  style,
}: TopNavBarProps) {
  // Format badge
  const badgeObj =
    typeof badge === 'string'
      ? { label: badge, tone: 'blue' as const }
      : badge;

  const getBadgeStyle = (tone?: string) => {
    switch (tone) {
      case 'green':
        return { bg: '#DCFCE7', text: '#15803D', border: '#86EFAC' };
      case 'orange':
        return { bg: '#FFEDD5', text: '#C2410C', border: '#FDBA74' };
      case 'purple':
        return { bg: '#F3E8FF', text: '#7E22CE', border: '#D8B4FE' };
      case 'red':
        return { bg: '#FEE2E2', text: '#B91C1C', border: '#FCA5A5' };
      case 'gray':
        return { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };
      default:
        return { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' };
    }
  };

  const badgeTheme = badgeObj ? getBadgeStyle(badgeObj.tone) : null;

  return (
    <View style={[styles.container, style]}>
      {/* Left Area: Back Button OR Page Icon */}
      <View style={styles.left}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [
              styles.backBtn,
              pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] },
            ]}
            accessibilityLabel={backText ? `Back to ${backText}` : 'Go back'}
          >
            <AppIcon name="arrow-back" size={20} color={Colors.primary} />
            {backText ? (
              <Text style={styles.backBtnText} numberOfLines={1}>
                {backText}
              </Text>
            ) : null}
          </Pressable>
        ) : icon ? (
          <View style={styles.iconBadge}>
            <AppIcon
              name={icon}
              size={18}
              color="#FFFFFF"
            />
          </View>
        ) : null}

        {/* Title & Subtitle */}
        <View style={styles.titleWrapper}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {badgeTheme && badgeObj ? (
              <View
                style={[
                  styles.badgePill,
                  {
                    backgroundColor: badgeTheme.bg,
                    borderColor: badgeTheme.border,
                  },
                ]}
              >
                <Text
                  style={[styles.badgePillText, { color: badgeTheme.text }]}
                  numberOfLines={1}
                >
                  {badgeObj.label}
                </Text>
              </View>
            ) : null}
          </View>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Right Area: Page-Specific Actions + User Avatar */}
      <View style={styles.right}>
        {actions ? <View style={styles.actionsBox}>{actions}</View> : null}

        {userInitials && (
          <Pressable
            onPress={onLogout}
            style={({ pressed }) => [
              styles.avatarBtn,
              pressed && { opacity: 0.8 },
            ]}
            accessibilityLabel="User profile"
          >
            <Text style={styles.avatarText}>
              {userInitials.slice(0, 2).toUpperCase()}
            </Text>
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    minHeight: 60,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    ...(Platform.OS === 'web'
      ? ({
          position: 'sticky',
          top: 0,
          zIndex: 50,
        } as any)
      : {}),
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  titleWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
    marginTop: 1,
  },
  badgePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
});
